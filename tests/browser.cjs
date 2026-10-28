/* End-to-end UI checks with a local fake API. Never writes to the live store. */
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),A=require('../store.js');
const raw=(id,name,price,weight='',meta={})=>({id,name,price,weight,category:'حلويات',description:A.pack('طازجة ومجهزة بعناية',meta),active:true,offer:false,old_price:0,image:'',badge:''});
const fixtures=[raw(1,'بقلاوة',10000,'نصف كيلو',{productId:'baklava',ingredients:'فستق',allergens:'مكسرات',flavors:[{label:'شوكولاتة',price:1000}],packaging:[{label:'علبة هدية',price:2000}],allowMessage:true}),raw(2,'بقلاوة',20000,'كيلو',{productId:'baklava'}),raw(3,'كيك',15000,'صغير',{productId:'cake'}),raw(4,'معمول',5000,'',{available:false}),{id:99,name:'إعدادات',category:'__settings__',price:0,active:true,description:A.pack('',{settings:{...A.DEFAULTS,zones:[{name:'مركز القرنة',fee:2000}]}})}];
(async()=>{
 const server=http.createServer((req,res)=>{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 let context;
 try{
  context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  let products=JSON.parse(JSON.stringify(fixtures)),calls=[],fail=false,apiDelay=0,version=1,waMessage='',savedOrders=[];const statuses=new Map(),errors=[];
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin)return route.continue();
   if(url.hostname==='wa.me'){waMessage=url.searchParams.get('text');return route.fulfill({contentType:'text/html',body:'<p>WhatsApp intercepted locally</p>'})}
   if(url.hostname==='script.google.com'){
    if(fail)return route.abort();
    if(req.method()==='POST'){const body=req.postDataJSON();calls.push(body);const p=body.args[0];let result;
     if(body.action==='saveProduct'){const item={...p,id:p.id??Math.max(...products.map(x=>x.id))+1};products=products.filter(x=>x.id!==item.id).concat(item);result={products}}
     else if(body.action==='saveGroup'){const incoming=p.products.map(x=>({...x,id:x.id??Math.max(...products.map(y=>y.id))+1}));products=products.filter(x=>!incoming.some(y=>y.id===x.id)).concat(incoming);result={products}}
     else if(body.action==='trackEvents')result={ok:true};
     else if(body.action==='createOrder'){savedOrders.push(p);result={id:p.id}}
     else if(body.action==='updateOrder'){savedOrders=savedOrders.map(o=>o.id===p.id?{...o,status:p.status}:o);result={ok:true}}
     else if(body.action==='uploadImage')result={url:'assets/images/logo.svg'};
     else throw Error('Unexpected mutation '+body.action);
     statuses.set(body.requestId,{ok:true,result});return route.fulfill({body:'{}',headers:{'access-control-allow-origin':'*'}});
    }
    if(apiDelay)await new Promise(r=>setTimeout(r,apiDelay));
    const action=url.searchParams.get('action');let result=action==='products'?{products}:action==='listProducts'?{ok:true,result:products}:action==='capabilities'?{version}:action==='status'?statuses.get(url.searchParams.get('requestId')):action==='listOrders'?{ok:true,result:savedOrders}:action==='audit'||action==='backups'?{ok:true,result:[]}:{};
    return route.fulfill({contentType:'application/javascript',body:url.searchParams.get('callback')+'('+JSON.stringify(result)+');'});
   }
   if(url.hostname==='docs.google.com')return route.abort();
   return route.abort();
  });
  let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#loadState').hidden);assert.equal(await page.locator('#menu .card').count(),3);console.log('PASS initial load and grouping');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('[data-choose="4"]').first().isDisabled().then(v=>assert.equal(v,true));
  await page.locator('[data-choose="1"]').first().click();await page.locator('[name="flavor"]').selectOption('0');await page.locator('[name="packaging"]').selectOption('0');await page.locator('[name="giftMessage"]').fill('كل عام وأنت بخير');assert.match(await page.locator('.weight-total').textContent(),/13,000/);await page.locator('.weight-confirm').click();
  await page.locator('#floatingCart').click();assert.match(await page.locator('#cartItems').textContent(),/كل عام/);assert.match(await page.locator('#cartTotal').textContent(),/13,000/);console.log('PASS customization and price');
  await page.locator('#closeCart').click();await page.reload();await page.waitForFunction(()=>document.querySelector('#loadState').hidden);assert.match(await page.locator('#floatTotal').textContent(),/13,000/);console.log('PASS custom cart persists across reload');
  await page.locator('#floatingCart').click();await page.locator('#customerName').fill('زبون اختبار');await page.locator('#customerPhone').fill('٠٧٧٠١٢٣٤٥٦٧');await page.locator('#confirmOrder').click();assert.match(await page.locator('#formError').textContent(),/عنوان/);
  await page.locator('#customerAddress').fill('القرنة، أقرب نقطة دالة');await page.locator('#confirmOrder').click();assert.match(await page.locator('#formError').textContent(),/موعد/);
  const when=new Date(Date.now()+86400000+3*3600000).toISOString().slice(0,16);await page.locator('#requestedAt').fill(when);await page.locator('#deliveryZone').selectOption('0');await page.locator('#confirmOrder').click();await page.waitForURL('https://wa.me/**');assert.match(waMessage,/المجموع: 13,000/);assert.match(waMessage,/الإجمالي مع التوصيل المحدد: 15,000/);assert.match(waMessage,/الهاتف: 07701234567/);assert.match(waMessage,/رقم الطلب: AD-/);console.log('PASS address and schedule validation, Arabic phone, WhatsApp total and unique number');
  await page.goto(origin+'/?product=2');await page.locator('.weight-dialog').waitFor();assert.equal(await page.locator('[name="weight-choice"]:checked').getAttribute('value'),'2');await page.keyboard.press('Escape');assert.equal(await page.locator('.weight-dialog').count(),0);console.log('PASS exact-weight deep link and dialog keyboard close');
  await page.evaluate(()=>{localStorage.setItem('shajarat-adam-cart-v2','{"1":2}');localStorage.removeItem('adam-custom-cart-v3')});apiDelay=1500;await page.goto(origin);assert.match(await page.locator('#floatTotal').textContent(),/20,000/);await page.waitForFunction(()=>document.querySelector('#loadState').hidden);apiDelay=0;assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('shajarat-adam-cart-v2'))['1']),2);console.log('PASS legacy cart preserved while asynchronous menu loads');
  fail=true;await page.reload();await page.locator('#retryMenu').waitFor();assert.ok(await page.locator('#menu .card').count());assert.equal(await page.locator('#confirmOrder').isDisabled(),true);fail=false;await page.locator('#retryMenu').click();await page.waitForFunction(()=>document.querySelector('#loadState').hidden);console.log('PASS cached menu and retry after network failure');
  await page.screenshot({path:'/tmp/adam-mobile.png',fullPage:true});
  await page.goto(origin+'/admin.html');await page.waitForFunction(()=>document.querySelector('#list').children.length>0);assert.equal(await page.locator('input[type="password"]').count(),0);
  await page.locator('button[data-id="3"]').click();await page.locator('.weight-name').fill('كبير');await page.locator('.weight-price').fill('18000');await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);const cake=products.find(p=>p.id===3);assert.equal(cake.weight,'كبير');assert.equal(cake.price,18000);assert.equal(calls.some(c=>c.action==='deleteProduct'),false);console.log('PASS weight rename retains original ID without deletion on legacy API');
  await page.locator('button[data-id="3"]').click();page.once('dialog',d=>d.accept());await page.locator('#delete').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);assert.equal(A.normalize(products.find(p=>p.id===3)).meta.deleted,true);
  await page.locator('[data-tab="backups"]').click();await page.locator('[data-restore="3"]').click();await page.waitForFunction(()=>document.querySelector('[data-restore="3"]')===null);assert.equal(A.normalize(products.find(p=>p.id===3)).meta.deleted,false);console.log('PASS archive and restore all product data');
  await page.locator('[data-tab="settings"]').click();await page.locator('#settingLead').fill('90');await page.locator('#settingsForm button').click();await page.waitForFunction(()=>document.querySelector('#settingsStatus').textContent.includes('تم حفظ'));assert.equal(A.settings(products.map(A.normalize)).leadMinutes,90);console.log('PASS global settings saved in compatible data contract');
  await page.locator('[data-tab="products"]').click();await page.locator('[data-select="3"]').check();await page.locator('#bulkUnavailable').click();await page.waitForFunction(()=>!document.querySelector('#bulkUnavailable').disabled);assert.equal(A.normalize(products.find(p=>p.id===3)).meta.available,false);console.log('PASS bulk availability');
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'/tmp/adam-admin.png',fullPage:true});await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#loadState').hidden);await page.screenshot({path:'/tmp/adam-desktop.png',fullPage:true});
  version=3;await page.goto(origin+'/admin.html');await page.waitForFunction(()=>document.querySelector('#list').children.length>0);await page.locator('button[data-id="3"]').click();await page.locator('.weight-name').fill('حجم مناسبة');await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);assert.equal(calls.at(-1).action,'saveGroup');assert.equal(calls.at(-1).args[0].products[0].id,3);console.log('PASS version 3 atomic group payload');
  savedOrders=[{id:'AD-TEST-1',name:'زبون',phone:'07701234567',total:12000,status:'بانتظار تأكيد المتجر',requestedAt:when,items:[{name:'بقلاوة',qty:1}]}];await page.locator('[data-tab="orders"]').click();await page.locator('[data-order]').waitFor();await page.locator('[data-order]').selectOption('مكتمل');await page.waitForFunction(()=>document.querySelector('#stats').textContent.includes('المكتملة: 1'));assert.equal(savedOrders[0].status,'مكتمل');console.log('PASS shared order list and completed-order statistics');
  await page.locator('[data-tab="products"]').click();await page.locator('button[data-id="3"]').click();await page.locator('#imageFile').setInputFiles(path.join(root,'assets/images/adam-icon-192.png'));await page.waitForFunction(()=>!document.querySelector('#preview').hidden);await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);assert.ok(calls.some(c=>c.action==='uploadImage'));console.log('PASS phone image selection, compression and version 3 upload contract');
  await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#loadState').hidden);await page.locator('#floatingCart').click();await page.locator('#customerName').fill('اختبار خادم');await page.locator('#customerPhone').fill('07701234567');await page.locator('#customerAddress').fill('القرنة');await page.locator('#requestedAt').fill(when);await page.locator('#confirmOrder').click();await page.waitForURL('https://wa.me/**');const created=calls.findLast(c=>c.action==='createOrder');assert.ok(created);assert.equal(created.args[0].zone,'');assert.equal(created.args[0].fee,0);console.log('PASS version 3 order journal before WhatsApp and unspecified delivery fee stays unspecified');
  await page.goto(origin+'/admin.html');await page.waitForFunction(()=>document.querySelector('#list').children.length>0);
  await page.setViewportSize({width:360,height:800});await page.locator('[data-tab="products"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/adam-admin-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors; mobile and desktop screenshots saved');
 }finally{await context?.close();await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
