-- Warungku: skema inti Supabase. Jalankan di SQL Editor. Semua uang = integer rupiah.
create extension if not exists pgcrypto;
create type member_role as enum ('owner','admin','kasir');
create table businesses (id uuid primary key default gen_random_uuid(), name text not null, owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz default now());
create table memberships (business_id uuid references businesses(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, role member_role not null, primary key (business_id, user_id));
create table products (id uuid primary key, business_id uuid not null references businesses(id) on delete cascade, name text not null, sku text, category text, unit text default 'pcs',
  cost integer not null default 0 check (cost >= 0), price integer not null check (price >= 0), stock integer, active boolean not null default true, updated_at timestamptz default now());
create table transactions (id uuid primary key, business_id uuid not null references businesses(id) on delete cascade, no text not null, at timestamptz not null,
  subtotal integer not null, discount integer not null default 0, tax integer not null default 0, fee integer not null default 0, total integer not null check (total >= 0),
  method text not null, paid integer not null, change integer not null, note text, status text not null default 'selesai' check (status in ('selesai','batal')),
  void_reason text, created_by uuid default auth.uid(), unique (business_id, no));
create table transaction_items (id uuid primary key default gen_random_uuid(), transaction_id uuid not null references transactions(id) on delete cascade, business_id uuid not null references businesses(id) on delete cascade,
  product_id uuid, name text not null, price integer not null, cost integer not null default 0, qty integer not null check (qty > 0));
create table audit_log (id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade, user_id uuid default auth.uid(), action text not null, ref text, detail text, at timestamptz default now());

create function is_member(b uuid, roles member_role[] default '{owner,admin,kasir}') returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from memberships m where m.business_id = b and m.user_id = auth.uid() and m.role = any(roles)) $$;
create function add_owner() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into memberships values (new.id, new.owner_id, 'owner'); return new; end $$;
create trigger businesses_owner after insert on businesses for each row execute function add_owner();

alter table businesses enable row level security; alter table memberships enable row level security;
create policy biz_select on businesses for select using (is_member(id));
create policy biz_insert on businesses for insert with check (owner_id = auth.uid());
create policy biz_update on businesses for update using (is_member(id, '{owner}'));
create policy mem_select on memberships for select using (user_id = auth.uid() or is_member(business_id, '{owner,admin}'));
create policy mem_write on memberships for all using (is_member(business_id, '{owner}')) with check (is_member(business_id, '{owner}'));
do $$ declare t text; begin
  foreach t in array array['products','transactions','transaction_items','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(business_id))', t || '_select', t);
  end loop; end $$;
create policy products_write on products for all using (is_member(business_id, '{owner,admin}')) with check (is_member(business_id, '{owner,admin}'));
create policy trx_insert on transactions for insert with check (is_member(business_id));
create policy trx_update on transactions for update using (is_member(business_id, '{owner,admin}'));
create policy items_insert on transaction_items for insert with check (is_member(business_id));
create policy audit_insert on audit_log for insert with check (is_member(business_id));
-- Tidak ada policy delete untuk transactions/transaction_items/audit_log: riwayat tidak bisa dihapus dari klien.
