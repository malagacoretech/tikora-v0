/* Tikora — service worker de la app de captura.
   Alcance: SOLO captura.html y sus assets. index.html (el wallet) no se intercepta jamás.
   Al publicar cambios en captura.html, subir VERSION para invalidar la caché. */
var VERSION = 'tikora-captura-v75'; /* v75: un aviso POR factura (se apilan) + botones Ver factura / Preguntar + factura destacada en el panel + foto desde el chip del chat */
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
/* v73: memoria de fids ya avisados — para que CADA factura tenga SU notificación (apilan, no se pisan) */
function swAvisados(){
  return new Promise(function(res){
    var listo = false;
    function fin(v){ if (!listo){ listo = true; res(v); } }
    setTimeout(function(){ fin({ lista: [], guardar: function(){} }); }, 1500);
    try {
      var rq = indexedDB.open('tikora', 1);
      rq.onupgradeneeded = function(){ rq.result.createObjectStore('kv'); };
      rq.onblocked = function(){ fin({ lista: [], guardar: function(){} }); };
      rq.onsuccess = function(){
        var db = rq.result;
        try {
          var g = db.transaction('kv', 'readonly').objectStore('kv').get('avisados');
          g.onsuccess = function(){
            var lista = Array.isArray(g.result) ? g.result : [];
            fin({ lista: lista, guardar: function(nueva){
              try { db.transaction('kv', 'readwrite').objectStore('kv').put(nueva.slice(-200), 'avisados'); } catch(e){}
            } });
          };
          g.onerror = function(){ fin({ lista: [], guardar: function(){} }); };
        } catch(e){ fin({ lista: [], guardar: function(){} }); }
      };
      rq.onerror = function(){ fin({ lista: [], guardar: function(){} }); };
    } catch(e){ fin({ lista: [], guardar: function(){} }); }
  });
}
self.addEventListener('push', function(e){
  /* v73: mostrar YA (garantía de sonido) → enriquecer con UNA notificación POR factura nueva,
     tag único por factura (se apilan, no se pisan) + botones "Ver factura" y "Preguntar". */
  var basico = { body: 'Entró una boleta nueva', icon: '/favicons/android-chrome-192x192.png', badge: '/favicons/android-chrome-192x192.png', tag: 'tikora-entrando', renotify: true, data: { url: '/captura.html', accionVer: '' } };
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
        if (!rows.length) return;
        return swAvisados().then(function(mem){
          var vistos = {};
          mem.lista.forEach(function(x){ vistos[x] = 1; });
          var nuevas = [];
          rows.forEach(function(f){
            var fid = (String(f.foto || '').match(/\/d\/([^\/?]+)/) || [])[1] || '';
            if (!fid || vistos[fid]) return;
            nuevas.push({ f: f, fid: fid });
          });
          if (!nuevas.length) return;
          var recientes = nuevas.slice(-5);   /* como mucho 5 avisos por tanda; el resto queda avisado en memoria */
          var proms = recientes.map(function(n){
            var imp = n.f.total ? (String(n.f.total).replace('.', ',') + ' €') : 'importe por leer';
            return self.registration.showNotification('Tikora — boleta nueva', {
              body: (n.f.emisor || 'emisor por leer') + ' · ' + imp,
              icon: '/favicons/android-chrome-192x192.png',
              badge: '/favicons/android-chrome-192x192.png',
              tag: 'tikora-' + n.fid, renotify: false,
              actions: [ { action: 'ver', title: '📄 Ver factura' }, { action: 'preguntar', title: '💬 Preguntar' } ],
              data: { url: '/captura.html?ver=' + n.fid, f: n.fid }
            });
          });
          mem.guardar(mem.lista.concat(nuevas.map(function(n){ return n.fid; })));
          return Promise.all(proms).then(function(){
            /* la genérica ya cumplió (sonó): se retira para no duplicar */
            return self.registration.getNotifications({ tag: 'tikora-entrando' }).then(function(ns){ ns.forEach(function(x){ x.close(); }); });
          });
        });
      })
      .catch(function(){})
  );
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var d = e.notification.data || {};
  var fid = d.f || '';
  /* v73: el botón decide — "preguntar" va al chat; "ver" (o tocar el cuerpo) abre la factura en el panel */
  var modo = (e.action === 'preguntar') ? 'chat' : 'ver';
  var url = fid ? ('/captura.html?' + modo + '=' + fid) : '/captura.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ws){
    for (var i = 0; i < ws.length; i++){
      var w = ws[i];
      if ('focus' in w){
        try { w.postMessage({ tikora: modo, f: fid }); } catch(err){}
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
