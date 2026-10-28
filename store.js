/* Shared data contract. No passwords: the owner uses the public administration URL. */
(function(root){
 'use strict';
 const API='https://script.google.com/macros/s/AKfycbyVRN3Zb-8ttbA9wqBmae8Zzofdw6f7zN3jFGs1wRtjMGG51rWM5KSCL4bLTWMrznpC/exec';
 const SHEET='https://docs.google.com/spreadsheets/d/10oltsuuqDYiIXNPSiUMEgdXuJ2CF_eWQN9ZK3hdDt30/gviz/tq';
 const DEFAULTS={whatsapp:'9647706848869',acceptOrders:true,hoursEnabled:false,open:'09:00',close:'23:00',leadMinutes:0,maxAdvanceDays:30,zones:[],categoryOrder:[]};
 const MAX_PRODUCT_IMAGES=8;
 function validImage(url){return typeof url==='string'&&(/^(https:\/\/[^\s]+)$/i.test(url)||/^assets\/images\/[\w./-]+$/i.test(url))}
 function imageList(product){
  const values=[product?.image,...(Array.isArray(product?.meta?.images)?product.meta.images:[])];
  return [...new Set(values.filter(v=>typeof v==='string').map(v=>v.trim()).filter(validImage))].slice(0,MAX_PRODUCT_IMAGES);
 }
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
 const write=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data));return true}catch{return false}};
 function unpack(raw){
  const text=String(raw||''),match=text.match(/\n?\[adam-v3:([A-Za-z0-9+/=]+)\]$/);
  if(!match)return {text,meta:{}};
  try{return {text:text.slice(0,match.index).trim(),meta:JSON.parse(decodeURIComponent(escape(atob(match[1]))))}}catch{return {text,meta:{}}}
 }
 function pack(text,meta){return String(text||'').trim()+'\n[adam-v3:'+btoa(unescape(encodeURIComponent(JSON.stringify(meta))))+']'}
 function normalize(raw){
  if(!raw||raw.id===null||raw.id===''||raw.price===null||raw.price==='')return null;
  const id=Number(raw.id),price=Number(raw.price),name=String(raw.name||'').trim(),category=String(raw.category||'').trim();
  if(!Number.isSafeInteger(id)||id<0||!Number.isSafeInteger(price)||price<0||!name||!category)return null;
  const decoded=unpack(raw.description),text=decoded.text,meta={...(raw.meta||{}),...decoded.meta};
  const images=imageList({...raw,meta});if(Array.isArray(meta.images))meta.images=images;
  return {...raw,id,price,name,category,description:text,sourceDescription:raw.sourceDescription??String(raw.description||''),meta,image:images[0]||'',active:raw.active!==false&&String(raw.active).toLowerCase()!=='false',offer:raw.offer===true||String(raw.offer).toLowerCase()==='true',old_price:Math.max(0,Number(raw.old_price)||0),weight:String(raw.weight||'').trim()};
 }
 function normalizeAll(rows){
  if(!Array.isArray(rows))throw new Error('استجابة المنتجات غير صالحة');
  const items=rows.map(normalize).filter(Boolean);
  if(new Set(items.map(p=>p.id)).size!==items.length)throw new Error('توجد معرفات منتجات مكررة');
  if(rows.length&&!items.length)throw new Error('تعذر قراءة بيانات المنتجات');
  return items;
 }
 function groupKey(p){return p.meta?.productId|| (p.weight?'legacy:'+JSON.stringify([p.name,p.category,p.image||'']):'item:'+p.id)}
 function groups(items){const found=new Map();for(const p of items){const k=groupKey(p);if(!found.has(k))found.set(k,[]);found.get(k).push(p)}return [...found.values()]}
 function settings(items){const p=items.find(p=>p.category==='__settings__'&&!p.meta.deleted);return {...DEFAULTS,...(p?.meta.settings||{})}}
 const publicItems=items=>items.filter(p=>p.active&&!p.meta.deleted&&p.category!=='__settings__');
 function encode(p){const {meta,sourceDescription,...raw}=p;return {...raw,description:pack(p.description,meta||{})}}
 let counter=0;
 function jsonp(params,url=API,sheet=false,timeout=10000){return new Promise((resolve,reject)=>{
  const callback='adam_'+Date.now()+'_'+(++counter),script=document.createElement('script');let settled=false;
  const finish=(err,data)=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();root[callback]=()=>{};setTimeout(()=>delete root[callback],60000);err?reject(err):resolve(data)};
  const timer=setTimeout(()=>finish(new Error('تأخر الاتصال بالخادم. أعد المحاولة.')),timeout);
  root[callback]=data=>finish(null,data);script.onerror=()=>finish(new Error('تعذر الاتصال بالخادم'));
  script.src=url+'?'+new URLSearchParams({...params,...(sheet?{tqx:'out:json;responseHandler:'+callback}:{callback}),v:Date.now()});document.head.appendChild(script);
 })}
 async function fromSheet(){
  const r=await jsonp({sheet:'المنتجات',tq:'select A,B,C,D,E,F,G,H,I,J,K where B is not null'},SHEET,true);
  if(r.status!=='ok'||!Array.isArray(r.table?.rows))throw new Error('تعذر قراءة المنتجات');
  return normalizeAll(r.table.rows.map(row=>{const c=row.c||[],v=i=>c[i]?.v;return {id:v(0),name:v(1),price:v(2),category:v(3),description:v(4),image:v(5),badge:v(6),active:v(7),old_price:v(8),offer:v(9),weight:v(10)}}));
 }
 async function load(admin=false){
  try{
   const r=await jsonp({action:admin?'listProducts':'products'});
   const rows=admin?r.result:r.products;
   if(r.ok===false||!Array.isArray(rows))throw new Error(r.error||'استجابة غير صالحة');
   const items=normalizeAll(rows);write('adam-menu-cache-v3',{at:Date.now(),items});return items;
  }catch(error){return fromSheet().then(items=>{write('adam-menu-cache-v3',{at:Date.now(),items});return items}).catch(()=>{throw error})}
 }
 let capabilityPromise;
 function capabilities(){return capabilityPromise ||=jsonp({action:'capabilities'},API,false,5000).then(r=>r.version>=3?r:{version:1}).catch(()=>({version:1}))}
 async function mutate(action,...args){
  const requestId=crypto.randomUUID();
  await fetch(API,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,args,requestId})});
  const until=Date.now()+60000;
  while(Date.now()<until){
   await new Promise(r=>setTimeout(r,650));
   const r=await jsonp({action:'status',requestId},API,false,8000);
   if(r.pending)continue;
   if(!r.ok)throw new Error(r.error||'تعذر حفظ التغيير');
   if(r.result?.refreshProducts){const fresh=await jsonp({action:'listProducts'});if(!fresh.ok||!Array.isArray(fresh.result))throw new Error('تم الحفظ؛ تعذر تحديث القائمة.');return {products:fresh.result}}
   return r.result;
  }
  throw new Error('لم يصل تأكيد الحفظ؛ حدّث القائمة للتحقق قبل إعادة المحاولة.');
 }
 function snapshot(items,reason){
  const backup={at:new Date().toISOString(),reason,items:items.map(encode)};
  const all=read('adam-backups-v3',[]);all.unshift(backup);write('adam-backups-v3',all.slice(0,10));return backup;
 }
 async function saveGroup(original,next,all){
  snapshot(all,'قبل حفظ المنتج');
  const caps=await capabilities();
  if(caps.version>=3){const r=await mutate('saveGroup',{originalIds:original.map(p=>p.id),original:original.map(p=>({...encode(p),description:p.sourceDescription??encode(p).description})),products:next.map(encode)});return normalizeAll(r.products)}
  // Legacy API: stable row IDs, saves first, reversible archive last. Never delete a reused ID.
  let latest=all;
  for(const p of next){const r=await mutate('saveProduct',encode(p));latest=normalizeAll(r.products||r)}
  const retained=new Set(next.filter(p=>p.id!=null).map(p=>p.id));
  for(const p of original.filter(p=>!retained.has(p.id))){const r=await mutate('saveProduct',encode({...p,active:false,meta:{...p.meta,deleted:true,deletedAt:new Date().toISOString()}}));latest=normalizeAll(r.products||r)}
  return latest;
 }
 function isOpen(config,now=new Date()){
  if(config.acceptOrders===false)return false;
  if(!config.hoursEnabled)return true;
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  return config.open<=config.close?time>=config.open&&time<config.close:time>=config.open||time<config.close;
 }
 function validateSchedule(value,config,now=new Date()){
  if(!value)return 'اختر موعد الاستلام أو التوصيل.';
  const date=new Date(value+'+03:00');
  if(!Number.isFinite(date.getTime())||date.getTime()<now.getTime()+Math.max(0,Number(config.leadMinutes)||0)*60000)return 'اختر موعداً لاحقاً يراعي وقت التجهيز.';
  if(date.getTime()>now.getTime()+(Number(config.maxAdvanceDays)||30)*86400000)return 'الموعد بعيد؛ تواصل مع المتجر لترتيبه.';
  if(config.hoursEnabled&&!isOpen({...config,acceptOrders:true},date))return 'الموعد خارج ساعات العمل المحددة.';
  return '';
 }
 root.Adam={API,SHEET,DEFAULTS,MAX_PRODUCT_IMAGES,validImage,imageList,esc,read,write,pack,unpack,normalize,normalizeAll,groupKey,groups,settings,publicItems,encode,jsonp,load,capabilities,mutate,snapshot,saveGroup,isOpen,validateSchedule};
 if(typeof module!=='undefined')module.exports=root.Adam;
})(typeof window!=='undefined'?window:globalThis);
