'use strict';
const $=id=>document.getElementById(id),esc=Adam.esc,money=n=>Number(n).toLocaleString('en-US')+' د.ع';
let products=[],editing=null,busy=false,draftImages=[],original=[],selected=new Set(),lastFocus=null,orders=[],dragged=null,serverBackups=[],serverAudit=[];
const fields=['name','category','description','image','ingredients','allergens','storage','servings','preparation'];
let onlyMissing=false,noticeTimer,imageProcessing=false,galleryGeneration=0;
function notice(text){$('message').textContent=text;$('message').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('message').hidden=true,4500)}
function error(text){$('error').textContent=text;$('error').hidden=false;$('saveError').textContent=text;$('saveError').hidden=false}
function setBusy(value){busy=value;document.querySelectorAll('#save,#delete,.bulk-tools button,#reloadProducts,#settingsForm button,#exportBackup,#importBackup,#add,#addBanner,#form input,#form textarea,#form select,#form button').forEach(b=>b.disabled=value);$('save').textContent=value?'جارٍ الحفظ…':'حفظ المنتج';if(!value)refreshPreview()}
function audit(action,name){const log=Adam.read('adam-audit-v3',[]);log.unshift({at:new Date().toISOString(),actor:'مالك المتجر — هذا الجهاز',action,name});Adam.write('adam-audit-v3',log.slice(0,100))}
function backup(reason){return Adam.snapshot(products,reason)}
function displayed(){const q=$('search').value.trim().toLowerCase();return Adam.groups(products.filter(p=>!p.meta.deleted&&p.category!=='__settings__')).filter(g=>(g[0].name+' '+g[0].category+' '+g[0].description).toLowerCase().includes(q)&&(!onlyMissing||!g[0].description)).sort((a,b)=>(a[0].meta.order||0)-(b[0].meta.order||0))}
function render(){
 const found=displayed();$('summary').textContent=found.length+' منتج · '+products.filter(p=>!p.meta.deleted&&p.category!=='__settings__').length+' وزن / خيار';
 $('descriptionCount').textContent=found.filter(g=>!g[0].description).length+' منتج بلا وصف';
 $('list').innerHTML=found.map(g=>{const p=g[0];return '<article class="card '+(!p.active?'inactive':'')+'" draggable="true" data-group="'+p.id+'"><input type="checkbox" data-select="'+p.id+'" aria-label="تحديد '+esc(p.name)+'" '+(selected.has(p.id)?'checked':'')+'>'+(p.image?'<img class="thumb" src="'+esc(p.image)+'" alt="" loading="lazy" width="64" height="64">':'<div class="thumb">شجرة آدم</div>')+'<div class="details"><h2>'+esc(p.name)+'</h2><small>'+esc(p.category)+' · '+(p.meta.available===false?'نفد مؤقتاً':'متوفر')+(p.active?'':' · مخفي')+'</small><p class="dish-description">'+esc(p.description||'لم تضف وصفاً بعد')+'</p><small>'+g.map(v=>esc(v.weight||'عادي')+': '+money(v.price)).join(' · ')+'</small></div><div class="card-actions"><button data-id="'+p.id+'">تعديل</button><button data-move="'+p.id+'" data-delta="-1" aria-label="تقديم '+esc(p.name)+'">↑</button><button data-move="'+p.id+'" data-delta="1" aria-label="تأخير '+esc(p.name)+'">↓</button></div></article>'}).join('')||'<p>لا توجد منتجات مطابقة.</p>';
 $('categoryOptions').innerHTML=[...new Set(products.filter(p=>!p.meta.deleted&&p.category!=='__settings__').map(p=>p.category))].map(c=>'<option value="'+esc(c)+'"></option>').join('');
 renderBackups();
}
function weightRow(p={weight:'',price:''}){const row=document.createElement('div');row.className='weight-edit';row.dataset.id=p.id??'';row.innerHTML='<label>الوزن أو الحجم<input class="weight-name" maxlength="80"></label><label>سعر الخيار<input class="weight-price" type="number" min="0" max="100000000" step="1" required></label><label class="check-label"><input class="weight-available" type="checkbox"> متوفر</label><button type="button" class="remove-weight">حذف الخيار</button>';row.querySelector('.weight-name').value=p.weight||'';row.querySelector('.weight-price').value=p.price??'';row.querySelector('.weight-available').checked=p.meta?.available!==false;row.querySelector('.remove-weight').onclick=()=>row.remove();$('weightRows').appendChild(row)}
function optionsText(values){return (values||[]).map(v=>v.label+' | '+v.price).join('\n')}
function parseOptions(text){return text.split('\n').filter(s=>s.trim()).map(line=>{const [label,raw='0']=line.split('|').map(s=>s.trim());const price=Number(raw);if(!label||!Number.isSafeInteger(price)||price<0||price>100000000)throw new Error('تحقق من اسم الخيار وسعره');return {label,price}})}
function openForm(id=null){
 if(busy)return;editing=id;galleryGeneration++;imageProcessing=false;draftImages=[];lastFocus=document.activeElement;$('form').reset();$('error').hidden=true;$('saveError').hidden=true;
 const p=products.find(p=>p.id===id);original=p?products.filter(v=>Adam.groupKey(v)===Adam.groupKey(p)):[];
 $('formTitle').textContent=p?'تعديل المنتج والأوزان':'إضافة منتج';$('delete').hidden=!p;
 fields.forEach(k=>$(k).value=(['name','category','description','image'].includes(k)?p?.[k]:p?.meta?.[k])||'');
 $('price').value=p?.price??'';$('active').checked=p?.active!==false;$('available').checked=p?original.some(v=>v.meta.available!==false):true;$('allowMessage').checked=!!p?.meta.allowMessage;
 $('offer').checked=!!p?.offer;$('oldPrice').value=p?.old_price||'';$('badge').value=p?.badge||'';$('badgePlain').value=p?.badge||'';
 $('flavors').value=optionsText(p?.meta.flavors);$('packaging').value=optionsText(p?.meta.packaging);
 draftImages=Adam.imageList(p).map(url=>({url}));$('extraImageUrl').value='';$('weightRows').innerHTML='';(original.length?original:[{}]).forEach(weightRow);toggleOffer();refreshPreview();$('shade').hidden=false;$('panel').hidden=false;document.body.style.overflow='hidden';$('name').focus();
}
function closeForm(){if(busy)return;galleryGeneration++;imageProcessing=false;$('imageFile').disabled=false;$('save').disabled=false;$('shade').hidden=true;$('panel').hidden=true;document.body.style.overflow='';lastFocus?.focus()}
function toggleOffer(){$('offerFields').hidden=!$('offer').checked;$('badgeGeneral').hidden=$('offer').checked}
function refreshPreview(){
 const src=draftImages[0]?.url||draftImages[0]?.data||'';
 $('preview').hidden=!src;$('removeImage').hidden=!src;
 if(src)$('preview').src=src;else $('preview').removeAttribute('src');
 $('image').value=draftImages[0]?.url||'';
 $('galleryCount').textContent=imageProcessing?'جارٍ تجهيز الصور…':draftImages.length+' / '+Adam.MAX_PRODUCT_IMAGES+' صور — الأولى هي الصورة الرئيسية';
 $('imageGallery').innerHTML=draftImages.map((entry,index)=>'<article class="gallery-edit-item"><img src="'+esc(entry.url||entry.data)+'" alt="صورة المنتج '+(index+1)+'" width="100" height="100"><span>'+(index===0?'الصورة الرئيسية':'الصورة '+(index+1))+'</span><div><button type="button" data-gallery-primary="'+index+'" '+(index===0?'disabled':'')+' aria-label="تعيين الصورة '+(index+1)+' رئيسية">رئيسية</button><button type="button" data-gallery-move="'+index+'" data-delta="-1" '+(index===0?'disabled':'')+' aria-label="تقديم الصورة '+(index+1)+'">↑</button><button type="button" data-gallery-move="'+index+'" data-delta="1" '+(index===draftImages.length-1?'disabled':'')+' aria-label="تأخير الصورة '+(index+1)+'">↓</button><button type="button" data-gallery-remove="'+index+'" aria-label="حذف الصورة '+(index+1)+'">حذف</button></div></article>').join('');
 if(busy||imageProcessing)$('imageGallery').querySelectorAll('button').forEach(b=>b.disabled=true);
}
function syncPrimaryInput(){
 const url=$('image').value.trim();
 // An uploaded draft has no URL until it is saved; an empty URL field retains it.
 if(!url&&draftImages[0]?.data)return;
 if(url&&!Adam.validImage(url))throw new Error('استخدم رابط صورة HTTPS صالحاً');
 if(url){if(draftImages.length)draftImages[0]={url};else draftImages.push({url});draftImages=draftImages.filter((p,i)=>i===0||p.url!==url)}
 else if(draftImages.length)draftImages.shift();
 refreshPreview();
}
function addImageUrl(){
 if(busy||imageProcessing)return;
 const url=$('extraImageUrl').value.trim();
 if(!Adam.validImage(url))return error('استخدم رابط صورة HTTPS صالحاً');
 if(draftImages.some(p=>p.url===url))return notice('هذه الصورة مضافة بالفعل');
 if(draftImages.length>=Adam.MAX_PRODUCT_IMAGES)return error('يمكن إضافة حتى '+Adam.MAX_PRODUCT_IMAGES+' صور لكل منتج');
 draftImages.push({url});$('extraImageUrl').value='';$('error').hidden=true;$('saveError').hidden=true;refreshPreview();
}
async function addImageFiles(files){
 if(busy||imageProcessing||!files.length)return;
 if(draftImages.length+files.length>Adam.MAX_PRODUCT_IMAGES){$('imageFile').value='';return error('يمكن إضافة حتى '+Adam.MAX_PRODUCT_IMAGES+' صور لكل منتج. احذف صورة أو اختر عدداً أقل.')}
 const generation=galleryGeneration;imageProcessing=true;$('save').disabled=true;$('imageFile').disabled=true;refreshPreview();
 const failures=[];
 try{for(const file of files){try{const data=await imageFile(file);if(generation!==galleryGeneration)return;if(!draftImages.some(p=>p.data===data))draftImages.push({data});refreshPreview()}catch(e){failures.push(file.name+': '+e.message)}}}
 finally{if(generation===galleryGeneration){imageProcessing=false;$('save').disabled=false;$('imageFile').disabled=false;$('imageFile').value='';refreshPreview();if(failures.length)error(failures.join('، '))}}
}
function imageFile(file){return new Promise((resolve,reject)=>{if(file.size>15000000)return reject(new Error('اختر صورة أصغر من 15 ميغابايت'));const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const scale=Math.min(1,1000/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);let data=canvas.toDataURL('image/jpeg',.72);if(data.length>900000)throw new Error('الصورة كبيرة؛ اختر صورة أصغر');resolve(data)}catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة'))};img.src=url})}
async function save(){
 if(busy||imageProcessing)return;$('error').hidden=true;$('saveError').hidden=true;
 if(!$('name').value.trim()||!$('category').value.trim())return error('اكتب الاسم والقسم');
 try{syncPrimaryInput()}catch(e){return error(e.message)}
 setBusy(true);
 try{
  const variants=[...$('weightRows').children].map(row=>({id:row.dataset.id===''?null:Number(row.dataset.id),weight:row.querySelector('.weight-name').value.trim(),price:row.querySelector('.weight-price').value,available:row.querySelector('.weight-available').checked}));
  if(!variants.length)variants.push({id:original[0]?.id??null,weight:'',price:$('price').value,available:true});
  if(variants.length===1&&variants[0].price==='')variants[0].price=$('price').value;
  if(variants.some(v=>v.price===''||!Number.isSafeInteger(Number(v.price))||Number(v.price)<0||Number(v.price)>100000000||(variants.length>1&&!v.weight)))throw new Error('اكتب وزناً وسعراً صحيحاً لكل خيار');
  if(new Set(variants.map(v=>v.weight)).size!==variants.length)throw new Error('يوجد وزن مكرر');
  const oldPrice=Number($('oldPrice').value)||0,offer=$('offer').checked;if(offer&&variants.some(v=>oldPrice<=Number(v.price)))throw new Error('السعر القديم يجب أن يكون أكبر من جميع أسعار العرض');
  const meta={...(original[0]?.meta||{}),productId:original[0]?.meta.productId||crypto.randomUUID(),available:$('available').checked,allowMessage:$('allowMessage').checked,flavors:parseOptions($('flavors').value),packaging:parseOptions($('packaging').value)};
  ['ingredients','allergens','storage','servings','preparation'].forEach(k=>meta[k]=$(k).value.trim());
  if(draftImages.some(p=>p.data)){
   if((await Adam.capabilities()).version<3)throw new Error('رفع صور الهاتف يحتاج تفعيل تحديث الخادم؛ يمكنك استخدام روابط HTTPS.');
   for(const entry of draftImages){if(!entry.data)continue;const result=await Adam.mutate('uploadImage',{data:entry.data,name:$('name').value.trim()});if(!Adam.validImage(result?.url))throw new Error('تعذر استلام رابط الصورة المرفوعة');entry.url=result.url;delete entry.data;refreshPreview()}
  }
  const imageUrls=Adam.imageList({image:draftImages[0]?.url||'',meta:{images:draftImages.map(p=>p.url)}});meta.images=imageUrls;const imageUrl=imageUrls[0]||'';
  const next=variants.map(v=>({id:v.id,name:$('name').value.trim(),category:$('category').value.trim(),description:$('description').value.trim(),price:Number(v.price),weight:v.weight,image:imageUrl,active:$('active').checked,offer,old_price:oldPrice,badge:offer?$('badge').value.trim():$('badgePlain').value.trim(),meta:{...meta,available:meta.available&&v.available}}));
  products=await Adam.saveGroup(original,next,products);audit('حفظ منتج',next[0].name);Adam.write('adam-menu-cache-v3',{at:Date.now(),items:products});render();setBusy(false);closeForm();notice('تم حفظ المنتج والأوزان');
 }catch(e){error(e.message);setBusy(false);try{products=await Adam.load(true);render()}catch{}}
}
async function archive(){if(busy||!original.length||!confirm('نقل المنتج وجميع أوزانه إلى سلة المحذوفات؟'))return;setBusy(true);try{products=await Adam.saveGroup(original,original.map(p=>({...p,active:false,meta:{...p.meta,deleted:true,deletedAt:new Date().toISOString(),wasActive:p.active}})),products);audit('نقل للمحذوفات',original[0].name);render();setBusy(false);closeForm();notice('نُقل إلى سلة المحذوفات ويمكن استرجاعه')}catch(e){error(e.message);setBusy(false)}}
async function loadProducts(){if(busy)return;setBusy(true);$('summary').textContent='جارٍ تحديث المنتجات…';try{products=await Adam.load(true);render();fillSettings();$('setupHint').hidden=true}catch(e){$('summary').textContent=e.message;$('setupHint').hidden=false}finally{setBusy(false)}}
async function bulk(transform,label){if(busy)return;const ids=new Set(displayed().filter(g=>selected.has(g[0].id)).flatMap(g=>g.map(p=>p.id)));if(!ids.size)return notice('حدد المنتجات أولاً');setBusy(true);backup(label);try{const original=products.filter(p=>ids.has(p.id));products=await Adam.saveGroup(original,original.map(transform),products);audit(label,original.length+' خيار');render();notice('تم الحفظ')}catch(e){notice(e.message);await reloadAfterFailure()}finally{setBusy(false)}}
async function reloadAfterFailure(){try{products=await Adam.load(true);render()}catch{notice('حدّث القائمة للتحقق من آخر تغييرات محفوظة')}}
async function reorder(id,targetId){if(busy||id===targetId)return;const groups=displayed(),from=groups.findIndex(g=>g[0].id===id),to=groups.findIndex(g=>g[0].id===targetId);if(from<0||to<0)return;groups.splice(to,0,groups.splice(from,1)[0]);setBusy(true);try{const before=groups.flat(),next=groups.flatMap((g,i)=>g.map(p=>({...p,meta:{...p.meta,order:i}})));products=await Adam.saveGroup(before,next,products);audit('ترتيب المنتجات','');render()}catch(e){notice(e.message);await reloadAfterFailure()}finally{setBusy(false)}}
function fillSettings(){const s=Adam.settings(products);$('settingWhatsapp').value=s.whatsapp;$('settingAccept').checked=s.acceptOrders;$('settingHours').checked=s.hoursEnabled;$('settingOpen').value=s.open;$('settingClose').value=s.close;$('settingLead').value=s.leadMinutes;$('settingAdvance').value=s.maxAdvanceDays;$('settingZones').value=(s.zones||[]).map(z=>z.name+' | '+z.fee).join('\n');$('settingCategories').value=(s.categoryOrder||[]).join('\n')}
async function saveSettings(e){e.preventDefault();if(busy)return;setBusy(true);try{const settings={whatsapp:$('settingWhatsapp').value.trim(),acceptOrders:$('settingAccept').checked,hoursEnabled:$('settingHours').checked,open:$('settingOpen').value,close:$('settingClose').value,leadMinutes:Number($('settingLead').value),maxAdvanceDays:Number($('settingAdvance').value),zones:parseOptions($('settingZones').value).map(z=>({name:z.label,fee:z.price})),categoryOrder:$('settingCategories').value.split('\n').map(s=>s.trim()).filter(Boolean)};if(settings.hoursEnabled&&settings.open===settings.close)throw new Error('وقت الفتح والإغلاق يجب أن يختلفا');const old=products.find(p=>p.category==='__settings__');products=await Adam.saveGroup(old?[old]:[],[{id:old?.id??null,name:'إعدادات المتجر',category:'__settings__',price:0,active:true,description:'إعدادات المتجر',weight:'',image:'',meta:{settings,productId:'store-settings'}}],products);audit('حفظ إعدادات المتجر','');$('settingsStatus').textContent='تم حفظ الإعدادات للمتجر';render()}catch(err){$('settingsStatus').textContent=err.message}finally{setBusy(false)}}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function renderBackups(){
 $('backupList').innerHTML=serverBackups.map((b,i)=>'<p>نسخة مركزية · '+esc(new Date(b.at).toLocaleString('ar-IQ'))+' · '+esc(b.reason)+' <button data-server-backup="'+i+'">تنزيل</button></p>').join('')+Adam.read('adam-backups-v3',[]).map((b,i)=>'<p>'+esc(new Date(b.at).toLocaleString('ar-IQ'))+' · '+esc(b.reason)+' <button data-download-backup="'+i+'">تنزيل النسخة</button></p>').join('');
 $('trashList').innerHTML=Adam.groups(products.filter(p=>p.meta.deleted)).map(g=>'<p>'+esc(g[0].name)+' · '+g.length+' خيار <button data-restore="'+g[0].id+'">استرجاع</button></p>').join('')||'<p>لا توجد منتجات محذوفة.</p>';
 $('auditList').innerHTML=[...serverAudit,...Adam.read('adam-audit-v3',[])].map(l=>'<p>'+esc(new Date(l.at).toLocaleString('ar-IQ'))+' · '+esc(l.action)+' · '+esc(l.name)+' <small>'+esc(l.actor)+'</small></p>').join('')||'<p>لم تسجل تعديلات على هذا الجهاز بعد.</p>';
}
async function restore(id){if(busy)return;const p=products.find(p=>p.id===id),g=products.filter(v=>Adam.groupKey(v)===Adam.groupKey(p));setBusy(true);try{products=await Adam.saveGroup(g,g.map(p=>({...p,active:p.meta.wasActive!==false,meta:{...p.meta,deleted:false}})),products);audit('استرجاع',p.name);render()}catch(e){notice(e.message)}finally{setBusy(false)}}
async function importBackup(file){if(busy||!file)return;try{const b=JSON.parse(await file.text()),incoming=Adam.normalizeAll(b.items);if(!incoming.length)throw new Error('النسخة لا تحتوي منتجات');if(!confirm('استيراد '+incoming.length+' خيار؟ ستُحفظ نسخة من الحالة الحالية قبل التعديل.'))return;setBusy(true);backup('قبل استيراد النسخة');products=await Adam.saveGroup(products,incoming,products);audit('استيراد نسخة',file.name);render();fillSettings();notice('اكتمل الاستيراد')}catch(e){notice(e.message);await reloadAfterFailure()}finally{setBusy(false);$('importBackup').value=''}}
const statuses=['بانتظار تأكيد المتجر','مقبول','قيد التجهيز','جاهز','مكتمل','ملغي'];
async function loadOrders(){const caps=await Adam.capabilities();if(caps.version<3){$('ordersHint').textContent='تسجيل الطلبات بين الأجهزة وتحديث حالاتها يحتاج تفعيل تحديث Google Apps Script المرفق. الطلبات الحالية تُرسل عبر واتساب.';orders=Adam.read('adam-orders-v3',[])}else{try{const r=await Adam.jsonp({action:'listOrders'});if(!r.ok)throw new Error(r.error);orders=r.result||[];$('ordersHint').textContent='طلبات مسجلة بانتظار مراجعتك. أرسل تأكيد القبول للزبون عبر واتساب.'}catch(e){$('ordersHint').textContent=e.message}}
 $('orderList').innerHTML=orders.map(o=>'<article class="order-card"><h3>'+esc(o.id)+'</h3><p>'+esc(o.name)+' · '+esc(o.phone)+'</p><p>'+esc(o.address||o.mode)+' · '+esc(o.requestedAt)+'</p><p>'+esc(o.note||'')+'</p><ul>'+(o.items||[]).map(i=>'<li>'+esc(i.name)+' '+esc(i.weight||'')+' × '+i.qty+' · '+esc(i.custom||'')+'</li>').join('')+'</ul><strong>'+money(o.total)+'</strong><label>حالة الطلب<select data-order="'+esc(o.id)+'">'+statuses.map(s=>'<option '+(s===o.status?'selected':'')+'>'+s+'</option>').join('')+'</select></label></article>').join('')||'<p>لا توجد طلبات مسجلة.</p>';
 const completed=orders.filter(o=>o.status==='مكتمل');$('stats').textContent='الطلبات المسجلة: '+orders.length+' · المكتملة: '+completed.length+' · قيمة المكتملة: '+money(completed.reduce((s,o)=>s+Number(o.total||0),0));
 const counts=new Map();for(const o of completed)for(const i of o.items||[])counts.set(i.name,(counts.get(i.name)||0)+Number(i.qty));const top=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5);const stats=Adam.read('adam-stats-v3',{});$('stats').insertAdjacentHTML('beforeend','<p>الأكثر طلباً في الطلبات المكتملة: '+(top.map(([n,q])=>esc(n)+' ('+q+')').join('، ')||'لا توجد بيانات بعد')+'</p><p>مشاهدات المنتجات على هذا الجهاز: '+Object.values(stats).reduce((n,s)=>n+s.views,0)+'</p>');
 if(caps.version>=3){try{const r=await Adam.jsonp({action:'stats'});if(r.ok&&Array.isArray(r.result))$('stats').insertAdjacentHTML('beforeend','<h4>الأكثر مشاهدة خلال 30 يوماً</h4><p>'+r.result.slice(0,5).map(p=>esc(p.name)+': '+Number(p.views)+' مشاهدة تفاصيل').join('، ')+'</p>')}catch{}}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[id^="tab-"]').forEach(s=>s.hidden=s.id!=='tab-'+b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('selected',t===b));if(b.dataset.tab==='orders')loadOrders();if(b.dataset.tab==='backups'){renderBackups();loadServerArchives()}});
$('list').onclick=e=>{const b=e.target.closest('[data-id]');if(b)return openForm(Number(b.dataset.id));const move=e.target.closest('[data-move]');if(move){const g=displayed(),i=g.findIndex(g=>g[0].id===Number(move.dataset.move)),target=g[i+Number(move.dataset.delta)];if(target)reorder(Number(move.dataset.move),target[0].id)}};
$('list').onchange=e=>{if(e.target.matches('[data-select]')){const id=Number(e.target.dataset.select);e.target.checked?selected.add(id):selected.delete(id)}};
$('list').ondragstart=e=>{dragged=Number(e.target.closest('[data-group]')?.dataset.group)};$('list').ondragover=e=>e.preventDefault();$('list').ondrop=e=>{e.preventDefault();const target=Number(e.target.closest('[data-group]')?.dataset.group);if(target)reorder(dragged,target)};
$('selectAll').onchange=()=>{displayed().forEach(g=>$('selectAll').checked?selected.add(g[0].id):selected.delete(g[0].id));render()};
$('bulkAvailable').onclick=()=>bulk(p=>({...p,meta:{...p.meta,available:true}}),'توفير منتجات');$('bulkUnavailable').onclick=()=>bulk(p=>({...p,meta:{...p.meta,available:false}}),'نفاد منتجات');
$('bulkPrices').onclick=()=>{const percent=Number($('pricePercent').value);if(!Number.isFinite(percent)||percent<=-100||percent>1000)return notice('أدخل نسبة بين -99 و1000');if(!confirm('تعديل أسعار المنتجات المحددة بنسبة '+percent+'%؟'))return;bulk(p=>({...p,price:Math.round(p.price*(1+percent/100))}),'تعديل أسعار جماعي')};
$('search').oninput=render;$('missingDescriptions').onclick=()=>{onlyMissing=!onlyMissing;$('missingDescriptions').setAttribute('aria-pressed',onlyMissing);render()};
$('add').onclick=()=>openForm();$('addBanner').onclick=()=>{openForm();$('name').value='عرض جديد';$('category').value='سلايدر العروض';$('price').value='0';$('weightRows').innerHTML='';weightRow({weight:'',price:0})};
$('addWeight').onclick=()=>weightRow();$('save').onclick=save;$('delete').onclick=archive;$('close').onclick=closeForm;$('shade').onclick=closeForm;$('form').onsubmit=e=>{e.preventDefault();save()};$('offer').onchange=toggleOffer;
$('image').onchange=()=>{if(busy||imageProcessing)return;try{syncPrimaryInput()}catch(e){error(e.message)}};
$('addImageUrl').onclick=addImageUrl;$('extraImageUrl').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addImageUrl()}};
$('removeImage').onclick=()=>{if(busy||imageProcessing)return;draftImages.shift();refreshPreview()};
$('imageFile').onchange=e=>addImageFiles([...e.target.files]);
$('imageGallery').onclick=e=>{if(busy||imageProcessing)return;const remove=e.target.closest('[data-gallery-remove]'),primary=e.target.closest('[data-gallery-primary]'),move=e.target.closest('[data-gallery-move]');if(remove)draftImages.splice(Number(remove.dataset.galleryRemove),1);else if(primary){const index=Number(primary.dataset.galleryPrimary);draftImages.unshift(draftImages.splice(index,1)[0])}else if(move){const index=Number(move.dataset.galleryMove),target=index+Number(move.dataset.delta);if(target>=0&&target<draftImages.length)[draftImages[index],draftImages[target]]=[draftImages[target],draftImages[index]]}else return;refreshPreview()};
$('reloadProducts').onclick=loadProducts;$('settingsForm').onsubmit=saveSettings;$('exportBackup').onclick=()=>download('adam-backup-'+Date.now()+'.json',backup('تصدير يدوي'));$('importBackup').onchange=e=>importBackup(e.target.files[0]);
$('backupList').onclick=async e=>{const remote=e.target.closest('[data-server-backup]');if(remote){try{const b=serverBackups[Number(remote.dataset.serverBackup)],r=await Adam.jsonp({action:'backup',fileId:b.fileId});if(!r.ok)throw new Error(r.error);download('adam-server-backup.json',r.result)}catch(err){notice(err.message)}return}const b=e.target.closest('[data-download-backup]');if(b)download('adam-backup.json',Adam.read('adam-backups-v3',[])[Number(b.dataset.downloadBackup)])};$('trashList').onclick=e=>{const b=e.target.closest('[data-restore]');if(b)restore(Number(b.dataset.restore))};
$('refreshOrders').onclick=loadOrders;$('exportOrders').onclick=()=>download('adam-orders.json',orders);$('orderList').onchange=async e=>{if(!e.target.matches('[data-order]'))return;const target=e.target;target.disabled=true;try{const caps=await Adam.capabilities();if(caps.version<3)throw new Error('تحديث الحالة يحتاج تفعيل تحديث الخادم');await Adam.mutate('updateOrder',{id:target.dataset.order,status:target.value});await loadOrders()}catch(e){notice(e.message)}finally{target.disabled=false}};
document.addEventListener('keydown',e=>{if($('panel').hidden)return;if(e.key==='Escape')closeForm();if(e.key==='Tab'){const nodes=[...$('panel').querySelectorAll('button,input,textarea,select')].filter(n=>!n.disabled&&!n.closest('[hidden]')&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
loadProducts();Adam.capabilities().then(c=>$('backendHint').textContent=c.version>=3?'الخادم يدعم رفع الصور والطلبات والحفظ الجماعي.':'رفع الصور وسجل الطلبات المشترك والنسخ المركزية تحتاج نشر backend/Code.gs. النسخ المحلية والتصدير والاسترجاع متاحة الآن.');

async function loadServerArchives(){if((await Adam.capabilities()).version<3)return;const results=await Promise.allSettled([Adam.jsonp({action:'backups'}),Adam.jsonp({action:'audit'})]);if(results[0].status==='fulfilled'&&results[0].value.ok)serverBackups=results[0].value.result;if(results[1].status==='fulfilled'&&results[1].value.ok)serverAudit=results[1].value.result;renderBackups()}
