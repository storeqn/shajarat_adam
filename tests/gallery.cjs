/* Gallery UI regression checks. Every remote API is intercepted; store data is untouched. */
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('../store.js'),root=path.resolve(__dirname,'..');
const urls=['https://photos.example.test/old.jpg','https://photos.example.test/side.jpg','https://photos.example.test/box.jpg'];
const raw=(id,weight)=>({id,name:'بقلاوة',price:10000,category:'حلويات',description:A.pack('حلويات طازجة',{productId:'gallery-product',allergens:'مكسرات',images:[urls[1],urls[2]]}),image:urls[0],weight,active:true,offer:false,old_price:0,badge:''});
(async()=>{
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.join(root,pathname==='/'?'index.html':pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 let context;
 try{
  context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  let products=[raw(1,'نصف كيلو'),raw(2,'كيلو')],uploads=0,uploadAttempt=0,failNextUpload=false,calls=[];const statuses=new Map(),errors=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin===origin)return route.continue();
   if(url.hostname==='photos.example.test')return route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(root,'assets/images/logo.svg'))});
   if(url.hostname!=='script.google.com')return route.abort();
   if(request.method()==='POST'){
    const body=request.postDataJSON(),arg=body.args[0];calls.push(body);let result;
    if(body.action==='uploadImage'){
     uploadAttempt++;if(failNextUpload&&uploadAttempt%2===0){failNextUpload=false;statuses.set(body.requestId,{ok:false,error:'فشل رفع تجريبي'});return route.fulfill({body:'{}'})}
     uploads++;result={url:'https://photos.example.test/upload-'+uploads+'.jpg'};
    }else if(body.action==='saveGroup'){products=products.filter(p=>!arg.products.some(n=>n.id===p.id)).concat(arg.products);result={products}}
    else if(body.action==='trackEvents')result={ok:true};else throw Error('Unexpected operation '+body.action);
    statuses.set(body.requestId,{ok:true,result});return route.fulfill({body:'{}'});
   }
   const action=url.searchParams.get('action');let data=action==='capabilities'?{version:3}:action==='listProducts'?{ok:true,result:products}:action==='products'?{products}:action==='status'?statuses.get(url.searchParams.get('requestId')):{ok:false,error:'not used'};
   return route.fulfill({contentType:'application/javascript',body:url.searchParams.get('callback')+'('+JSON.stringify(data)+');'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/admin.html');await page.locator('button[data-id="1"]').waitFor();await page.locator('button[data-id="1"]').click();
  assert.equal(await page.locator('.gallery-edit-item').count(),3);assert.equal(await page.locator('#image').inputValue(),urls[0]);console.log('PASS legacy primary and stored extra images appear together');
  await page.locator('#extraImageUrl').fill(urls[1]);await page.locator('#addImageUrl').click();assert.equal(await page.locator('.gallery-edit-item').count(),3);
  await page.locator('#extraImageUrl').fill('javascript:alert(1)');await page.locator('#addImageUrl').click();assert.equal(await page.locator('.gallery-edit-item').count(),3);assert.match(await page.locator('#error').textContent(),/HTTPS/);console.log('PASS duplicate and unsafe image links rejected');
  await page.locator('[data-gallery-primary="2"]').click();assert.equal(await page.locator('#image').inputValue(),urls[2]);
  await page.locator('[data-gallery-move="2"][data-delta="-1"]').click();await page.locator('[data-gallery-remove="2"]').click();
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);
  const saved=products.map(A.normalize);for(const product of saved){assert.deepEqual(A.imageList(product),[urls[2],urls[1]]);assert.equal(product.meta.allergens,'مكسرات')}
  console.log('PASS primary selection, reorder and removal persist across every weight');
  await page.locator('button[data-id="1"]').click();await page.locator('#imageFile').setInputFiles([path.join(root,'assets/images/adam-icon-180.png'),path.join(root,'assets/images/adam-icon-192.png')]);
  await page.waitForFunction(()=>document.querySelectorAll('.gallery-edit-item').length===4&&!document.querySelector('#save').disabled);assert.equal(await page.locator('#imageFile').getAttribute('multiple'),'');
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);assert.equal(uploads,2);assert.equal(A.imageList(A.normalize(products[0])).length,4);assert.ok(calls.filter(c=>c.action==='uploadImage').every(c=>c.args[0].data.startsWith('data:image/jpeg;base64,')));console.log('PASS multiple phone photos are compressed and individually uploaded using existing v3 API');
  await page.reload();await page.locator('button[data-id="1"]').waitFor();await page.locator('button[data-id="1"]').click();assert.equal(await page.locator('.gallery-edit-item').count(),4);await page.locator('#imageGallery').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/adam-gallery-admin.png',fullPage:true});
  const initialCount=uploads;await page.locator('#imageFile').setInputFiles([path.join(root,'assets/images/adam-icon-180.png'),path.join(root,'assets/images/adam-icon-192.png')]);await page.waitForFunction(()=>document.querySelectorAll('.gallery-edit-item').length===6&&!document.querySelector('#save').disabled);failNextUpload=true;await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#saveError').textContent.includes('فشل رفع تجريبي'));assert.equal(uploads,initialCount+1);await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);assert.equal(uploads,initialCount+2);console.log('PASS retry reuses already uploaded image after partial upload failure');
  await page.locator('button[data-id="1"]').click();await page.locator('#extraImageUrl').fill('https://photos.example.test/seven.jpg');await page.locator('#addImageUrl').click();await page.locator('#extraImageUrl').fill('https://photos.example.test/eight.jpg');await page.locator('#addImageUrl').click();await page.locator('#extraImageUrl').fill('https://photos.example.test/nine.jpg');await page.locator('#addImageUrl').click();assert.equal(await page.locator('.gallery-edit-item').count(),8);assert.match(await page.locator('#error').textContent(),/8/);await page.locator('#close').click();console.log('PASS maximum gallery size and discarded changes');
  await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#loadState').hidden);assert.equal(await page.locator('#menu .food-image').count(),1);await page.locator('[data-choose="1"]').first().click();assert.equal(await page.locator('.gallery-thumbnails button').count(),6);
  await page.locator('[data-gallery-index="1"]').click();assert.match(await page.locator('.gallery-counter').textContent(),/2 \/ 6/);assert.equal(await page.locator('.detail-image').getAttribute('src'),urls[1]);await page.locator('[data-gallery-step="1"]').click();assert.match(await page.locator('.gallery-counter').textContent(),/3 \/ 6/);
  await page.locator('.product-gallery').focus();await page.keyboard.press('ArrowRight');assert.match(await page.locator('.gallery-counter').textContent(),/2 \/ 6/);
  const stage=page.locator('.gallery-stage');await stage.dispatchEvent('pointerdown',{clientX:300});await stage.dispatchEvent('pointerup',{clientX:100});assert.match(await page.locator('.gallery-counter').textContent(),/3 \/ 6/);console.log('PASS customer thumbnails, next/previous, keyboard and swipe navigation');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/adam-gallery-customer.png',fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('.weight-dialog').count(),0);
  // Removing all photos must stay removed after saving and reopening.
  await page.goto(origin+'/admin.html');await page.locator('button[data-id="1"]').waitFor();await page.locator('button[data-id="1"]').click();while(await page.locator('.gallery-edit-item').count())await page.locator('[data-gallery-remove="0"]').click();await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#panel').hidden);assert.equal(products[0].image,'');assert.deepEqual(A.normalize(products[0]).meta.images,[]);await page.locator('button[data-id="1"]').click();assert.equal(await page.locator('.gallery-edit-item').count(),0);console.log('PASS removing all images does not resurrect the old primary');
  assert.deepEqual(errors,[]);console.log('PASS gallery workflow has no uncaught browser errors');
 }finally{await context?.close();await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
