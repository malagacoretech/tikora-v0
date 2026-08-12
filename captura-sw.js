/* Tikora — service worker de la app de captura.
   Alcance: SOLO captura.html y sus assets. index.html (el wallet) no se intercepta jamás.
   Al publicar cambios en captura.html, subir VERSION para invalidar la caché. */
var VERSION = 'tikora-captura-v73'; /* v73: dos ritmos para la ventana de pago - Tranquilo 6s y Rapido 3s, a un toque */
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
    var listo = false;
    function fin(v){ if (!listo){ listo = true; res(v); } }
    /* v58: onblocked + timeout — sin esto la promesa podía no resolver JAMÁS y la notificación no salía */
    setTimeout(function(){ fin(null); }, 1500);
    try {
      var rq = indexedDB.open('tikora', 1);
      rq.onupgradeneeded = function(){ rq.result.createObjectStore('kv'); };
      rq.onblocked = function(){ fin(null); };
      rq.onsuccess = function(){
        try {
          var g = rq.result.transaction('kv', 'readonly').objectStore('kv').get('token');
          g.onsuccess = function(){ fin(g.result || null); };
          g.onerror = function(){ fin(null); };
        } catch(e){ fin(null); }
      };
      rq.onerror = function(){ fin(null); };
    } catch(e){ fin(null); }
  });
}
function esperar(ms){ return new Promise(function(res){ setTimeout(function(){ res(null); }, ms); }); }
self.addEventListener('push', function(e){
  /* v58: mostrar YA, enriquecer después (patrón del Cowork paralelo). La genérica suena en el acto pase lo que pase;
     la detallada la SUSTITUYE (mismo tag) sin sonar dos veces. Peor caso: aviso genérico — nunca silencio. */
  var basico = { body: 'Entró una boleta nueva', icon: '/favicons/android-chrome-192x192.png', badge: '/favicons/android-chrome-192x192.png', tag: 'tikora-boleta', renotify: true, data: { url: '/captura.html' } };
  e.waitUntil(
    self.registration.showNotification('Tikora', basico)
      .then(function(){ return swToken(); })
      .then(function(tok){
        if (!tok) return null;
        return Promise.race([
          fetch(PANEL_URL_SW + '?u=' + encodeURIComponent(tok), { headers: { 'x-tikora-app': APP_SECRET_SW } }).then(function(r){ return r.json(); }),
          esperar(4000)
        ]);
      })
      .then(function(d){
        var rows = (d && d.rows) || [];
        var f = rows.length ? rows[rows.length - 1] : null;
        if (!f) return;
        var imp = f.total ? (String(f.total).replace('.', ',') + ' €') : 'importe por leer';
        var fid = (String(f.foto || '').match(/\/d\/([^\/?]+)/) || [])[1] || '';
        return self.registration.showNotification('Tikora — boleta nueva', {
          body: (f.emisor || 'emisor por leer') + ' · ' + imp,
          icon: '/favicons/android-chrome-192x192.png',
          badge: '/favicons/android-chrome-192x192.png',
          tag: 'tikora-boleta', renotify: false,
          data: { url: '/captura.html' + (fid ? ('?chat=' + fid) : ''), f: fid }
        });
      })
      .catch(function(){})
  );
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var d = e.notification.data || {};
  var url = d.url || '/captura.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ws){
    for (var i = 0; i < ws.length; i++){
      var w = ws[i];
      if ('focus' in w){
        /* v57: la app ya está abierta — se le susurra la factura por mensaje (sin recargar) y se trae al frente */
        try { w.postMessage({ tikora: 'chat', f: d.f || '' }); } catch(err){}
        return w.focus();
      }
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
