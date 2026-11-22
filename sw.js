// Cache-first untuk aset aplikasi. Naikkan V setiap rilis agar cache lama dibuang.
const V = 'warungku-v1';
const A = ['./', 'index.html', 'env.js', 'manifest.webmanifest', 'icons/icon.svg', 'css/styles.css', 'js/main.js', 'js/config.js',
  'js/utils/money.js', 'js/utils/dom.js', 'js/services/db.js', 'js/data/demo.js',
  'js/pages/kasir.js', 'js/pages/produk.js', 'js/pages/transaksi.js', 'js/pages/dashboard.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(A)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => { if (e.request.method === 'GET') e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
