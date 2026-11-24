// Service worker: gör appen helt offline. Appskalet förcachas; AI-modellen
// (≈100 MB) hämtas av appen själv med förloppsindikator till cachen 'skog-model-v1'.
const VERSION = 'skog-shell-v2.1.0';
const TILE_CACHE = 'skog-tiles-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/db.js', './js/geo.js', './js/export.js', './js/worker.js', './js/map.js',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/layers.png',
  './vendor/ort.wasm.min.mjs', './vendor/ort-wasm-simd-threaded.mjs',
  './data/species.json', './data/text_emb.bin', './data/guide.json', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('skog-shell-') && k !== VERSION).map(k => caches.delete(k))
  ))
    // äldre versioner lade artinbäddningarna i modellcachen – ta bort så att de inte skuggar nya
    .then(() => caches.open('skog-model-v1')).then(c => c.delete('./data/text_emb.bin'))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) {
    // Kartplattor som laddats ner för offline (Lantmäteriet/egen adress) – OpenStreetMap cachas aldrig
    if (req.url.startsWith('https://tile.openstreetmap.org/')) return;
    e.respondWith(caches.open(TILE_CACHE).then(c => c.match(req.url)).then(hit => hit || fetch(req)));
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      // Fältguidens bilder sparas när de visas första gången (eller via "Spara bilder offline")
      if (res.ok && req.url.includes('/data/guide/')) { const c = await caches.open('skog-guide-v1'); c.put(req, res.clone()); }
      return res;
    } catch {
      if (req.mode === 'navigate') return caches.match('./index.html');
      return new Response('Offline', { status: 503 });
    }
  })());
});
