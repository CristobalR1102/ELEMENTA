// Guarda el juego en el teléfono para jugar sin internet.
// Al publicar una versión nueva, cambia VERSION para que los celulares la descarguen.
const VERSION = 'elementa-v20';
const ART = ['water1', 'water2', 'water3', 'fire1', 'fire2', 'fire3', 'plant1', 'plant2', 'plant3', 'elec2', 'elec3',
  'ice1', 'ice2', 'ice3', 'rock1', 'rock2', 'rock3', 'ghost1', 'ghost2', 'ghost3'];
const FILES = ['./', 'index.html', 'game.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  ...ART.map((k) => 'sprites/' + k + '.png')];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero intenta la red (así ves las actualizaciones); si no hay señal, usa la copia guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
