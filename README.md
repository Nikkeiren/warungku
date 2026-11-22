# Warungku: Kelola Usaha, Lebih Mudah.
Universal POS (PWA, HTML/CSS/JS modular tanpa build step). **v1 adalah irisan inti**: kasir, produk, transaksi, ringkasan. Berjalan penuh secara lokal dalam mode demo.

## 1. Struktur
```
index.html  env.js  sw.js  manifest.webmanifest  package.json
css/styles.css                      token warna & komponen
js/main.js                          router hash, indikator koneksi, service worker
js/config.js                        konfigurasi (pajak, biaya, nominal cepat, env)
js/utils/{money,dom}.js             rupiah integer & kalkulator aman | helper DOM, ikon, toast
js/services/db.js                   IndexedDB: produk, transaksi, audit (idempoten, atomik)
js/data/demo.js                     data contoh (bertanda demo)
js/pages/{kasir,produk,transaksi,dashboard}.js
supabase/schema.sql                 tabel + RLS per usaha
```
## 2. Arsitektur
- Halaman = modul `render(el)` + fungsi pembersih; router memuatnya dengan `import()`.
- Data lokal di IndexedDB (bukan localStorage). Database demo (`warungku-demo`) terpisah dari produksi.
- Uang disimpan sebagai integer rupiah; pajak dibulatkan dengan `Math.round`.
- Anti transaksi ganda: id UUID dibuat saat keranjang mulai, penyimpanan idempoten, tombol Bayar dikunci saat menyimpan. Transaksi dan stok disimpan dalam satu transaksi IndexedDB.
- Pembatalan: status `batal` + alasan wajib + stok dikembalikan + catatan di `audit`. Transaksi tidak dihapus.
- Offline: service worker cache-first. Transaksi baru bertanda `synced:false` dan dihitung di header sebagai "tersimpan lokal". **Sinkronisasi ke Supabase belum ada**, jadi aplikasi tidak pernah mengklaim data sudah tersinkron.
- Supabase: `schema.sql` (isolasi per usaha lewat `memberships`, role owner/admin/kasir, tanpa policy delete untuk riwayat). Tidak ada service_role di frontend.
## 3. Komponen UI
`.btn` (`.primary .danger .sm .lg`), `.input`, `.chips`, `.pcard`, `.item/.list`, `.stat/.panel`, `.cart`, `.calc/.keys`, `dialog#dlg`, `toast()`, `icon()`. Token di `:root` (`--pri` pine, `--gold` kunyit, `--bg`).
## 4. Sudah berfungsi
Kasir (cari, filter kategori, keranjang, kuantitas manual, diskon transaksi, catatan, pajak/biaya via `config.js`, 4 metode bayar), kalkulator cepat (+ − × ÷, nominal cepat, uang pas, kembalian otomatis, sentuhan dan keyboard), struk (cetak, bagikan), stok berkurang saat jual, produk (tambah/ubah/hapus, SKU, modal, jual, kategori, satuan, stok, aktif), transaksi (cari, filter metode, detail, batal), ringkasan (periode termasuk rentang khusus, grafik, terlaris, per metode, stok menipis, laba kotor dari HPP), PWA dasar, data demo.
## 5. Belum selesai
Supabase Auth, mode produksi, dan sinkronisasi antrean; UI role/izin; varian produk; foto produk; manajemen kategori terpisah; stok masuk/keluar/penyesuaian, pemasok, resep/BOM; diskon per item; pelanggan; pengeluaran; laporan per kategori/mingguan/bulanan/tahunan, ekspor CSV/PDF; halaman pengaturan usaha; ikon PNG untuk PWA (saat ini SVG). Pengujian di browser belum dilakukan.
## 6. Menjalankan
`npx serve .` lalu buka `http://localhost:3000` (wajib localhost atau HTTPS untuk service worker dan `crypto.randomUUID`). Naikkan `V` di `sw.js` tiap rilis.
## 7. Konfigurasi Supabase
1. Buat project. 2. Jalankan `supabase/schema.sql`. 3. Aktifkan Auth Email. 4. Isi env di bawah. Auth dan sinkronisasi adalah langkah berikutnya.
## 8. Environment variables
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (hanya anon key). Dibaca `env.js` ke `config.js`; belum dipakai klien Supabase di v1.
## 9. Deployment Vercel
Framework: Other. Output directory: `.` Build command: `echo "window.WARUNGKU_ENV={SUPABASE_URL:'$SUPABASE_URL',SUPABASE_ANON_KEY:'$SUPABASE_ANON_KEY'}" > env.js`
