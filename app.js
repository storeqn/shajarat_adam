'use strict';
const $=selector=>document.querySelector(selector);
const byId=id=>document.getElementById(id);
const cachedMenu=Adam.read('adam-menu-cache-v3',null);
let allProducts=(cachedMenu?.items||MENU).map(Adam.normalize).filter(Boolean);
let storeSettings=Adam.settings(allProducts);
let liveConfirmed=false,menuLoading=true,lastLiveAt=0,submitting=false;
let menuItems=Adam.publicItems(allProducts).filter(p=>p.category!=='سلايدر العروض');
let itemMap=new Map(menuItems.map(item=>[item.id,item]));
const storageKey='shajarat-adam-cart-v2';
let active='الكل';
let cart={};
let lastFocus=null;
try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
    for(const [id,qty] of Object.entries(saved)){
      if(Number.isSafeInteger(Number(id))&&Number.isInteger(qty)&&qty>0&&qty<=99) cart[id]=qty;
    }
  }
}catch(_error){cart={}}
const fmt=value=>Number(value).toLocaleString('en-US')+' د.ع';
const soundKey='shajarat-adam-sound-enabled';
let soundEnabled=false,audioContext;
try{soundEnabled=localStorage.getItem(soundKey)==='true'}catch(_error){}
function playSound(kind='tap'){
  if(!soundEnabled)return;
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  if(!AudioEngine)return;
  try{
    audioContext ||=new AudioEngine();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const now=audioContext.currentTime;
    const tones=kind==='confirm'?[[620,0,.08],[780,.07,.08],[990,.14,.12]]:kind==='add'?[[580,0,.07],[780,.07,.1]]:[[540,0,.065]];
    tones.forEach(([frequency,delay,duration])=>{
      const tone=audioContext.createOscillator(),volume=audioContext.createGain(),start=now+delay;
      tone.type='sine';tone.frequency.setValueAtTime(frequency,start);
      volume.gain.setValueAtTime(.0001,start);
      volume.gain.exponentialRampToValueAtTime(kind==='tap'?.025:.035,start+.012);
      volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
      tone.connect(volume);volume.connect(audioContext.destination);
      tone.start(start);tone.stop(start+duration+.015);
    });
  }catch(_error){}
}
function updateSoundToggle(){
  byId('soundToggle').setAttribute('aria-pressed',String(soundEnabled));
  byId('soundToggleText').textContent=soundEnabled?'الصوت يعمل':'الصوت مكتوم';
}
function ordersOpen(){return liveConfirmed&&Adam.isOpen(storeSettings)}
function updateOpeningStatus(){
 const open=ordersOpen();
 byId('openingStatus').textContent=!liveConfirmed?'جارٍ التحقق من المنيو':open?'نستقبل طلباتكم':'الطلبات متوقفة حالياً';
 byId('openingStatus').classList.toggle('is-open',open);
 byId('orderHoursNotice').textContent=!liveConfirmed?'يجب تحديث الأسعار والتوافر قبل إرسال الطلب.':open?'أرسل الرسالة عبر واتساب وانتظر قبول المتجر لتأكيد الطلب.':storeSettings.hoursEnabled?'ساعات استقبال الطلبات: '+storeSettings.open+' — '+storeSettings.close+' بتوقيت بغداد':'استقبال الطلبات متوقف مؤقتاً.';
 byId('confirmOrder').disabled=!open||submitting;
 byId('confirmOrderText').textContent='إرسال الطلب عبر واتساب';
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value).normalize('NFKC').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const favoriteKey='shajarat-adam-favorites-v1';
let favoriteIds=new Set();
try{const saved=JSON.parse(localStorage.getItem(favoriteKey)||'[]');if(Array.isArray(saved))favoriteIds=new Set(saved.filter(id=>Number.isSafeInteger(id)||typeof id==='string'))}catch(_error){}
const menuCategories=()=>['الكل',...(favoriteIds.size?['المفضلة']:[]),...(menuItems.some(item=>item.offer)?['العروض']:[]),...new Set(menuItems.map(item=>item.category))];
let categories=menuCategories();
const placeholder=item=>'<div class="food-placeholder" aria-hidden="true"><img src="assets/images/logo.svg" alt="" loading="lazy"><span class="submark">'+escapeHtml(item.category)+'</span></div>';
const cardPhotoIndices=new Map();
function card(item){
  const images=Adam.imageList(item),index=(cardPhotoIndices.get(item.id)||0)%Math.max(1,images.length),src=productImageSource(images[index]||'',640);
  const picture=src?'<div class="card-photos" data-photo-product="'+item.id+'" data-photo-index="'+index+'"><button type="button" class="card-photo-open" data-view-product="'+item.id+'" aria-label="عرض صور '+escapeHtml(item.name)+'"><img class="food-image" src="'+escapeHtml(src)+'" alt="'+escapeHtml(item.name)+'" width="480" height="360" loading="lazy" decoding="async" draggable="false"></button>'+(images.length>1?'<span class="card-photo-count" aria-live="polite"><span class="card-photo-counter">'+(index+1)+' / '+images.length+'</span> صور</span><button type="button" class="card-photo-arrow previous" data-card-step="-1" aria-label="الصورة السابقة لـ '+escapeHtml(item.name)+'">→</button><button type="button" class="card-photo-arrow next" data-card-step="1" aria-label="الصورة التالية لـ '+escapeHtml(item.name)+'">←</button>':'')+'</div>':placeholder(item);
  const description=item.description?'<p class="description">'+escapeHtml(item.description)+'</p>':'';
  const badge=(item.meta?.available===false?'<span class="badge sold-out">نفد مؤقتاً</span>':'')+(item.offer?'<span class="badge">عرض خاص</span>':'')+(item.badge?'<span class="badge">'+escapeHtml(item.badge)+'</span>':'');
  const variants=productVariants(item);
  const hasWeights=variants.some(v=>String(v.weight||'').trim());
  const minPrice=Math.min(...variants.map(v=>v.price));
  const priceText=variants.length>1?'<span class="price-prefix">يبدأ من</span> '+fmt(minPrice):fmt(item.price);
  const previous=item.offer&&item.old_price>item.price?'<del class="old-price">'+fmt(item.old_price)+'</del>':'';
  return '<article class="card sweets-card" data-product="'+item.id+'">'+picture+'<button type="button" class="favorite'+(isFavorite(item)?' is-favorite':'')+'" data-favorite="'+item.id+'" aria-pressed="'+isFavorite(item)+'" aria-label="إضافة للمفضلة: '+escapeHtml(item.name)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.5c0 4.5-8.8 11-8.8 11s-8.8-6.5-8.8-11a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/></svg></button><div class="card-info"><h3>'+escapeHtml(item.name)+'</h3><div class="card-meta">'+escapeHtml(item.category)+badge+'</div>'+description+'<div class="price">'+priceText+previous+'</div><button class="sweets-order-button" type="button" data-choose="'+item.id+'" '+(variants.every(v=>v.meta?.available===false)?'disabled':'')+'>'+ (variants.every(v=>v.meta?.available===false)?'نفد مؤقتاً':hasWeights?'التفاصيل واختيار الوزن':'التفاصيل وإضافة للسلة')+' <span aria-hidden="true">＋</span></button></div></article>';
}
function categoryIcon(category){const heart=category==='المفضلة';return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(heart?'<path d="M20.8 8.5c0 4.5-8.8 11-8.8 11s-8.8-6.5-8.8-11a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/>':'<path d="M5 10h14l-2 10H7L5 10ZM5 10c0-4 3-7 7-7s7 3 7 7M9 14h6"/>')+'</svg>'}
function renderCats(){
  byId('cats').innerHTML=categories.map(cat=>'<button type="button" class="cat'+(active===cat?' active':'')+'" data-category="'+escapeHtml(cat)+'" aria-pressed="'+(active===cat)+'">'+categoryIcon(cat)+'<span>'+escapeHtml(cat)+'</span></button>').join('');
}
function sameVariantGroup(a,b){return Adam.groupKey(a)===Adam.groupKey(b)}
function productVariants(item){return menuItems.filter(p=>sameVariantGroup(p,item))}
function isFavorite(item){return favoriteIds.has(Adam.groupKey(item))||productVariants(item).some(v=>favoriteIds.has(v.id))}
function uniqueProducts(items){return Adam.groups(items).map(g=>g[0])}
let sharedOpened=false;
function focusSharedProduct(){
 if(sharedOpened)return;
 const id=Number(new URLSearchParams(location.search).get('product'));
 const item=itemMap.get(id);if(!item)return;
 sharedOpened=true;active=item.category;byId('q').value='';renderCats();renderMenu();
 requestAnimationFrame(()=>{const representative=uniqueProducts(menuItems).find(p=>sameVariantGroup(p,item));const el=document.querySelector('#menu [data-product="'+representative?.id+'"]');el?.scrollIntoView({block:'center',behavior:'smooth'});el?.classList.add('shared-product-highlight');openWeightChoice(id)});
}
function renderMenu(){
  const query=normalize(byId('q').value);
  const terms=query.split(' ').filter(Boolean);
  const filtered=uniqueProducts(menuItems.filter(item=>{
    const text=normalize(item.name+' '+item.category+' '+(item.description||''));
    return (active==='الكل'||(active==='العروض'?item.offer:active==='المفضلة'?isFavorite(item):item.category===active))&&terms.every(term=>text.includes(term));
  }));
  const grouped=active==='الكل'&&!query;
  const container=byId('menu');
  container.classList.toggle('has-groups',grouped);
  if(grouped){
    container.innerHTML=categories.filter(cat=>cat!=='الكل'&&cat!=='العروض'&&cat!=='المفضلة').map(cat=>{
      const items=filtered.filter(item=>item.category===cat);
      if(!items.length)return '';
      return '<section class="menu-group" aria-label="'+escapeHtml(cat)+'"><div class="menu-group-head"><h3>'+escapeHtml(cat)+'</h3><button type="button" data-category="'+escapeHtml(cat)+'">عرض القسم ←</button></div><div class="menu-group-grid">'+items.map(card).join('')+'</div></section>';
    }).join('');
  }else container.innerHTML=filtered.map(card).join('');
  byId('sectionTitle').textContent=active==='الكل'?'كل الحلويات':active;
  byId('count').textContent=filtered.length+' صنف';
  byId('empty').hidden=filtered.length>0||menuLoading;
  byId('resetSearch').hidden=!byId('q').value;
  byId('popularSection').hidden=active!=='الكل'||!!query||!uniqueProducts(menuItems.filter(item=>item.badge||item.offer)).length;
}
let customLines=Adam.read('adam-custom-cart-v3',{});
if(!customLines||typeof customLines!=='object'||Array.isArray(customLines))customLines={};
for(const [key,row] of Object.entries(customLines))if(!row||!Number.isSafeInteger(row.id)||!Number.isInteger(row.qty)||row.qty<1||row.qty>99||!Number.isSafeInteger(row.extra)||row.extra<0||typeof row.custom!=='string')delete customLines[key];
function entries(){return [...Object.entries(cart).map(([id,qty])=>({key:id,item:itemMap.get(Number(id)),qty})),...Object.entries(customLines).map(([key,row])=>({key,item:itemMap.has(row.id)?{...itemMap.get(row.id),price:itemMap.get(row.id).price+row.extra,custom:row.custom}:null,qty:row.qty}))].filter(row=>row.item)}
function totals(){return entries().reduce((v,row)=>({qty:v.qty+row.qty,price:v.price+row.item.price*row.qty}),{qty:0,price:0})}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(cart));Adam.write('adam-custom-cart-v3',customLines)}catch(_error){}}
function updateCart(){
  const {qty,price}=totals();
  byId('cartCount').textContent=qty;byId('floatCount').textContent=qty;
  byId('floatTotal').textContent=fmt(price);byId('cartTotal').textContent=fmt(price);
  byId('floatingCart').hidden=qty===0;
  document.body.classList.toggle('has-cart',qty>0);updateDeliveryTotal();
  persist();
}
function renderCart(){
  const rows=entries();
  byId('cartEmpty').hidden=rows.length>0;
  byId('cartItems').innerHTML=rows.map(({key,item,qty})=>'<div class="cart-line"><div><h3>'+escapeHtml(item.name)+'</h3>'+(item.custom?'<p class="cart-custom">'+escapeHtml(item.custom)+'</p>':'')+(item.weight?'<span class="cart-weight">الوزن: '+escapeHtml(item.weight)+'</span>':'')+'<small>'+fmt(item.price)+' × '+qty+' = '+fmt(item.price*qty)+'</small></div><div class="qty"><button type="button" data-change="'+escapeHtml(key)+'" data-delta="-1" aria-label="تقليل '+escapeHtml(item.name)+'">−</button><b>'+qty+'</b><button type="button" data-change="'+escapeHtml(key)+'" data-delta="1" aria-label="زيادة '+escapeHtml(item.name)+'">+</button><button type="button" class="remove" data-remove="'+escapeHtml(key)+'" aria-label="حذف '+escapeHtml(item.name)+'">×</button></div></div>').join('');
}
let toastTimer;
function toast(message){
  const box=byId('toast');box.textContent=message;box.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),2100);
}
function add(id){
  if(!liveConfirmed||!itemMap.has(id)||itemMap.get(id).meta?.available===false)return;
  cart[id]=Math.min(99,(cart[id]||0)+1);updateCart();renderCart();toast('تمت إضافة '+itemMap.get(id).name);
}
function optionList(label,key,values){return values?.length?'<label>'+label+'<select name="'+key+'"><option value="">بدون اختيار</option>'+values.map((v,i)=>'<option value="'+i+'">'+escapeHtml(v.label)+(v.price?' — '+fmt(v.price):'')+'</option>').join('')+'</select></label>':''}
function productImageSource(url,width=1000){
 if(typeof ADAM_IMAGES!=='undefined'&&ADAM_IMAGES[url])return ADAM_IMAGES[url];
 if(/^https:\/\/lh3\.googleusercontent\.com\/d\//i.test(url))return url.replace(/=w\d+$/,'')+'=w'+width;
 return url;
}
function productGallery(item){
 const images=Adam.imageList(item);if(!images.length)return '';
 const navigation=images.length>1?'<div class="gallery-navigation"><button type="button" data-gallery-step="-1" aria-label="الصورة السابقة">→</button><span class="gallery-counter" aria-live="polite">1 / '+images.length+'</span><button type="button" data-gallery-step="1" aria-label="الصورة التالية">←</button></div>':'';
 const thumbnails=images.length>1?'<div class="gallery-thumbnails" aria-label="اختيار صورة المنتج">'+images.map((url,index)=>'<button type="button" data-gallery-index="'+index+'" aria-label="عرض الصورة '+(index+1)+'" aria-pressed="'+(index===0)+'"><img src="'+escapeHtml(productImageSource(url,120))+'" alt="" width="64" height="64" loading="lazy" decoding="async"></button>').join('')+'</div>':'';
 return '<section class="product-gallery" aria-label="صور '+escapeHtml(item.name)+'" tabindex="0"><div class="gallery-stage"><img class="detail-image" src="'+escapeHtml(productImageSource(images[0]))+'" alt="'+escapeHtml(item.name)+' — الصورة 1" width="480" height="360" decoding="async" draggable="false"><p class="gallery-feedback" role="status" hidden></p>'+navigation+'</div>'+thumbnails+'</section>';
}
function cycleCardPhoto(container,delta){
 const item=itemMap.get(Number(container.dataset.photoProduct));if(!item)return;
 const images=Adam.imageList(item);if(images.length<2)return;
 const index=(Number(container.dataset.photoIndex)+delta+images.length)%images.length;
 container.dataset.photoIndex=index;cardPhotoIndices.set(item.id,index);
 const image=container.querySelector('.food-image');if(image){delete image.dataset.fallback;image.classList.remove('image-unavailable');image.src=productImageSource(images[index],640);image.alt=item.name+' — الصورة '+(index+1)}
 container.querySelector('.card-photo-counter').textContent=(index+1)+' / '+images.length;
}
let cardSwipe=null;
document.addEventListener('pointerdown',event=>{const container=event.target.closest('.card-photos');if(container&&!event.target.closest('[data-card-step]'))cardSwipe={container,x:event.clientX,y:event.clientY,id:event.pointerId};else cardSwipe=null});
document.addEventListener('pointercancel',()=>{cardSwipe=null});
document.addEventListener('pointerup',event=>{if(!cardSwipe||event.pointerId!==cardSwipe.id)return;const {container,x,y}=cardSwipe;cardSwipe=null;const dx=event.clientX-x,dy=event.clientY-y;if(container.isConnected&&Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){cycleCardPhoto(container,dx<0?1:-1);container.dataset.swipedUntil=Date.now()+400}});
function bindProductGallery(dialog,item){
 const gallery=dialog.querySelector('.product-gallery');if(!gallery)return;
 const images=Adam.imageList(item),main=gallery.querySelector('.detail-image'),feedback=gallery.querySelector('.gallery-feedback');let index=0,startX=null;
 function select(next){index=(next+images.length)%images.length;main.hidden=false;feedback.hidden=true;main.src=productImageSource(images[index]);main.alt=item.name+' — الصورة '+(index+1);const count=gallery.querySelector('.gallery-counter');if(count)count.textContent=(index+1)+' / '+images.length;gallery.querySelectorAll('[data-gallery-index]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.galleryIndex)===index)))}
 main.addEventListener('error',()=>{main.hidden=true;feedback.hidden=false;feedback.textContent='تعذر تحميل هذه الصورة. يمكنك اختيار صورة أخرى.'});
 gallery.addEventListener('click',event=>{const thumb=event.target.closest('[data-gallery-index]'),step=event.target.closest('[data-gallery-step]');if(thumb)select(Number(thumb.dataset.galleryIndex));else if(step)select(index+Number(step.dataset.galleryStep))});
 gallery.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();select(index+(event.key==='ArrowLeft'?1:-1))}});
 const stage=gallery.querySelector('.gallery-stage');stage.addEventListener('pointerdown',event=>{startX=event.target.closest('button')?null:event.clientX});stage.addEventListener('pointercancel',()=>{startX=null});stage.addEventListener('pointerup',event=>{if(startX!==null&&Math.abs(event.clientX-startX)>40)select(index+(event.clientX<startX?1:-1));startX=null});
}
function openWeightChoice(id){
 const item=itemMap.get(id);if(!item)return;
 trackEvent('views',item);
 const variants=productVariants(item),meta=item.meta||{},initial=variants.find(v=>v.id===id&&v.meta?.available!==false)||variants.find(v=>v.meta?.available!==false),previous=document.activeElement;
 const overlay=document.createElement('div');overlay.className='weight-dialog-backdrop';
 const dialog=document.createElement('section');dialog.className='weight-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','تفاصيل '+item.name);
 const details=[['المكونات',meta.ingredients],['مسببات الحساسية',meta.allergens],['طريقة الحفظ والصلاحية',meta.storage],['يكفي تقريباً',meta.servings],['مدة التجهيز',meta.preparation]].filter(x=>x[1]);
 dialog.innerHTML='<div class="weight-dialog-header"><div><small>'+escapeHtml(item.category)+'</small><h3>'+escapeHtml(item.name)+'</h3></div><button type="button" class="weight-close" aria-label="إغلاق">×</button></div>'+productGallery(item)+'<p>'+escapeHtml(item.description)+'</p><dl>'+details.map(([k,v])=>'<dt>'+k+'</dt><dd>'+escapeHtml(v)+'</dd>').join('')+'</dl><button type="button" class="share-product">مشاركة المنتج ↗</button><div class="weight-options">'+variants.map(v=>'<label class="weight-option"><input type="radio" name="weight-choice" value="'+v.id+'" '+(v.id===initial?.id?'checked':'')+' '+(v.meta?.available===false?'disabled':'')+'><span class="weight-option-name">'+escapeHtml(v.weight||'الحجم العادي')+(v.meta?.available===false?' — نفد مؤقتاً':'')+'</span><strong>'+fmt(v.price)+'</strong></label>').join('')+'</div><div class="customization">'+optionList('النكهة','flavor',meta.flavors)+optionList('التغليف','packaging',meta.packaging)+(meta.allowMessage?'<label>عبارة الكيك أو كرت الإهداء<input name="giftMessage" maxlength="120" placeholder="اكتب العبارة المطلوبة"></label>':'')+'</div><div class="weight-dialog-footer"><div><small>السعر النهائي</small><strong class="weight-total"></strong></div><button type="button" class="weight-confirm" '+(!initial||!liveConfirmed?'disabled':'')+'>إضافة للسلة ＋</button></div>';
 overlay.appendChild(dialog);document.body.appendChild(overlay);document.body.classList.add('weight-modal-open');bindProductGallery(dialog,item);
 const close=()=>{overlay.remove();document.body.classList.remove('weight-modal-open');document.removeEventListener('keydown',onKey);previous?.focus()};
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab')trapFocus(e,dialog)};
 document.addEventListener('keydown',onKey);overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.weight-close'))close()});
 const selection=()=>{const chosen=itemMap.get(Number(dialog.querySelector('[name="weight-choice"]:checked')?.value));let extra=0;const parts=[];for(const key of ['flavor','packaging']){const field=dialog.querySelector('[name="'+key+'"]');if(field&&field.value!==''){const option=(key==='flavor'?meta.flavors:meta.packaging)?.[Number(field.value)];if(option){extra+=Number(option.price)||0;parts.push(option.label)}}}const message=dialog.querySelector('[name="giftMessage"]')?.value.trim();if(message)parts.push('العبارة: '+message);return {chosen,extra,custom:parts.join(' · ')}};
 const update=()=>{const {chosen,extra}=selection();dialog.querySelector('.weight-total').textContent=chosen?fmt(chosen.price+extra):'غير متوفر'};
 dialog.addEventListener('change',update);update();
 dialog.querySelector('.share-product').onclick=async()=>{const url=location.origin+location.pathname+'?product='+id;try{if(navigator.share)await navigator.share({title:item.name,url});else{await navigator.clipboard.writeText(url);toast('تم نسخ رابط المنتج')}}catch{toast('رابط المنتج: '+url)}};
 dialog.querySelector('.weight-confirm').onclick=()=>{const {chosen,extra,custom}=selection();if(!chosen||!liveConfirmed)return;if(custom){const key='c:'+JSON.stringify([chosen.id,custom,extra]);const row=customLines[key]||{id:chosen.id,extra,custom,qty:0};row.qty=Math.min(99,row.qty+1);customLines[key]=row;updateCart();renderCart();toast('تمت الإضافة للسلة')}else add(chosen.id);close()};
 dialog.querySelector('.weight-close').focus();
}
function trapFocus(event,container){const nodes=[...container.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(e=>!e.disabled&&!e.closest('[hidden]'));const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
function change(id,delta){
 if(customLines[id]){customLines[id].qty=Math.min(99,customLines[id].qty+delta);if(customLines[id].qty<=0)delete customLines[id]}
 else{const next=Math.min(99,(cart[id]||0)+delta);if(next<=0)delete cart[id];else cart[id]=next}
 updateCart();renderCart();
}
function openCart(){
  lastFocus=document.activeElement;
  updateOpeningStatus();
  renderCart();byId('overlay').hidden=false;byId('drawer').hidden=false;
  document.body.classList.add('dialog-open');byId('closeCart').focus();
  if(deliveryMap)requestAnimationFrame(()=>deliveryMap.invalidateSize());
}
function closeCart(){
  byId('overlay').hidden=true;byId('drawer').hidden=true;
  document.body.classList.remove('dialog-open');
  if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
}
function pickupChanged(){
  byId('addressField').hidden=$('input[name="pickup"]:checked').value==='collect';
  byId('deliveryZone').closest('.checkout-extra').hidden=byId('addressField').hidden;updateDeliveryTotal();
  if(deliveryMap&&!byId('addressField').hidden)requestAnimationFrame(()=>deliveryMap.invalidateSize());
}
// Coordinates stay in this checkout session; only an explicit submit shares them.
let deliveryLocation=null,deliveryMap=null,deliveryMarker=null,mapLoader=null,locationRequest=0;
function deliveryLocationUrl(){return 'https://www.google.com/maps?q='+deliveryLocation.lat.toFixed(6)+','+deliveryLocation.lng.toFixed(6)}
function locationStatus(message,error=false){byId('locationStatus').textContent=message;byId('locationStatus').classList.toggle('is-error',error)}
function selectDeliveryLocation(lat,lng,accuracy){
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
  deliveryLocation={lat,lng};
  byId('selectedLocation').hidden=false;byId('locationLink').href=deliveryLocationUrl();
  locationStatus(accuracy>100?'تم تحديد الموقع تقريبياً؛ دقة الجهاز نحو '+Math.round(accuracy)+' متر. عدّل العلامة لمكان التوصيل.':'تم اختيار موقع التوصيل. سيُرسل رابطه مع الطلب.');
  if(deliveryMap){
    const point=[lat,lng];
    if(deliveryMarker)deliveryMarker.setLatLng(point);
    else{deliveryMarker=L.marker(point,{draggable:true,autoPan:true,alt:'موقع التوصيل المحدد',title:'اسحب لتعديل موقع التوصيل'}).addTo(deliveryMap);deliveryMarker.on('dragend',()=>{const p=deliveryMarker.getLatLng();selectDeliveryLocation(p.lat,p.lng)})}
  }
}
function loadDeliveryMapLibrary(){
  if(window.L)return Promise.resolve();
  if(mapLoader)return mapLoader;
  mapLoader=new Promise((resolve,reject)=>{
    const css=document.createElement('link'),script=document.createElement('script');
    css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.async=true;
    const timer=setTimeout(()=>fail(),15000);
    function fail(){clearTimeout(timer);script.remove();css.remove();mapLoader=null;reject(new Error('Map unavailable'))}
    script.onload=()=>{clearTimeout(timer);if(window.L)resolve();else fail()};script.onerror=fail;
    document.head.append(css,script);
  });
  return mapLoader;
}
async function showDeliveryMap(){
  const button=byId('toggleLocationMap');button.disabled=true;
  try{
    await loadDeliveryMapLibrary();
    byId('locationMapPanel').hidden=false;button.setAttribute('aria-expanded','true');button.textContent='إخفاء الخريطة';
    if(!deliveryMap){
      deliveryMap=L.map('deliveryMap',{scrollWheelZoom:false}).setView(deliveryLocation?[deliveryLocation.lat,deliveryLocation.lng]:[31.015,47.431],deliveryLocation?17:13);
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(deliveryMap);
      tiles.on('tileerror',()=>locationStatus('تعذّر تحميل بعض تفاصيل الخريطة. يمكنك إعادة المحاولة أو كتابة العنوان.',true));
      deliveryMap.on('click',event=>selectDeliveryLocation(event.latlng.lat,event.latlng.lng));
      if(deliveryLocation)selectDeliveryLocation(deliveryLocation.lat,deliveryLocation.lng);
    }
    requestAnimationFrame(()=>{deliveryMap.invalidateSize();if(deliveryLocation)deliveryMap.setView([deliveryLocation.lat,deliveryLocation.lng],17)});
  }catch(_error){locationStatus('تعذّر فتح الخريطة. حاول مجدداً أو استخدم موقعي الحالي أو اكتب العنوان.',true)}
  finally{button.disabled=false}
}
byId('toggleLocationMap').addEventListener('click',()=>{
  if(!byId('locationMapPanel').hidden){byId('locationMapPanel').hidden=true;byId('toggleLocationMap').setAttribute('aria-expanded','false');byId('toggleLocationMap').textContent='اختيار من الخريطة'}
  else showDeliveryMap();
});
byId('locateCustomer').addEventListener('click',()=>{
  if(!navigator.geolocation){locationStatus('جهازك لا يدعم تحديد الموقع؛ اختر من الخريطة أو اكتب العنوان.',true);return}
  const request=++locationRequest,button=byId('locateCustomer');button.disabled=true;button.textContent='جاري تحديد الموقع…';locationStatus('اسمح للمتصفح بالوصول إلى موقعك لتحديد مكان التوصيل.');
  const finish=()=>{button.disabled=false;button.textContent='📍 موقعي الحالي'};
  navigator.geolocation.getCurrentPosition(position=>{
    if(request!==locationRequest)return;
    finish();selectDeliveryLocation(position.coords.latitude,position.coords.longitude,position.coords.accuracy);
    if(!byId('drawer').hidden&&!byId('addressField').hidden)showDeliveryMap();
  },error=>{
    if(request!==locationRequest)return;
    finish();locationStatus(error.code===1?'لم تسمح بالوصول للموقع. اختره من الخريطة أو اكتب العنوان.':error.code===3?'تأخر تحديد الموقع. حاول مرة ثانية أو اختره من الخريطة.':'تعذّر تحديد موقعك. اختره من الخريطة أو اكتب العنوان.',true);
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
byId('removeLocation').addEventListener('click',()=>{
  ++locationRequest;deliveryLocation=null;if(deliveryMarker){deliveryMarker.remove();deliveryMarker=null}
  byId('selectedLocation').hidden=true;byId('locationLink').removeAttribute('href');byId('locateCustomer').disabled=false;byId('locateCustomer').textContent='📍 موقعي الحالي';locationStatus('تم حذف الموقع. يمكنك اختيار موقع آخر أو كتابة العنوان.');
});
function validationError(message,field){
  const box=byId('formError');box.textContent=message;box.hidden=false;
  field?.focus();
}
async function sendOrder(event){
  event.preventDefault();
  if(submitting)return;
  if(liveConfirmed&&Date.now()-lastLiveAt>120000){await refreshMenu();validationError('تم تحديث التوافر والأسعار. راجع السلة ثم أرسل الطلب.');return}
  updateOpeningStatus();
  if(!ordersOpen()){validationError('تعذر إرسال الطلب حالياً. حدّث المنيو وتحقق من استقبال الطلبات.');return}
  const rows=entries();
  if(!rows.length){toast('أضف حلوى إلى السلة أولاً');return}
  const name=byId('customerName').value.trim(),phone=byId('customerPhone').value.trim(),address=byId('customerAddress').value.trim(),note=byId('note').value.trim();
  const mode=$('input[name="pickup"]:checked').value;
  byId('formError').hidden=true;
  if(!name){validationError('يرجى كتابة الاسم.',byId('customerName'));return}
  const digits=phone.replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  if(!/^07\d{9}$/.test(digits)){validationError('يرجى كتابة رقم هاتف عراقي صحيح من 11 رقماً يبدأ بـ 07.',byId('customerPhone'));return}
  if(mode==='delivery'&&!address&&!deliveryLocation){validationError('اكتب عنوان التوصيل أو حدد الموقع.',byId('customerAddress'));return}
  const scheduleError=Adam.validateSchedule(byId('requestedAt').value,storeSettings);
  if(scheduleError){validationError(scheduleError,byId('requestedAt'));return}
  if(rows.some(r=>r.item.meta?.available===false)){validationError('يوجد منتج نفد مؤقتاً. حدّث السلة قبل الإرسال.');return}
  const zone=byId('deliveryZone').value===''?null:storeSettings.zones?.[Number(byId('deliveryZone').value)],fee=mode==='delivery'&&byId('deliveryZone').value!==''?Number(zone?.fee)||0:0;
  const orderId='AD-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,4).toUpperCase();
  const lines=['🍬 *حلويات شجرة آدم*','رقم الطلب: '+orderId,'طلب جديد','━━━━━━━━━━━━'];
  rows.forEach(({item,qty},index)=>{
    lines.push((index+1)+'. *'+item.name+'*');
    if(String(item.weight||'').trim())lines.push('⚖️ الوزن المختار: *'+String(item.weight).trim()+'*');
    if(item.custom)lines.push('التخصيص: '+item.custom);
    lines.push('الكمية: '+qty+' × '+fmt(item.price));
    lines.push('الإجمالي: '+fmt(qty*item.price));
    // Short, stable product URL: opens the storefront and highlights the exact product ID.
    lines.push('المنتج: '+location.origin+location.pathname+'?product='+encodeURIComponent(item.id));
    lines.push('');
  });
  lines.push('━━━━━━━━━━━━','💰 *المجموع: '+fmt(totals().price)+'*','','👤 *بيانات الزبون*','الاسم: '+name,'الهاتف: '+digits,'الاستلام: '+(mode==='delivery'?'توصيل':'من المحل'));
  lines.push('الموعد المطلوب بتوقيت بغداد: '+byId('requestedAt').value.replace('T',' '));
  if(mode==='delivery'&&zone&&byId('deliveryZone').value!=='')lines.push('منطقة التوصيل: '+zone.name,'أجور التوصيل: '+fmt(fee));
  lines.push('الإجمالي مع التوصيل المحدد: '+fmt(totals().price+fee),'الطلب والموعد بانتظار قبول المتجر.');
  if(mode==='delivery'&&address)lines.push('العنوان: '+address);
  if(mode==='delivery'&&deliveryLocation)lines.push('الموقع: '+deliveryLocationUrl());
  if(note)lines.push('ملاحظات: '+note);
  const order={id:orderId,createdAt:new Date().toISOString(),status:'مسودة واتساب',name,phone:digits,address:mode==='delivery'?address:'',location:mode==='delivery'&&deliveryLocation?deliveryLocationUrl():'',mode,note,requestedAt:byId('requestedAt').value,zone:mode==='delivery'?(zone?.name||''):'',fee,total:totals().price+fee,items:rows.map(({item,qty})=>({id:item.id,name:item.name,weight:item.weight,price:item.price,custom:item.custom||'',qty}))};
  const history=Adam.read('adam-orders-v3',[]);history.unshift(order);Adam.write('adam-orders-v3',history.slice(0,30));renderOrderHistory();
  rows.forEach(({item,qty})=>trackEvent('intents',item,qty));
  submitting=true;byId('confirmOrder').disabled=true;
  const caps=await Adam.capabilities();
  if(caps.version>=3){byId('confirmOrder').disabled=true;try{await Adam.mutate('createOrder',order);order.status='بانتظار تأكيد المتجر';Adam.write('adam-orders-v3',history.slice(0,30))}catch(e){order.status='تعذر التسجيل — لم يُرسل';Adam.write('adam-orders-v3',history.slice(0,30));renderOrderHistory();submitting=false;updateOpeningStatus();validationError(e.message||'تعذر تسجيل الطلب. أعد المحاولة.');return}}
  const url='https://wa.me/'+String(storeSettings.whatsapp).replace(/\D/g,'')+'?text='+encodeURIComponent(lines.join('\n'));
  playSound('confirm');
  window.location.href=url;setTimeout(()=>{submitting=false;updateOpeningStatus()},2000);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(button&&!button.disabled&&button.id!=='soundToggle'&&button.id!=='confirmOrder')playSound(button.hasAttribute('data-add')?'add':'tap');
},true);
byId('soundToggle').addEventListener('click',()=>{
  soundEnabled=!soundEnabled;
  try{localStorage.setItem(soundKey,String(soundEnabled))}catch(_error){}
  updateSoundToggle();
  if(soundEnabled)playSound('tap');
});
document.addEventListener('click',event=>{
  const cardArrow=event.target.closest('[data-card-step]');if(cardArrow){cycleCardPhoto(cardArrow.closest('.card-photos'),Number(cardArrow.dataset.cardStep));return}
  const photo=event.target.closest('[data-view-product]');if(photo){if(Date.now()>=Number(photo.closest('.card-photos').dataset.swipedUntil||0))openWeightChoice(Number(photo.dataset.viewProduct));return}
  const favorite=event.target.closest('[data-favorite]');
  if(favorite){const id=Number(favorite.dataset.favorite),item=itemMap.get(id);if(!item)return;const on=isFavorite(item);productVariants(item).forEach(v=>favoriteIds.delete(v.id));favoriteIds.delete(Adam.groupKey(item));if(!on)favoriteIds.add(Adam.groupKey(item));try{localStorage.setItem(favoriteKey,JSON.stringify([...favoriteIds]))}catch(_error){}categories=menuCategories();if(active==='المفضلة'&&!favoriteIds.size)active='الكل';renderCats();renderPopular();renderMenu();return}
  const chooseButton=event.target.closest('[data-choose]');
  if(chooseButton){openWeightChoice(Number(chooseButton.dataset.choose));return}
  const addButton=event.target.closest('[data-add]');
  if(addButton){const item=itemMap.get(Number(addButton.dataset.add));if(item){const variants=productVariants(item);openWeightChoice(item.id)}return}
  const cat=event.target.closest('[data-category]');
  if(cat){active=cat.dataset.category;renderCats();renderMenu();byId('allMenu').scrollIntoView({behavior:'smooth'});return}
  const adjust=event.target.closest('[data-change]');
  if(adjust){change(adjust.dataset.change,Number(adjust.dataset.delta));return}
  const remove=event.target.closest('[data-remove]');
  if(remove){delete cart[remove.dataset.remove];delete customLines[remove.dataset.remove];updateCart();renderCart();return}
  if(event.target.closest('[data-open-cart]'))openCart();
});
document.addEventListener('error',event=>{
  if(event.target.matches?.('.food-image')&&event.target.closest('.card-photos')){if(event.target.dataset.fallback)return;event.target.dataset.fallback='true';event.target.classList.add('image-unavailable');event.target.src='assets/images/logo.svg';return}
  if(event.target.matches?.('.food-image'))event.target.replaceWith(Object.assign(document.createElement('div'),{className:'food-placeholder',innerHTML:'<img src="assets/images/logo.svg" alt=""><span class="submark">حلويات شجرة آدم</span>'}));
},true);
byId('q').addEventListener('input',renderMenu);
byId('menuToggle').addEventListener('click',()=>{const nav=byId('quickNav');nav.hidden=!nav.hidden;byId('menuToggle').setAttribute('aria-expanded',String(!nav.hidden))});
byId('quickNav').addEventListener('click',event=>{if(event.target.closest('a,button')){byId('quickNav').hidden=true;byId('menuToggle').setAttribute('aria-expanded','false')}});
byId('searchJump').addEventListener('click',()=>{byId('q').scrollIntoView({behavior:'smooth',block:'center'});byId('q').focus({preventScroll:true})});
byId('resetSearch').addEventListener('click',()=>{byId('q').value='';renderMenu();byId('q').focus()});
byId('showAll').addEventListener('click',()=>{byId('q').value='';active='الكل';renderCats();renderMenu()});
byId('overlay').addEventListener('click',closeCart);
byId('closeCart').addEventListener('click',closeCart);
byId('clearCart').addEventListener('click',()=>{cart={};customLines={};updateCart();renderCart()});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!byId('drawer').hidden)closeCart();
  if(event.key==='Tab'&&!byId('drawer').hidden){
    const focusable=[...byId('drawer').querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('[hidden]'));
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
});
document.querySelectorAll('input[name="pickup"]').forEach(el=>el.addEventListener('change',pickupChanged));
byId('orderForm').addEventListener('submit',sendOrder);
function renderPopular(){const featured=uniqueProducts(menuItems.filter(item=>item.badge||item.offer)).slice(0,6);byId('popular').innerHTML=featured.map(card).join('');byId('popularSection').hidden=!featured.length}
renderPopular();
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;byId('installButton').hidden=false});
byId('installButton').addEventListener('click',async()=>{
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;byId('installButton').hidden=true}
  else toast('من مشاركة المتصفح، اختر إضافة إلى الشاشة الرئيسية');
});
if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!navigator.standalone)byId('installButton').hidden=false;
renderCats();renderMenu();updateCart();pickupChanged();updateOpeningStatus();updateSoundToggle();
setInterval(updateOpeningStatus,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateOpeningStatus()});

