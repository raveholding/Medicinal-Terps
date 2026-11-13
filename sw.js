/* Sistema VB · Medicinal Terps · service worker de la app del equipo (v3.6)
   Sólo guarda una copia de la página para poder abrir la app sin conexión (los datos ya viven cifrados en el equipo).
   Con conexión SIEMPRE se usa la versión publicada (red primero), así nunca queda una versión vieja.
   No toca pedidos a otros sitios (la nube, Google) ni pedidos que no sean GET. */
const CACHE='terps-equipo-v1';
const SHELL=['./','./app-equipo.webmanifest','./assets/app-192.png','./assets/app-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('terps-equipo-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==self.location.origin)return;
 const base=new URL('./',self.registration.scope).pathname;
 /* sólo la página del sistema (no privacidad.html ni otras) */
 const nav=r.mode==='navigate'&&(u.pathname===base||u.pathname===base+'index.html');
 const mine=nav||SHELL.some(p=>new URL(p,self.registration.scope).pathname===u.pathname);
 if(!mine)return;
 const key=nav?new URL('./',self.registration.scope).href:r;
 e.respondWith(fetch(r).then(res=>{if(res&&res.ok&&res.type==='basic'){const cp=res.clone();caches.open(CACHE).then(c=>c.put(key,cp)).catch(()=>{})}return res})
  .catch(()=>caches.match(key).then(m=>m||new Response('<!doctype html><meta charset="utf-8"><title>Sin conexión</title><p style="font:16px system-ui;padding:24px">Sin conexión y sin copia guardada. Conectate una vez y volvé a abrir la app.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}))))});
