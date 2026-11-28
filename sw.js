// Cache-first untuk aset aplikasi. Panggilan Supabase tidak di-cache. Naikkan V setiap rilis.
const V = 'warungku-v10';
const A = ['./', 'index.html', 'env.js', 'manifest.webmanifest', 'icons/icon.svg', 'css/styles.css', 'js/main.js', 'js/config.js',
  'js/utils/money.js', 'js/utils/dom.js', 'js/services/db.js', 'js/services/supabase.js', 'js/services/sync.js', 'js/data/demo.js',
  'js/pages/auth.js', 'js/pages/kasir.js', 'js/pages/produk.js', 'js/pages/transaksi.js', 'js/pages/dashboard.js', 'js/pages/inventaris.js', 'js/pages/pengaturan.js', 'js/pages/pengguna.js', 'js/pages/laporan.js', 'js/pages/pengeluaran.js', 'js/pages/lainnya.js', 'js/services/storage.js', 'js/data/fonts.js', 'js/data/menu.js', 'js/utils/glow.js', 'js/utils/banner.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(A)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; const u = new URL(e.request.url);
  if (u.hostname === 'cdn.jsdelivr.net') { // pustaka grafik (ECharts): cache saat pertama dimuat agar tersedia offline
    e.respondWith(caches.open(V).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; })))); return; }
  if (u.origin === location.origin) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });