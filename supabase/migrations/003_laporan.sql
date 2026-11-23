-- Jalankan setelah 002_produksi.sql. Pengeluaran usaha: hanya owner/admin.
create table expenses (id uuid primary key, business_id uuid not null references businesses(id) on delete cascade, at date not null, category text not null,
  amount integer not null check (amount > 0), note text, created_by uuid default auth.uid());
alter table expenses enable row level security;
create policy expenses_select on expenses for select using (is_member(business_id, '{owner,admin}'));
create policy expenses_write on expenses for all using (is_member(business_id, '{owner,admin}')) with check (is_member(business_id, '{owner,admin}'));
