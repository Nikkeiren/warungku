-- Jalankan setelah 003. Tampilan usaha, gambar produk, dan bucket Storage privat.
alter table businesses add column if not exists description text,
  add column if not exists name_font text not null default '' check (length(name_font) <= 40),
  add column if not exists banner_path text,
  add column if not exists bg_mode text not null default 'default' check (bg_mode in ('default','color','image')),
  add column if not exists bg_color text check (bg_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists bg_path text,
  add column if not exists bg_overlay integer not null default 40 check (bg_overlay between 0 and 90);
alter table products add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('warungku-images', 'warungku-images', false, 1048576, array['image/webp','image/jpeg','image/png']) on conflict (id) do nothing;
-- Path file: {business_id}/products/{uuid}.webp atau {business_id}/branding/{uuid}.webp
-- Baca: anggota usaha tsb. Tulis/hapus: produk oleh owner/admin, branding hanya owner. Tidak ada policy update (nama file unik).
create policy img_read on storage.objects for select to authenticated
  using (bucket_id = 'warungku-images' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy img_insert on storage.objects for insert to authenticated with check (bucket_id = 'warungku-images' and (
  ((storage.foldername(name))[2] = 'products' and public.is_member(((storage.foldername(name))[1])::uuid, '{owner,admin}')) or
  ((storage.foldername(name))[2] = 'branding' and public.is_member(((storage.foldername(name))[1])::uuid, '{owner}'))));
create policy img_delete on storage.objects for delete to authenticated using (bucket_id = 'warungku-images' and (
  ((storage.foldername(name))[2] = 'products' and public.is_member(((storage.foldername(name))[1])::uuid, '{owner,admin}')) or
  ((storage.foldername(name))[2] = 'branding' and public.is_member(((storage.foldername(name))[1])::uuid, '{owner}'))));