function renderPromoFromBanners(){
 const banners=allProducts.filter(p=>p.category==='سلايدر العروض'&&p.active&&!p.meta.deleted&&p.image).sort((a,b)=>(a.meta.order||0)-(b.meta.order||0));
 const section=byId('promoSlider'),track=byId('promoTrack'),dots=byId('promoDots');section.hidden=!banners.length;
 track.innerHTML=banners.map(p=>'<article class="promo-slide"><img src="'+escapeHtml(p.image)+'" alt="'+escapeHtml(p.name)+'" loading="lazy" decoding="async" width="640" height="480"><div class="promo-caption"><strong>'+escapeHtml(p.name)+'</strong><span>'+escapeHtml(p.description)+'</span></div></article>').join('');
 dots.innerHTML=banners.map((p,i)=>'<button type="button" aria-label="الصورة '+(i+1)+'" data-slide="'+i+'" class="'+(i?'':'selected')+'"></button>').join('');
 dots.onclick=e=>{const b=e.target.closest('[data-slide]');if(b)track.children[Number(b.dataset.slide)]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})};
 track.onscroll=()=>{const slides=[...track.children],bounds=track.getBoundingClientRect();let closest=0,best=Infinity;slides.forEach((s,i)=>{const r=s.getBoundingClientRect(),distance=Math.abs((r.left+r.right-bounds.left-bounds.right)/2);if(distance<best){best=distance;closest=i}});dots.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('selected',i===closest))};
}
const viewedThisSession=new Set();let analyticsQueue=[],analyticsTimer;
function trackEvent(kind,item,count=1){const stats=Adam.read('adam-stats-v3',{}),key=Adam.groupKey(item);stats[key]||={name:item.name,views:0,intents:0};stats[key][kind]+=count;Adam.write('adam-stats-v3',stats);if(kind==='views'&&viewedThisSession.has(key))return;if(kind==='views')viewedThisSession.add(key);analyticsQueue.push({id:item.id,kind,count});clearTimeout(analyticsTimer);analyticsTimer=setTimeout(async()=>{const events=analyticsQueue.splice(0,100);if((await Adam.capabilities()).version>=3)try{await Adam.mutate('trackEvents',events)}catch{}},2500)}
function renderOrderHistory(){
 const orders=Adam.read('adam-orders-v3',[]);byId('customerOrders').hidden=!orders.length;
 byId('customerOrderList').innerHTML=orders.map(o=>'<article><strong>'+escapeHtml(o.id)+'</strong><span>'+escapeHtml(o.status)+' · '+fmt(o.total)+'</span><small>'+escapeHtml(o.requestedAt?.replace('T',' ')||'')+'</small></article>').join('');
}
function configureCheckout(){
 byId('deliveryZone').innerHTML='<option value="">تُحدد الأجور مع المتجر</option>'+(storeSettings.zones||[]).map((z,i)=>'<option value="'+i+'">'+escapeHtml(z.name)+' — '+fmt(z.fee)+'</option>').join('');
 byId('preparationNote').textContent=Number(storeSettings.leadMinutes)>0?'وقت التجهيز الأدنى '+storeSettings.leadMinutes+' دقيقة. الموعد بعد قبول المتجر.':'اختر موعدك؛ يُؤكد المتجر إمكانية التجهيز عبر واتساب.';
}
function applyMenu(items,confirmed){
 allProducts=items;storeSettings=Adam.settings(items);liveConfirmed=confirmed;if(confirmed)lastLiveAt=Date.now();
 menuItems=Adam.publicItems(items).filter(p=>p.category!=='سلايدر العروض').sort((a,b)=>(a.meta.order||0)-(b.meta.order||0));itemMap=new Map(menuItems.map(p=>[p.id,p]));
 if(confirmed){for(const id of Object.keys(cart))if(!itemMap.has(Number(id)))delete cart[id];for(const [key,row] of Object.entries(customLines))if(!itemMap.has(row.id))delete customLines[key]}
 categories=menuCategories();const order=storeSettings.categoryOrder||[];categories.sort((a,b)=>{if(['الكل','المفضلة','العروض'].includes(a)||['الكل','المفضلة','العروض'].includes(b))return 0;return (order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b))});
 if(!categories.includes(active))active='الكل';renderCats();renderPopular();renderMenu();renderPromoFromBanners();updateCart();renderCart();configureCheckout();updateOpeningStatus();if(confirmed)focusSharedProduct();
}
let loadInFlight=false;
async function refreshMenu(){
 if(loadInFlight)return;loadInFlight=true;menuLoading=true;byId('retryMenu').hidden=true;byId('loadState').hidden=false;byId('loadMessage').textContent=menuItems.length?'نعرض آخر نسخة؛ جارٍ تحديث الأسعار والتوافر…':'جارٍ تحميل المنيو…';
 try{const items=await Adam.load();menuLoading=false;applyMenu(items,true);byId('loadState').hidden=true;Adam.capabilities()}
 catch{menuLoading=false;liveConfirmed=false;byId('loadMessage').textContent=menuItems.length?'تعذر التحديث. يمكنك التصفح، وأعد المحاولة قبل الطلب.':'تعذر تحميل المنيو. تحقق من الإنترنت وأعد المحاولة.';byId('retryMenu').hidden=false;renderMenu();updateOpeningStatus()}
 finally{loadInFlight=false}
}
byId('retryMenu').onclick=refreshMenu;
function updateDeliveryTotal(){const select=byId('deliveryZone'),delivery=$('input[name="pickup"]:checked')?.value==='delivery',zone=select.value!==''?storeSettings.zones?.[Number(select.value)]:null,fee=delivery&&zone?Number(zone.fee)||0:0;byId('deliveryFee').textContent=!delivery?'استلام من المتجر':zone?fmt(fee):'تُحدد مع المتجر';byId('payableTotal').textContent=fmt(totals().price+fee)}
byId('deliveryZone').onchange=()=>{updateDeliveryTotal();const z=storeSettings.zones?.[Number(byId('deliveryZone').value)];byId('zoneNote').textContent=byId('deliveryZone').value!==''&&z?'أجور التوصيل: '+fmt(z.fee):'تُحدد الأجور مع المتجر عبر واتساب.'};
renderOrderHistory();applyMenu(allProducts,false);refreshMenu();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastLiveAt>120000)refreshMenu()});
