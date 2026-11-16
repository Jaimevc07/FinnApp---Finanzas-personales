// Service worker de Finanzas Hogar.
// - Páginas: red primero; sin conexión, la última versión guardada.
// - Archivos estáticos de Next (_next/static) e íconos: caché primero (llevan hash).
// - API: siempre red. La app guarda su propia copia de los datos para mostrarlos sin conexión.
const VERSION = 'fh-v1';
const PAGINAS = `${VERSION}-paginas`;
const ESTATICOS = `${VERSION}-estaticos`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pwa/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ESTATICOS).then(async cache => {
        const guardada = await cache.match(req);
        if (guardada) return guardada;
        const resp = await fetch(req);
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          if (resp.ok && !resp.redirected) {
            const copia = resp.clone();
            caches.open(PAGINAS).then(c => c.put(url.pathname, copia));
          }
          return resp;
        })
        .catch(async () => {
          const cache = await caches.open(PAGINAS);
          return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
        }),
    );
  }
});
