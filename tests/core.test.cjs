const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Adam=require('../store.js');
const base={id:1,name:'بقلاوة',price:10000,category:'الحلويات',description:'فستق',active:true,weight:'كيلو'};
test('Arabic metadata roundtrips and cached normalized data preserves stable IDs',()=>{const meta={productId:'stable',allergens:'مكسرات',flavors:[{label:'شوكولاتة',price:1000}]},p=Adam.normalize({...base,description:Adam.pack(base.description,meta)});assert.equal(p.description,'فستق');assert.deepEqual(p.meta,meta);assert.deepEqual(Adam.normalize(p).meta,meta);assert.equal(Adam.normalize(Adam.encode(p)).meta.productId,'stable')});
test('one validation contract rejects negative prices, duplicate IDs, and unsafe images',()=>{assert.equal(Adam.normalize({...base,price:-1}),null);assert.equal(Adam.normalize({...base,id:null}),null);assert.equal(Adam.normalize({...base,image:'javascript:alert(1)'}).image,'');assert.throws(()=>Adam.normalizeAll([base,base]),/مكررة/);assert.deepEqual(Adam.normalizeAll([]),[])});
test('stable product ID groups variants across name and image edits',()=>{const p=Adam.normalize({...base,meta:{productId:'p'}}),q=Adam.normalize({...base,id:2,name:'اسم جديد',weight:'نصف كيلو',image:'https://example.com/new.jpg',meta:{productId:'p'}});assert.equal(Adam.groups([p,q]).length,1);assert.equal(Adam.groups([p,{...q,meta:{productId:'other'}}]).length,2)});
test('public data excludes hidden products, archive, and store configuration',()=>{const p=Adam.normalize(base);assert.equal(Adam.publicItems([p,{...p,active:false},{...p,meta:{deleted:true}},{...p,category:'__settings__'}]).length,1)});
test('Baghdad hours support overnight opening and explicit pause',()=>{const c={acceptOrders:true,hoursEnabled:true,open:'20:00',close:'02:00'};assert.equal(Adam.isOpen(c,new Date('2026-10-28T00:00:00+03:00')),true);assert.equal(Adam.isOpen(c,new Date('2026-10-28T12:00:00+03:00')),false);assert.equal(Adam.isOpen({...c,acceptOrders:false}),false)});
test('scheduled orders require preparation time, valid hours and bounded future date',()=>{const now=new Date('2026-10-27T12:00:00+03:00'),c={leadMinutes:60,maxAdvanceDays:7,hoursEnabled:true,open:'09:00',close:'23:00'};assert.ok(Adam.validateSchedule('',c,now));assert.ok(Adam.validateSchedule('2026-10-27T12:30',c,now));assert.ok(Adam.validateSchedule('2026-10-28T02:30',c,now));assert.ok(Adam.validateSchedule('2026-12-27T14:00',c,now));assert.equal(Adam.validateSchedule('2026-10-27T14:00',c,now),'')});
test('both manifests and every explicit local HTML asset resolve',()=>{const path=require('node:path'),root=path.resolve(__dirname,'..');for(const name of ['manifest.json','admin-manifest.json']){const m=JSON.parse(fs.readFileSync(path.join(root,name)));for(const icon of m.icons)assert.ok(fs.existsSync(path.join(root,icon.src)),icon.src)}for(const name of ['index.html','admin.html']){const html=fs.readFileSync(path.join(root,name),'utf8');for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const url=m[1].split('?')[0];if(/^(?:https?:|tel:|#)/.test(url))continue;assert.ok(fs.existsSync(path.join(root,url)),name+': '+url)}}});
test('browser scripts and Apps Script compile',()=>{for(const file of ['app.js','store.js','admin.js','viewport.js','sw.js','backend/Code.gs'])new vm.Script(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),{filename:file})});
test('gallery preserves legacy primary, filters unsafe images, deduplicates and caps at eight',()=>{
 const url=n=>'https://example.com/photo-'+n+'.jpg';
 assert.deepEqual(Adam.imageList({image:url(1)}),[url(1)]);
 assert.deepEqual(Adam.imageList({image:url(1),meta:{images:[url(1),' javascript:alert(1)','data:image/png;base64,AA','http://example.com/unsafe',null,42,url(2)]}}),[url(1),url(2)]);
 assert.equal(Adam.imageList({meta:{images:Array.from({length:20},(_,n)=>url(n))}}).length,8);
 assert.deepEqual(Adam.imageList({image:'assets/images/logo.svg',meta:{images:'invalid'}}),['assets/images/logo.svg']);
});
test('ordered product gallery survives description encoding and normalized caching',()=>{
 const images=['https://example.com/main.jpg','https://example.com/second.jpg'];
 const product=Adam.normalize({...base,image:images[0],description:Adam.pack('وصف المنتج',{productId:'photos',images})});
 assert.deepEqual(Adam.imageList(Adam.normalize(Adam.encode(product))),images);
 assert.deepEqual(Adam.imageList(Adam.normalize(product)),images);
 assert.equal(Adam.normalize({...base,image:'',description:Adam.pack('',{images})}).image,images[0]);
 assert.deepEqual(Adam.imageList(Adam.normalize({...base,image:'',description:Adam.pack('',{images:[]})})),[]);
});

test('both entry pages lock mobile scale and load the gesture guard',()=>{for(const name of ['index.html','admin.html']){const html=fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');const viewport=html.match(/name="viewport" content="([^"]+)"/)[1];for(const value of ['initial-scale=1','minimum-scale=1','maximum-scale=1','user-scalable=no'])assert.ok(viewport.includes(value));assert.ok(html.includes('viewport.js?v=mobile-1'))}});
