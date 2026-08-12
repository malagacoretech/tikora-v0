/* Tikora — service worker de la app de captura.
   Alcance: SOLO captura.html y sus assets. index.html (el wallet) no se intercepta jamás.
   Al publicar cambios en captura.html, subir VERSION para invalidar la caché. */
var VERSION = 'tikora-captura-v57'; /* v57: manos libres — la app escucha ordenes ademas de cantar las facturas */
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

/* v53: avisos push. El push llega SIN datos (así no hace falta cifrado de payload):
   el SW despierta, lee el token de IndexedDB, consulta el panel y arma la notificación él mismo. */
var PANEL_URL_SW = 'https://malagacoretech.app.n8n.cloud/webhook/tikora-panel-70d26bc7d11fe857';
var APP_SECRET_SW = '309b95715f871dccf108c627fe3ff976ed58b22bc07ef420';
function swToken(){
  return new Promise(function(res){
    try {
      var rq = indexedDB.open('tikora', 1);
      rq.onupgradeneeded = function(){ rq.result.createObjectStore('kv'); };
      rq.onsuccess = function(){
        try {
          var g = rq.result.transaction('kv', 'readonly').objectStore('kv').get('token');
          g.onsuccess = function(){ res(g.result || null); };
          g.onerror = function(){ res(null); };
        } catch(e){ res(null); }
      };
      rq.onerror = function(){ res(null); };
    } catch(e){ res(null); }
  });
}
self.addEventListener('push', function(e){
  e.waitUntil(swToken().then(function(tok){
    var basico = { body: 'Entró una boleta nueva', icon: '/favicons/android-chrome-192x192.png', badge: '/favicons/android-chrome-192x192.png', tag: 'tikora-boleta', renotify: true, data: { url: '/captura.html' } };
    if (!tok) return self.registration.showNotification('Tikora', basico);
    return fetch(PANEL_URL_SW + '?u=' + encodeURIComponent(tok), { headers: { 'x-tikora-app': APP_SECRET_SW } })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var rows = (d && d.rows) || [];
        var f = rows.length ? rows[rows.length - 1] : null;
        if (!f) return self.registration.showNotification('Tikora', basico);
        var imp = f.total ? (String(f.total).replace('.', ',') + ' €') : 'importe por leer';
        var fid = (String(f.foto || '').match(/\/d\/([^\/?]+)/) || [])[1] || '';
        return self.registration.showNotification('Tikora — boleta nueva', {
          body: (f.emisor || 'emisor por leer') + ' · ' + imp,
          icon: '/favicons/android-chrome-192x192.png',
          badge: '/favicons/android-chrome-192x192.png',
          tag: 'tikora-boleta', renotify: true,
          data: { url: '/captura.html' + (fid ? ('?chat=' + fid) : '') }
        });
      })
      .catch(function(){ return self.registration.showNotification('Tikora', basico); });
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/captura.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ws){
    for (var i = 0; i < ws.length; i++){
      var w = ws[i];
      if ('focus' in w){ try { w.navigate(url); } catch(err){} return w.focus(); }
    }
    return clients.openWindow(url);
  }));
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
