/* Tikora — service worker de la app de captura.
   Alcance: SOLO captura.html y sus assets. index.html (el wallet) no se intercepta jamás.
   Al publicar cambios en captura.html, subir VERSION para invalidar la caché. */
var VERSION = 'tikora-captura-v7'; /* v6: facturas clicables (abren la foto), drill-down por proveedor, IVA en grande */
var ASSETS = [
  '/captura.html',
  '/captura.webmanifest',
  '/favicons/android-chrome-192x192.png',
  '/favicons/android-chrome-512x512.png',
  '/favicons/apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(VERSION).then(function(c){
      return Promise.all(ASSETS.map(function(a){ return c.add(a).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k.indexOf('tikora-captura-') === 0 && k !== VERSION; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;                      /* el POST al webhook pasa directo */
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var path = url.pathname;

  if (path === '/captura.html'){
    /* red primero (updates al día), caché si no hay red */
    e.respondWith(
      fetch(req).then(function(resp){
        var copy = resp.clone();
        caches.open(VERSION).then(function(c){ c.put('/captura.html', copy); });
        return resp;
      }).catch(function(){ return caches.match('/captura.html'); })
    );
    return;
  }
  if (ASSETS.indexOf(path) >= 0){
    e.respondWith(
      caches.match(path).then(function(hit){ return hit || fetch(req); })
    );
  }
  /* cualquier otra ruta (index.html incluido): el navegador, sin tocar */
});
