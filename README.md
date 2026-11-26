# Warungku: Kelola Usaha, Lebih Mudah.
POS universal (PWA, HTML/CSS/JS modular, tanpa build step) dengan backend Supabase. Status: **belum lengkap**; lihat bagian 5.

## 1. Struktur
\`\`\`
index.html env.js sw.js manifest.webmanifest package.json
css/styles.css
js/main.js            router, akses per role, sinkronisasi otomatis, status koneksi
js/config.js          konfigurasi (env.js -> SUPABASE_URL, SUPABASE_ANON_KEY)
js/utils/{money,dom}.js
js/services/db.js         IndexedDB: cache lokal + antrean transaksi (satu database per usaha)
js/services/supabase.js   klien REST (Auth + PostgREST + RPC), refresh token otomatis
js/services/sync.js       pull, flush antrean, void, produk, stok, riwayat stok
js/data/demo.js           data contoh (hanya mode demo)
js/pages/{auth,kasir,produk,inventaris,transaksi,lainnya,dashboard,laporan,pengeluaran,pengaturan,pengguna}.js
js/services/storage.js  kompres, unggah, signed URL gambar | js/data/{fonts,menu}.js
supabase/schema.sql                  tabel dasar + RLS
supabase/migrations/002_produksi.sql kolom pengaturan, fungsi server, pengetatan RLS
supabase/migrations/003_laporan.sql  tabel pengeluaran + RLS
supabase/migrations/004_tampilan.sql kolom tampilan, image_path, bucket Storage + policy
\`\`\`
## 2. Arsitektur
- Server (Supabase) adalah sumber kebenaran. IndexedDB hanya cache baca dan antrean transaksi saat offline.
- Transaksi dikirim lewat fungsi \`create_sale\`: tervalidasi (total, kembalian), atomik (transaksi + item + stok), idempoten (id UUID dari klien). Klien tidak punya izin INSERT/UPDATE langsung ke tabel transaksi.
- Status transaksi: \`menunggu\` (di antrean), \`tersinkron\` (dikonfirmasi server), \`gagal\` (ditolak server, ada tombol Kirim ulang). Offline atau error 5xx tetap \`menunggu\` dan dicoba lagi otomatis (saat online kembali dan tiap 30 detik).
- Pembatalan (\`void_sale\`), perubahan stok (\`adjust_stock\`), dan anggota (\`set_member\`) berjalan di server, hanya online, dan tercatat di \`audit_log\`.
- Role: owner (semua), admin (produk, inventaris, ringkasan, pembatalan), kasir (kasir dan riwayat). Menu disaring di UI, izin sebenarnya dipaksa RLS dan fungsi server.
- Uang selalu integer rupiah. Hanya anon key di frontend.
## 3. Komponen UI
\`.btn\`, \`.input\`, \`.chips\`, \`.pcard\`, \`.item/.list\`, \`.stat/.panel\`, \`.cart\`, \`.calc/.keys\`, \`dialog#dlg\`, \`toast()\`, \`icon()\`. Token warna di \`:root\`.
## 4. Sudah berfungsi
Daftar/masuk, daftarkan usaha, kasir lengkap (kalkulator, kembalian, nominal cepat, struk, pajak dan biaya layanan dari pengaturan), produk (tambah/ubah/hapus ke server), inventaris (stok masuk/keluar/penyesuaian + riwayat), transaksi (riwayat dari semua perangkat, batal dengan alasan, status sinkronisasi), ringkasan (periode, grafik, terlaris, stok menipis, laba kotor), pengeluaran per kategori, laporan (harian/pekanan/bulanan/tahunan, per produk/kategori/metode, kurang laku, stok, HPP, laba kotor dan bersih, ekspor CSV, cetak ke PDF lewat dialog cetak browser), pengaturan usaha, pengguna (tambah/ubah/hapus kasir dan admin), PWA dan antrean offline, mode demo terpisah.
## 5. Belum selesai (jujur)
**Belum diuji terhadap Supabase sungguhan** (tidak ada kredensial/jaringan di lingkungan pengembangan); hanya logika klien dan sintaks yang diuji. SQL belum dijalankan di PostgreSQL. Belum ada: manajemen kategori terpisah, foto produk dan Storage, varian/modifier, barcode scanner, diskon per item, supplier dan pembelian, resep/BOM, pelanggan, pengeluaran, logo/mata uang/format struk/metode bayar di pengaturan, pengembalian dana terpisah dari pembatalan, produk dan transaksi dibatasi 1000/500 baris saat pull, satu usaha per akun, penulisan produk hanya online.
## 6. Menjalankan
\`npx serve .\` lalu buka \`http://localhost:3000\` (wajib localhost atau HTTPS).
## 7. Konfigurasi Supabase (tindakan pemilik proyek)
1. Buat project Supabase. 2. SQL Editor: jalankan \`supabase/schema.sql\`, lalu \`supabase/migrations/002_produksi.sql\` \`003_laporan.sql\`, dan \`004_tampilan.sql\` (membuat bucket privat \`warungku-images\` beserta policy-nya; tidak perlu membuat bucket manual). 3. Authentication: atur konfirmasi email sesuai kebutuhan. 4. Isi \`env.js\` dengan Project URL dan anon key (Settings, API). Jangan pernah menaruh service_role key di frontend.
## 8. Environment variables
\`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`.
## 9. Vercel
Framework: Other. Output: \`.\` Build command: \`echo "window.WARUNGKU_ENV={SUPABASE_URL:'$SUPABASE_URL',SUPABASE_ANON_KEY:'$SUPABASE_ANON_KEY'}" > env.js\`

## 10. Pembaruan: tampilan, gambar, navigasi
- Navbar bawah 5 menu (Kasir, Transaksi, Produk, Inventaris, Lainnya); Ringkasan, Laporan, Pengeluaran, Pengguna, Pengaturan ada di Lainnya.
- Nama usaha, font (15 pilihan, Google Fonts, perlu internet saat pertama dimuat), banner, dan background tersimpan per usaha di \`businesses\`; gambar di Storage \`warungku-images/{business_id}/products|branding/{uuid}.webp\`, privat, dibaca lewat signed URL 24 jam. Gambar produk dan branding tidak tampil saat offline.
- Tombol Back: menutup dialog/keranjang dulu, lalu mundur satu halaman; di halaman paling awal muncul dialog keluar. Zoom dinonaktifkan lewat meta viewport dan touch-action.
- Akar masalah layout Ringkasan/Laporan: grid \`1fr\` dengan input tanggal (min-content lebih lebar dari layar) membuat halaman lebih lebar dari viewport; Chrome Android lalu memperkecil seluruh halaman dan zoom itu terbawa karena aplikasi satu dokumen. Diperbaiki dengan \`minmax(0,1fr)\`, \`min-width:0\`, struktur filter tanpa grid bersarang, dan viewport tanpa zoom.

## 11. Urutan migrasi (jalankan berurutan di SQL Editor)
\`schema.sql\`, \`002_produksi.sql\`, \`003_laporan.sql\`, \`004_hardening.sql\`, \`004_tampilan.sql\`, \`005_policy_cleanup.sql\`, \`006_policy_split.sql\`, \`007_sinkron_offline.sql\`.
- \`007\` menggantikan \`create_sale\` dari \`004_hardening\`: penjualan yang sudah terjadi di kasir tetap diterima saat sinkron walau harga/modal berubah, stok kurang, atau produk sudah dihapus. Selisih dicatat di \`audit_log\` (action \`sinkron_selisih\`; belum ada halaman di aplikasi untuk melihatnya, cek lewat SQL Editor).
- Konsekuensi: kasir yang membuat payload sendiri bisa mengirim harga berbeda dari harga produk; hal itu tidak ditolak, tetapi tercatat.

## 12. Kasir: landscape dan pengalaman produk
- \`html.ls\` (landscape dan tinggi layar <= 600px) mengaktifkan sidebar yang bisa digeser (kiri = tutup, kanan dari sisi kiri = buka; ada juga tab kecil di tepi kiri dan tombol Sembunyikan menu). Portrait dan desktop tidak berubah.
- Landscape: keranjang tersembunyi sampai bilah Keranjang ditekan; memilih produk tidak membuka keranjang. Isi keranjang tetap saat kembali ke daftar produk.
- Kartu produk memakai kontrol kuantitas (- jumlah +), kolom Diskon dihapus dari keranjang (state diskon tetap 0, kolom server tidak berubah), cahaya ambient dari warna dominan foto (hanya untuk produk berfoto dan berwarna), pencarian lewat tombol mengambang.
- Tidak ada perubahan SQL.

## 13. Pembaruan: Ringkasan, banner, gestur mobile, ukuran UI
- **Wajib: jalankan \`supabase/migrations/008_banner_posisi.sql\`** (kolom \`banner_x\`, \`banner_y\`, \`banner_zoom\`). Tanpa ini, menyimpan banner dan "Reset tampilan" akan gagal. Urutan migrasi: ... \`007_sinkron_offline.sql\`, \`008_banner_posisi.sql\`.
- Ringkasan: Apache ECharts 5.5.1 dimuat dari jsDelivr hanya saat halaman dibuka, lalu di-cache service worker. Data periode diambil langsung dari Supabase (transaksi \`selesai\`, bertahap 1000 baris); pendapatan hanya dari transaksi selesai yang sudah tersinkron. Offline: memakai data di perangkat.
- Banner: gambar \`object-fit: cover\` + \`scale()\` hanya pada gambar, posisi % dan zoom disimpan per usaha; pratinjau dan topbar memakai CSS yang sama.
- Stok produk: kolom stok bisa diedit. Stok awal (produk tanpa stok) disimpan langsung; mengubah stok produk berstok memakai \`adjust_stock\` (atomik + audit).
- UI: design tokens di \`:root\` (font, jarak, radius, tinggi kontrol, ikon, topbar, sidebar). Tanpa perubahan SQL selain 008.
- Audit ukuran (otomatis, 4 layar x 12 tampilan termasuk login, dialog, dan keranjang): tidak ada teks <12px, kontrol input selalu 16px, tombol <36px, atau elemen di luar layar. Keranjang menampilkan semua metode bayar dan nominal cepat tanpa geser horizontal.