// Service worker: "rede primeiro" para o app (as mudanças chegam sempre que há internet)
// e cópia local para funcionar sem conexão. Fotos: usa a cópia local e atualiza em segundo plano.
const CACHE = 'arh-v4';
const ESSENCIAIS = ['./', 'index.html', 'css/app.css', 'data/pratos.json', 'icone.svg', 'manifest.webmanifest',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/catalogo.js', 'js/sorteio.js', 'js/audio.js', 'js/abertura.js', 'js/roleta.js',
  'js/modal.js', 'js/carrossel.js', 'js/cozinha.js', 'js/nav.js', 'js/telas.js', 'js/telas2.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fotoWikimedia = /(^|\.)wikimedia\.org$/.test(url.hostname) && req.destination === 'image';
  if (url.origin !== location.origin && !fotoWikimedia) return;   // Wikipédia, YouTube etc.: direto na rede
  if (url.pathname.includes('/fotos/') || fotoWikimedia) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const salvo = await c.match(req);
      // fotos de outro domínio chegam "opacas" (status 0): também valem para o cache
      const rede = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => salvo);
      return salvo || rede;
    }));
    return;
  }
  e.respondWith(fetch(req, { cache: 'no-cache' })
    .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); } return r; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
