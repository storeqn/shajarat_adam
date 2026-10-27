'use strict';
const VERSION='adam-shell-v3',IMAGES='adam-images-v3';
const SHELL=['./','./index.html','./style.css?v=shajarat-20261027-7','./enhancements.css?v=3','./store.js?v=3','./app.js?v=3','./data/menu.js?v=3','./data/image-map.js?v=3','./manifest.json','./assets/images/logo.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('adam-')&&![VERSION,IMAGES].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('admin'))return;
 if(/\.(?:webp|png|svg|jpg)$/.test(url.pathname)){
  event.respondWith(caches.open(IMAGES).then(async c=>{const cached=await c.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response.ok){await c.put(event.request,response.clone());const keys=await c.keys();if(keys.length>60)await c.delete(keys[0])}return response}));return;
 }
 if(event.request.mode==='navigate'||/\.(?:js|css|json)$/.test(url.pathname)){
  event.respondWith(fetch(event.request).then(async response=>{if(response.ok){const c=await caches.open(VERSION);await c.put(event.request,response.clone())}return response}).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return caches.match('./index.html');return Response.error()}));
 }
});
