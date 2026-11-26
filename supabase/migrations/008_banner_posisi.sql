-- 008: posisi dan zoom gambar banner topbar (disimpan per usaha). Aman dijalankan ulang.
-- Tidak ada perubahan policy: kolom ikut policy biz_update (hanya owner) yang sudah ada.
alter table businesses
  add column if not exists banner_x integer not null default 50 check (banner_x between 0 and 100),
  add column if not exists banner_y integer not null default 50 check (banner_y between 0 and 100),
  add column if not exists banner_zoom integer not null default 100 check (banner_zoom between 100 and 300);
