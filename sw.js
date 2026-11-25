// Guarda o app no celular para abrir na hora, mesmo sem internet.
// Sempre tenta a versão nova primeiro; sem internet, usa a guardada.
const VERSAO = 'pratocerto-v7';
const ARQUIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'alimentos.js', 'gemini.js', 'lista.js', 'firebase-config.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const EXTERNOS = ['https://www.gstatic.com/firebasejs/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO)
    .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  const meu = url.startsWith(self.location.origin);
  if (!meu && !EXTERNOS.some(p => url.startsWith(p))) return; // Firebase/Google login passam direto
  e.respondWith(fetch(req, meu ? { cache: 'no-cache' } : undefined).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (meu ? caches.match('index.html') : Response.error()))));
});
