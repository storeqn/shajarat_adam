'use strict';
const $=selector=>document.querySelector(selector);
const byId=id=>document.getElementById(id);
let menuItems=MENU;
let itemMap=new Map(menuItems.map(item=>[item.id,item]));
const storageKey='shajarat-adam-cart-v2';
let active='الكل';
let cart={};
let lastFocus=null;
try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
    for(const [id,qty] of Object.entries(saved)){
      if(itemMap.has(Number(id))&&Number.isInteger(qty)&&qty>0&&qty<=99) cart[id]=qty;
    }
  }
}catch(_error){cart={}}
const fmt=value=>Number(value).toLocaleString('en-US')+' د.ع';
const soundKey='shajarat-adam-sound-enabled';
let soundEnabled=true,audioContext;
try{soundEnabled=localStorage.getItem(soundKey)!=='false'}catch(_error){}
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
const baghdadClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function ordersOpen(){return true;} // Orders can be sent to the store's confirmed WhatsApp number.
function updateOpeningStatus(){
  const open=ordersOpen();
  const status=byId('openingStatus');
  status.textContent='استقبال الطلبات عبر واتساب';
  status.classList.toggle('is-open',open);
  byId('orderHoursNotice').textContent='سيتم فتح واتساب لإرسال طلبك إلى المتجر.';
  byId('orderHoursNotice').classList.toggle('is-closed',!open);
  byId('confirmOrder').disabled=!open;
  byId('confirmOrderText').textContent=open?'تأكيد الطلب عبر واتساب':'يبدأ تأكيد الطلبات الساعة 4 مساءً';
}
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value).normalize('NFKC').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const favoriteKey='shajarat-adam-favorites-v1';
let favoriteIds=new Set();
try{const saved=JSON.parse(localStorage.getItem(favoriteKey)||'[]');if(Array.isArray(saved))favoriteIds=new Set(saved.filter(id=>Number.isSafeInteger(id)))}catch(_error){}
const menuCategories=()=>['الكل',...(favoriteIds.size?['المفضلة']:[]),...(menuItems.some(item=>item.offer)?['العروض']:[]),...new Set(menuItems.map(item=>item.category))];
let categories=menuCategories();
const illustrativeImages=new Map([
 ['صاج إيطالي لحم + دجاج','assets/images/saj-mixed.webp'],
 ['حلوى كرسبي 5 قطع','assets/images/crispy-five.webp'],
 ['بركر لحم مع جبن شيدر','assets/images/beef-burger.webp']
]);
const placeholder=item=>'<div class="food-placeholder" aria-hidden="true"><img src="assets/images/logo.svg" alt="" loading="lazy"><span class="submark">'+escapeHtml(item.category)+'</span></div>';
function card(item){
  const src=item.image||illustrativeImages.get(item.name);
  const picture=src?'<img class="food-image" src="'+escapeHtml(src)+'" alt="'+(item.image?'':'صورة توضيحية')+'" loading="lazy" decoding="async">':placeholder(item);
  const description=item.description?'<p class="description">'+escapeHtml(item.description)+'</p>':'';
  const badge=(item.offer?'<span class="badge">عرض خاص</span>':'')+(item.badge?'<span class="badge">'+escapeHtml(item.badge)+'</span>':'');
  const variants=productVariants(item);
  const hasWeights=variants.some(v=>String(v.weight||'').trim());
  const minPrice=Math.min(...variants.map(v=>v.price));
  const priceText=variants.length>1?'<span class="price-prefix">يبدأ من</span> '+fmt(minPrice):fmt(item.price);
  const previous=item.offer&&item.old_price>item.price?'<del class="old-price">'+fmt(item.old_price)+'</del>':'';
  return '<article class="card sweets-card">'+picture+'<button type="button" class="favorite'+(favoriteIds.has(item.id)?' is-favorite':'')+'" data-favorite="'+item.id+'" aria-pressed="'+favoriteIds.has(item.id)+'" aria-label="إضافة للمفضلة: '+escapeHtml(item.name)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.5c0 4.5-8.8 11-8.8 11s-8.8-6.5-8.8-11a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/></svg></button><div class="card-info"><h3>'+escapeHtml(item.name)+'</h3><div class="card-meta">'+escapeHtml(item.category)+badge+'</div>'+description+'<div class="price">'+priceText+previous+'</div><button class="sweets-order-button" type="button" data-choose="'+item.id+'">'+(hasWeights?'اختر الوزن وأضف للسلة':'إضافة للسلة')+' <span aria-hidden="true">＋</span></button></div></article>';
}
function categoryIcon(category){
  const paths={
    'المفضلة':'<path d="M20.8 8.5c0 4.5-8.8 11-8.8 11s-8.8-6.5-8.8-11a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/>',
    'الكل':'<path d="M3 14h18M5 14a7 7 0 0 1 14 0M5 18h14M7 21h10"/>',
    'الصاج':'<path d="M4 7c6-3 10-3 16 0l-2 11c-4 3-8 3-12 0L4 7Z"/><path d="M7 9c4 2 6 2 10 0M8 13h8"/>',
    'الحلويات الغربية':'<path d="M7 6c-3 0-5 3-4 6s4 5 7 3l5-5-4-4a5 5 0 0 0-4 0ZM16 6l4-4M17 9l5-5"/>',
    'البركر':'<path d="M4 11a8 8 0 0 1 16 0M3 13h18M4 17h16M6 21h12"/>',
    'الريزو':'<path d="M3 14h18l-2 6H5l-2-6ZM6 10c0-2 2-3 4-2M11 11c0-2 2-4 5-3M16 12l2-2"/>',
    'أطباق شجرة آدم':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 8v8M8 12h8"/>',
    'سندويش عربي':'<path d="M4 5h16l-3 15H7L4 5ZM7 9h10M8 13h8"/>',
    'البيتزا':'<path d="m12 3 9 18H3L12 3Z"/><circle cx="11" cy="13" r="1"/><circle cx="14" cy="17" r="1"/>',
    'الشاورما':'<path d="M8 3h8l-1 17H9L8 3ZM7 7h10M7 12h10M7 17h10"/>',
    'المقبلات':'<path d="M5 6h2l2 13h9l2-13h2M9 4l2 11M14 3l-1 12M19 4l-3 11"/>',
    'الحلويات':'<path d="M5 10h14l-2 10H7L5 10ZM5 10c0-4 3-7 7-7s7 3 7 7M9 14h6"/>',
    'العروض':'<path d="m12 2 2.3 6.5H21l-5.5 4 2 7L12 16l-5.5 3.5 2-7-5.5-4h6.7L12 2Z"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[category]||paths['الكل'])+'</svg>';
}
function renderCats(){
  byId('cats').innerHTML=categories.map(cat=>'<button type="button" class="cat'+(active===cat?' active':'')+'" data-category="'+escapeHtml(cat)+'" aria-pressed="'+(active===cat)+'">'+categoryIcon(cat)+'<span>'+escapeHtml(cat)+'</span></button>').join('');
}
const selectedWeights={};
function sameVariantGroup(a,b){return !!String(a.weight||'').trim()&&!!String(b.weight||'').trim()&&a.name===b.name&&a.category===b.category&&String(a.image||'')===String(b.image||'')}
function productVariants(item){return String(item.weight||'').trim()?menuItems.filter(p=>sameVariantGroup(p,item)): [item]}
function uniqueProducts(items){const seen=new Set();return items.filter(p=>{const key=String(p.weight||'').trim()?['variant',p.name,p.category,p.image||''].join('|'):'item:'+p.id;if(seen.has(key))return false;seen.add(key);return true})}
function focusSharedProduct(){
  const id=Number(new URLSearchParams(location.search).get('product'));
  if(!Number.isSafeInteger(id)||id<=0||!itemMap.has(id))return;
  const item=itemMap.get(id);active=item.category;
  byId('q').value='';renderCats();renderPopular();renderMenu();focusSharedProduct();
  const target=document.querySelector('[data-choose="'+id+'"]')||document.querySelector('[data-add="'+id+'"]');
  if(target){target.closest('.card')?.scrollIntoView({block:'center',behavior:'smooth'});target.closest('.card')?.classList.add('shared-product-highlight')}
}
function renderMenu(){
  const query=normalize(byId('q').value);
  const terms=query.split(' ').filter(Boolean);
  const filtered=uniqueProducts(menuItems.filter(item=>{
    const text=normalize(item.name+' '+item.category+' '+(item.description||''));
    return (active==='الكل'||(active==='العروض'?item.offer:active==='المفضلة'?favoriteIds.has(item.id):item.category===active))&&terms.every(term=>text.includes(term));
  }));
  const grouped=active==='الكل'&&!query;
  const container=byId('menu');
  container.classList.toggle('has-groups',grouped);
  if(grouped){
    container.innerHTML=categories.filter(cat=>cat!=='الكل'&&cat!=='العروض').map(cat=>{
      const items=filtered.filter(item=>item.category===cat);
      if(!items.length)return '';
      return '<section class="menu-group" aria-label="'+escapeHtml(cat)+'"><div class="menu-group-head"><h3>'+escapeHtml(cat)+'</h3><button type="button" data-category="'+escapeHtml(cat)+'">عرض القسم ←</button></div><div class="menu-group-grid">'+items.map(card).join('')+'</div></section>';
    }).join('');
  }else container.innerHTML=filtered.map(card).join('');
  byId('sectionTitle').textContent=active==='الكل'?'كل الحلويات':active;
  byId('count').textContent=filtered.length+' صنف';
  byId('empty').hidden=filtered.length>0;
  byId('resetSearch').hidden=!byId('q').value;
  byId('popularSection').hidden=active!=='الكل'||!!query||!uniqueProducts(menuItems.filter(item=>item.badge||item.offer)).length;
}
function entries(){return Object.entries(cart).map(([id,qty])=>({item:itemMap.get(Number(id)),qty})).filter(row=>row.item)}
function totals(){return entries().reduce((v,row)=>({qty:v.qty+row.qty,price:v.price+row.item.price*row.qty}),{qty:0,price:0})}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(cart))}catch(_error){}}
function updateCart(){
  const {qty,price}=totals();
  byId('cartCount').textContent=qty;byId('floatCount').textContent=qty;
  byId('floatTotal').textContent=fmt(price);byId('cartTotal').textContent=fmt(price);
  byId('floatingCart').hidden=qty===0;
  document.body.classList.toggle('has-cart',qty>0);
  persist();
}
function renderCart(){
  const rows=entries();
  byId('cartEmpty').hidden=rows.length>0;
  byId('cartItems').innerHTML=rows.map(({item,qty})=>'<div class="cart-line"><div><h3>'+escapeHtml(item.name)+'</h3>'+(item.weight?'<span class="cart-weight">الوزن: '+escapeHtml(item.weight)+'</span>':'')+'<small>'+fmt(item.price)+' × '+qty+' = '+fmt(item.price*qty)+'</small></div><div class="qty"><button type="button" data-change="'+item.id+'" data-delta="-1" aria-label="تقليل '+escapeHtml(item.name)+'">−</button><b>'+qty+'</b><button type="button" data-change="'+item.id+'" data-delta="1" aria-label="زيادة '+escapeHtml(item.name)+'">+</button><button type="button" class="remove" data-remove="'+item.id+'" aria-label="حذف '+escapeHtml(item.name)+'">×</button></div></div>').join('');
}
let toastTimer;
function toast(message){
  const box=byId('toast');box.textContent=message;box.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),2100);
}
function add(id){
  if(!itemMap.has(id))return;
  cart[id]=Math.min(99,(cart[id]||0)+1);updateCart();renderCart();toast('تمت إضافة '+itemMap.get(id).name);
}
function showWeightChooser(item,variants){
 let modal=document.getElementById('weightModal');
 if(!modal){modal=document.createElement('div');modal.id='weightModal';modal.className='weight-modal';document.body.appendChild(modal)}
 modal.innerHTML='<div class="weight-backdrop" data-close-weight></div><section class="weight-dialog" role="dialog" aria-modal="true" aria-label="اختيار وزن المنتج"><div class="weight-head"><div><small>حدد الكمية المناسبة</small><h3>'+escapeHtml(item.name)+'</h3></div><button type="button" data-close-weight aria-label="إغلاق">×</button></div><div class="weight-options">'+variants.map((v,i)=>'<label class="weight-option"><input type="radio" name="selectedWeight" value="'+v.id+'" '+(i===0?'checked':'')+'><span class="weight-option-name">'+escapeHtml(v.weight||'الحجم العادي')+'</span><strong>'+fmt(v.price)+'</strong></label>').join('')+'</div><button type="button" class="weight-confirm">إضافة إلى السلة</button></section>';
 modal.hidden=false;document.body.classList.add('weight-modal-open');
 const close=()=>{modal.hidden=true;document.body.classList.remove('weight-modal-open')};
 modal.querySelectorAll('[data-close-weight]').forEach(el=>el.onclick=close);
 modal.querySelector('.weight-confirm').onclick=()=>{const chosen=modal.querySelector('input[name="selectedWeight"]:checked');if(chosen){add(Number(chosen.value));close()}};
}
function openWeightChoice(id){
 const item=itemMap.get(id);if(!item)return;
 const variants=productVariants(item);
 if(variants.length===1&&!variants[0].weight){add(id);return}
 const overlay=document.createElement('div');overlay.className='weight-dialog-backdrop';overlay.setAttribute('role','presentation');
 const dialog=document.createElement('section');dialog.className='weight-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','اختيار وزن '+item.name);
 const options=variants.map((v,i)=>'<label class="weight-option"><input type="radio" name="weight-choice" value="'+v.id+'" '+(i===0?'checked':'')+'><span class="weight-option-name">'+escapeHtml(v.weight||'الحجم العادي')+'</span><strong>'+fmt(v.price)+'</strong></label>').join('');
 dialog.innerHTML='<div class="weight-dialog-header"><div><small>اختر الحجم المناسب</small><h3>'+escapeHtml(item.name)+'</h3></div><button type="button" class="weight-close" aria-label="إغلاق">×</button></div><div class="weight-options">'+options+'</div><div class="weight-dialog-footer"><div><small>السعر النهائي</small><strong class="weight-total">'+fmt(variants[0].price)+'</strong></div><button type="button" class="weight-confirm">إضافة للسلة ＋</button></div>';
 overlay.appendChild(dialog);document.body.appendChild(overlay);
 const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey)};
 const onKey=e=>{if(e.key==='Escape')close()};
 document.addEventListener('keydown',onKey);
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.weight-close'))close()});
 dialog.addEventListener('change',e=>{if(e.target.name==='weight-choice'){const chosen=itemMap.get(Number(e.target.value));if(chosen)dialog.querySelector('.weight-total').textContent=fmt(chosen.price)}});
 dialog.querySelector('.weight-confirm').addEventListener('click',()=>{const chosen=dialog.querySelector('input[name="weight-choice"]:checked');if(chosen){add(Number(chosen.value));close()}});
 dialog.querySelector('.weight-close').focus();
}
function change(id,delta){
  if(!itemMap.has(id))return;
  const next=Math.min(99,(cart[id]||0)+delta);
  if(next<=0)delete cart[id];else cart[id]=next;
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
function sendOrder(event){
  event.preventDefault();
  updateOpeningStatus();
  if(!ordersOpen()){validationError('المتجر مغلق الآن. يبدأ استقبال الطلبات اليوم الساعة 4:00 مساءً بتوقيت بغداد.');return}
  const rows=entries();
  if(!rows.length){toast('أضف حلوى إلى السلة أولاً');return}
  const name=byId('customerName').value.trim(),phone=byId('customerPhone').value.trim(),address=byId('customerAddress').value.trim(),note=byId('note').value.trim();
  const mode=$('input[name="pickup"]:checked').value;
  byId('formError').hidden=true;
  if(!name){validationError('يرجى كتابة الاسم.',byId('customerName'));return}
  const digits=phone.replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  if(!/^07\d{9}$/.test(digits)){validationError('يرجى كتابة رقم هاتف عراقي صحيح من 11 رقماً يبدأ بـ 07.',byId('customerPhone'));return}
  const lines=['🍬 *حلويات شجرة آدم*','طلب جديد','━━━━━━━━━━━━'];
  rows.forEach(({item,qty},index)=>{
    lines.push((index+1)+'. *'+item.name+'*');
    if(String(item.weight||'').trim())lines.push('⚖️ الوزن المختار: *'+String(item.weight).trim()+'*');
    lines.push('الكمية: '+qty+' × '+fmt(item.price));
    lines.push('الإجمالي: '+fmt(qty*item.price));
    // Short, stable product URL: opens the storefront and highlights the exact product ID.
    lines.push('المنتج: https://shajarat-adam.pages.dev/?product='+encodeURIComponent(item.id));
    lines.push('');
  });
  lines.push('━━━━━━━━━━━━','💰 *المجموع: '+fmt(totals().price)+'*','','👤 *بيانات الزبون*','الاسم: '+name,'الهاتف: '+digits,'الاستلام: '+(mode==='delivery'?'توصيل':'من المحل'));
  if(mode==='delivery'&&address)lines.push('العنوان: '+address);
  if(mode==='delivery'&&deliveryLocation)lines.push('الموقع: '+deliveryLocationUrl());
  if(note)lines.push('ملاحظات: '+note);
  const url='https://wa.me/9647706848869?text='+encodeURIComponent(lines.join('\n'));
  playSound('confirm');
  window.location.href=url;
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
  const favorite=event.target.closest('[data-favorite]');
  if(favorite){const id=Number(favorite.dataset.favorite);if(favoriteIds.has(id))favoriteIds.delete(id);else favoriteIds.add(id);try{localStorage.setItem(favoriteKey,JSON.stringify([...favoriteIds]))}catch(_error){}categories=menuCategories();if(active==='المفضلة'&&!favoriteIds.size)active='الكل';renderCats();renderPopular();renderMenu();focusSharedProduct();return}
  const chooseButton=event.target.closest('[data-choose]');
  if(chooseButton){openWeightChoice(Number(chooseButton.dataset.choose));return}
  const addButton=event.target.closest('[data-add]');
  if(addButton){const item=itemMap.get(Number(addButton.dataset.add));if(item){const variants=productVariants(item);if(variants.length>1){showWeightChooser(item,variants)}else add(item.id)}return}
  const cat=event.target.closest('[data-category]');
  if(cat){active=cat.dataset.category;renderCats();renderMenu();byId('allMenu').scrollIntoView({behavior:'smooth'});return}
  const adjust=event.target.closest('[data-change]');
  if(adjust){change(Number(adjust.dataset.change),Number(adjust.dataset.delta));return}
  const remove=event.target.closest('[data-remove]');
  if(remove){delete cart[remove.dataset.remove];updateCart();renderCart();return}
  if(event.target.closest('[data-open-cart]'))openCart();
});
document.addEventListener('error',event=>{
  if(event.target.matches?.('.food-image'))event.target.replaceWith(Object.assign(document.createElement('div'),{className:'food-placeholder',innerHTML:'<img src="assets/images/logo.svg" alt=""><span class="submark">مطعم شجرة آدم</span>'}));
},true);
byId('q').addEventListener('input',renderMenu);
byId('menuToggle').addEventListener('click',()=>{const nav=byId('quickNav');nav.hidden=!nav.hidden;byId('menuToggle').setAttribute('aria-expanded',String(!nav.hidden))});
byId('quickNav').addEventListener('click',event=>{if(event.target.closest('a,button')){byId('quickNav').hidden=true;byId('menuToggle').setAttribute('aria-expanded','false')}});
byId('searchJump').addEventListener('click',()=>{byId('q').scrollIntoView({behavior:'smooth',block:'center'});byId('q').focus({preventScroll:true})});
byId('resetSearch').addEventListener('click',()=>{byId('q').value='';renderMenu();byId('q').focus()});
byId('showAll').addEventListener('click',()=>{byId('q').value='';active='الكل';renderCats();renderMenu()});
byId('overlay').addEventListener('click',closeCart);
byId('closeCart').addEventListener('click',closeCart);
byId('clearCart').addEventListener('click',()=>{cart={};updateCart();renderCart()});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!byId('drawer').hidden)closeCart();
  if(event.key==='Tab'&&!byId('drawer').hidden){
    const focusable=[...byId('drawer').querySelectorAll('button,input,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('[hidden]'));
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

// The public Sheet supplies live data. The bundled menu stays available if the Sheet is private or offline.
function renderPromoFromBanners(){
 const banners=[{name:'واجهة حلويات شجرة آدم',description:'حياكم الله في متجرنا',image:'assets/images/shajarat-adam-storefront.webp',local:true},...(window.__adamBanners||[]).filter(p=>p.image)];
 const section=byId('promoSlider'),track=byId('promoTrack'),dots=byId('promoDots');if(!section)return;
 section.hidden=!banners.length;
 track.innerHTML=banners.map((p,i)=>'<article class="promo-slide"><img src="'+escapeHtml(p.image)+'" alt="'+escapeHtml(p.name)+'" loading="'+(i?'lazy':'eager')+'"><div class="promo-caption"><strong>'+escapeHtml(p.name)+'</strong>'+(p.description?'<span>'+escapeHtml(p.description)+'</span>':'')+'</div></article>').join('');
 dots.innerHTML=banners.map((p,i)=>'<button type="button" aria-label="الصورة '+(i+1)+'" data-slide="'+i+'"'+(i===0?' class="selected"':'')+'></button>').join('');
 dots.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>track.children[Number(b.dataset.slide)]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})));
 track.onscroll=()=>{const i=Math.round(track.scrollLeft/Math.max(1,track.clientWidth));dots.querySelectorAll('button').forEach((b,n)=>b.classList.toggle('selected',n===Math.abs(i)))};
}
function loadSheetMenu(){
  const callback='__shajaratAdamMenuResponse';
  const script=document.createElement('script');
  let finished=false;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);script.remove();delete window[callback]};
  window[callback]=response=>{
    try{
      const rows=response?.table?.rows;
      if(response.status!=='ok'||!Array.isArray(rows))return;
      const incoming=rows.map(row=>{
        const c=row.c||[],v=i=>c[i]?.v;
        const id=Number(v(0)),rawPrice=v(2),price=Number(rawPrice),name=String(v(1)||'').trim(),category=String(v(3)||'').trim();
        const rawImage=String(v(5)||'').trim();
        const image=/^https:\/\//i.test(rawImage)||/^assets\/images\/[\w./-]+$/i.test(rawImage)?rawImage:'';
        const active=v(7);
        if(!Number.isSafeInteger(id)||id<0||(rawPrice===null||rawPrice===undefined||rawPrice===''||!Number.isFinite(price))||price<0||!name||!category||active===false||String(active).toLowerCase()==='false')return null;
        const old_price=Number(v(8))||0,offer=v(9)===true||String(v(9)).toLowerCase()==='true';
        return {id,name,price,category,description:String(v(4)||'').trim(),image,badge:String(v(6)||'').trim(),old_price,offer,weight:String(v(10)||'').trim()};
      }).filter(Boolean);
      if(!incoming.length||new Set(incoming.map(item=>item.id)).size!==incoming.length)return;
      menuItems=incoming.filter(item=>item.category!=='سلايدر العروض');const banners=incoming.filter(item=>item.category==='سلايدر العروض');window.__adamBanners=banners;itemMap=new Map(menuItems.map(item=>[item.id,item]));renderPromoFromBanners();
      for(const id of Object.keys(cart))if(!itemMap.has(Number(id)))delete cart[id];
      categories=menuCategories();
      if(!categories.includes(active))active='الكل';
      renderCats();renderPopular();renderMenu();focusSharedProduct();focusSharedProduct();updateCart();renderCart();
    }finally{finish()}
  };
  script.onerror=finish;
  const timer=setTimeout(finish,25000);
  const query='out:json;responseHandler:'+callback;
  const select='select A,B,C,D,E,F,G,H,I,J,K where B is not null';
  script.src='https://docs.google.com/spreadsheets/d/10oltsuuqDYiIXNPSiUMEgdXuJ2CF_eWQN9ZK3hdDt30/gviz/tq?sheet='+encodeURIComponent('المنتجات')+'&tqx='+encodeURIComponent(query)+'&tq='+encodeURIComponent(select)+'&v='+Date.now();
  document.head.appendChild(script);
}
function loadApiMenu(){
 const endpoint='https://script.google.com/macros/s/AKfycbyVRN3Zb-8ttbA9wqBmae8Zzofdw6f7zN3jFGs1wRtjMGG51rWM5KSCL4bLTWMrznpC/exec';
 const cb='__adamPublicMenu_'+Date.now();
 const script=document.createElement('script');
 let done=false;
 const finish=()=>{if(done)return;done=true;clearTimeout(timer);script.remove();delete window[cb]};
 window[cb]=response=>{
  try{
   const rows=Array.isArray(response?.products)?response.products:[];
   const incoming=rows.filter(p=>p&&p.active!==false&&String(p.active).toLowerCase()!=='false'&&p.price!==''&&p.price!==null&&Number.isFinite(Number(p.price))&&String(p.name||'').trim()&&String(p.category||'').trim()).map(p=>({
    id:Number(p.id),name:String(p.name),category:String(p.category),price:Number(p.price),description:String(p.description||''),image:/^https:\/\//i.test(String(p.image||''))?String(p.image):'',badge:String(p.badge||''),old_price:Number(p.old_price)||0,offer:p.offer===true||String(p.offer).toLowerCase()==='true',weight:String(p.weight||'')
   })).filter(p=>Number.isSafeInteger(p.id));
   if(!incoming.length||new Set(incoming.map(p=>p.id)).size!==incoming.length)return;
   menuItems=incoming.filter(p=>p.category!=='سلايدر العروض');window.__adamBanners=incoming.filter(p=>p.category==='سلايدر العروض');itemMap=new Map(menuItems.map(p=>[p.id,p]));renderPromoFromBanners();
   categories=menuCategories();if(!categories.includes(active))active='الكل';
   renderCats();renderPopular();renderMenu();focusSharedProduct();focusSharedProduct();updateCart();renderCart();
  }finally{finish()}
 };
 script.onerror=finish;const timer=setTimeout(finish,18000);
 script.src=endpoint+'?action=products&callback='+encodeURIComponent(cb)+'&v='+Date.now();
 document.head.appendChild(script);
}
loadSheetMenu();loadApiMenu();
document.addEventListener('change',event=>{const el=event.target.closest('.weight-picker');if(!el)return;selectedWeights[el.dataset.weightKey]=el.value;renderMenu();renderPopular()});