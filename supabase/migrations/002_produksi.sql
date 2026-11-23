-- Jalankan SETELAH supabase/schema.sql. Semua penulisan transaksi/stok lewat fungsi server (atomik, tervalidasi, tercatat).
alter table businesses add column if not exists address text, add column if not exists phone text,
  add column if not exists tax_pct integer not null default 0 check (tax_pct between 0 and 100),
  add column if not exists service_fee integer not null default 0 check (service_fee >= 0);
alter table transaction_items add constraint items_nonneg check (price >= 0 and cost >= 0);
-- Klien tidak boleh menulis/ubah transaksi langsung: hanya lewat create_sale / void_sale.
drop policy trx_insert on transactions; drop policy trx_update on transactions; drop policy items_insert on transaction_items;

create function create_business(p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare b uuid; begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Nama usaha wajib diisi'; end if;
  insert into businesses (name, owner_id) values (trim(p_name), auth.uid()) returning id into b; return b; end $$;

create function create_sale(b uuid, t jsonb) returns text language plpgsql security definer set search_path = public as $$
declare x jsonb; sub int := 0; begin
  if not is_member(b) then raise exception 'Tidak punya akses ke usaha ini'; end if;
  if exists (select 1 from transactions where id = (t->>'id')::uuid) then return 'duplikat'; end if;
  if jsonb_typeof(t->'items') <> 'array' or jsonb_array_length(t->'items') = 0 then raise exception 'Transaksi kosong'; end if;
  for x in select * from jsonb_array_elements(t->'items') loop sub := sub + (x->>'price')::int * (x->>'qty')::int; end loop;
  if sub <> (t->>'subtotal')::int or (t->>'subtotal')::int - (t->>'discount')::int + (t->>'tax')::int + (t->>'fee')::int <> (t->>'total')::int
     or (t->>'paid')::int < (t->>'total')::int or (t->>'paid')::int - (t->>'total')::int <> (t->>'change')::int then
    raise exception 'Perhitungan transaksi tidak valid'; end if;
  insert into transactions (id, business_id, no, at, subtotal, discount, tax, fee, total, method, paid, change, note)
  values ((t->>'id')::uuid, b, t->>'no', (t->>'at')::timestamptz, (t->>'subtotal')::int, (t->>'discount')::int, (t->>'tax')::int, (t->>'fee')::int,
          (t->>'total')::int, t->>'method', (t->>'paid')::int, (t->>'change')::int, t->>'note');
  insert into transaction_items (transaction_id, business_id, product_id, name, price, cost, qty)
  select (t->>'id')::uuid, b, nullif(i->>'product_id', '')::uuid, i->>'name', (i->>'price')::int, (i->>'cost')::int, (i->>'qty')::int from jsonb_array_elements(t->'items') i;
  update products p set stock = p.stock - s.q, updated_at = now()
  from (select (i->>'product_id')::uuid pid, sum((i->>'qty')::int) q from jsonb_array_elements(t->'items') i group by 1) s
  where p.id = s.pid and p.business_id = b and p.stock is not null;
  return 'ok'; end $$;

create function void_sale(b uuid, tid uuid, reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(b, '{owner,admin}') then raise exception 'Hanya owner atau admin yang boleh membatalkan'; end if;
  if length(trim(coalesce(reason, ''))) = 0 then raise exception 'Alasan pembatalan wajib diisi'; end if;
  update transactions set status = 'batal', void_reason = trim(reason) where id = tid and business_id = b and status = 'selesai';
  if not found then raise exception 'Transaksi tidak ditemukan atau sudah dibatalkan'; end if;
  update products p set stock = p.stock + s.q, updated_at = now()
  from (select product_id pid, sum(qty) q from transaction_items where transaction_id = tid group by 1) s where p.id = s.pid and p.stock is not null;
  insert into audit_log (business_id, action, ref, detail) values (b, 'batal_transaksi', tid::text, trim(reason)); end $$;

create function adjust_stock(b uuid, pid uuid, mode text, qty int, note text) returns int language plpgsql security definer set search_path = public as $$
declare old int; nw int; begin
  if not is_member(b, '{owner,admin}') then raise exception 'Hanya owner atau admin'; end if;
  if qty is null or qty < 0 then raise exception 'Jumlah tidak valid'; end if;
  select stock into old from products where id = pid and business_id = b for update;
  if not found then raise exception 'Produk tidak ditemukan'; end if;
  if old is null then raise exception 'Stok produk ini tidak dilacak'; end if;
  nw := case mode when 'masuk' then old + qty when 'keluar' then old - qty when 'set' then qty end;
  if nw is null or nw < 0 then raise exception 'Hasil stok tidak valid'; end if;
  update products set stock = nw, updated_at = now() where id = pid;
  insert into audit_log (business_id, action, ref, detail) values (b, 'stok', pid::text, mode || ' ' || qty || ': ' || old || ' ke ' || nw || coalesce(' (' || nullif(note, '') || ')', ''));
  return nw; end $$;

create function list_members(b uuid) returns table (user_id uuid, email text, role member_role) language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role from memberships m join auth.users u on u.id = m.user_id where m.business_id = b and is_member(b, '{owner,admin}') $$;
create function set_member(b uuid, p_email text, p_role member_role) returns void language plpgsql security definer set search_path = public as $$
declare u uuid; begin
  if not is_member(b, '{owner}') then raise exception 'Hanya owner'; end if;
  if p_role = 'owner' then raise exception 'Role owner tidak bisa diberikan'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'Email belum terdaftar. Minta pengguna mendaftar dulu.'; end if;
  if exists (select 1 from memberships where business_id = b and user_id = u and role = 'owner') then raise exception 'Role owner tidak bisa diubah'; end if;
  insert into memberships values (b, u, p_role) on conflict (business_id, user_id) do update set role = excluded.role; end $$;
create function remove_member(b uuid, u uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(b, '{owner}') then raise exception 'Hanya owner'; end if;
  delete from memberships where business_id = b and user_id = u and role <> 'owner'; end $$;

revoke execute on function create_business(text), create_sale(uuid, jsonb), void_sale(uuid, uuid, text), adjust_stock(uuid, uuid, text, int, text), list_members(uuid), set_member(uuid, text, member_role), remove_member(uuid, uuid) from public, anon;
grant execute on function create_business(text), create_sale(uuid, jsonb), void_sale(uuid, uuid, text), adjust_stock(uuid, uuid, text, int, text), list_members(uuid), set_member(uuid, text, member_role), remove_member(uuid, uuid) to authenticated;
