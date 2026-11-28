-- 012: nama pembeli pada transaksi
alter table public.transactions
  add column if not exists customer_name text;

alter table public.transactions
  add constraint transactions_customer_name_length
  check (customer_name is null or length(customer_name) <= 100);

create or replace function public.create_sale(b uuid, t jsonb)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid; v_sub bigint := 0; v_disc bigint; v_tax bigint; v_fee bigint; v_total bigint; v_paid bigint; v_chg bigint;
  x jsonb; pr record; v_known boolean; v_pid uuid; v_qty integer; v_price bigint; v_cost bigint; v_name text;
  v_customer_name text;
begin
  if auth.uid() is null or not public.is_member(b) then raise exception 'Tidak punya akses ke usaha ini'; end if;
  v_id := (t->>'id')::uuid;
  if exists (select 1 from public.transactions tr where tr.id = v_id and tr.business_id = b) then return 'duplikat'; end if;
  if jsonb_typeof(t->'items') is distinct from 'array' or jsonb_array_length(t->'items') = 0 then raise exception 'Transaksi kosong'; end if;
  v_disc := coalesce((t->>'discount')::bigint, 0); v_tax := coalesce((t->>'tax')::bigint, 0); v_fee := coalesce((t->>'fee')::bigint, 0);
  v_total := (t->>'total')::bigint; v_paid := (t->>'paid')::bigint; v_chg := (t->>'change')::bigint;
  v_customer_name := nullif(left(trim(coalesce(t->>'customer_name','')),100),'');
  if least(v_disc, v_tax, v_fee, v_total, v_paid, v_chg) < 0 then raise exception 'Nilai negatif tidak diizinkan'; end if;

  for x in select value from jsonb_array_elements(t->'items') loop
    v_qty := (x->>'qty')::integer; v_price := (x->>'price')::bigint;
    if v_qty is null or v_qty <= 0 or v_qty > 100000 or v_price is null or v_price < 0 then raise exception 'Item transaksi tidak valid'; end if;
    v_sub := v_sub + v_price * v_qty;
  end loop;
  if v_sub <> (t->>'subtotal')::bigint or v_disc > v_sub or v_total <> v_sub - v_disc + v_tax + v_fee
     or v_paid < v_total or v_paid - v_total <> v_chg then raise exception 'Perhitungan transaksi tidak valid'; end if;
  if greatest(v_sub, v_total, v_paid) > 2000000000 then raise exception 'Nilai transaksi terlalu besar'; end if;

  insert into public.transactions (id, business_id, no, at, subtotal, discount, tax, fee, total, method, paid, change, note, customer_name, status)
  values (v_id, b, t->>'no', (t->>'at')::timestamptz, v_sub, v_disc, v_tax, v_fee, v_total, t->>'method', v_paid, v_chg, t->>'note', v_customer_name, 'selesai');

  for x in select value from jsonb_array_elements(t->'items') loop
    v_pid := nullif(x->>'product_id', '')::uuid; v_qty := (x->>'qty')::integer; v_price := (x->>'price')::bigint;
    v_cost := coalesce((x->>'cost')::bigint, 0); v_name := left(coalesce(nullif(x->>'name', ''), 'Produk'), 120);
    if v_cost < 0 then raise exception 'Item transaksi tidak valid'; end if;
    select pp.id, pp.price, pp.cost, pp.stock into pr from public.products pp where pp.id = v_pid and pp.business_id = b for update;
    v_known := found;
    if v_known then
      if pr.price <> v_price or pr.cost <> v_cost then
        insert into public.audit_log (business_id, action, ref, detail)
        values (b, 'sinkron_selisih', v_id::text, v_name || ': harga/modal saat dijual ' || v_price || '/' || v_cost || ', saat sinkron ' || pr.price || '/' || pr.cost);
      end if;
      if pr.stock is not null then
        if pr.stock < v_qty then
          insert into public.audit_log (business_id, action, ref, detail)
          values (b, 'sinkron_selisih', v_id::text, v_name || ': stok server ' || pr.stock || ' kurang dari jumlah terjual ' || v_qty || ' (stok menjadi minus)');
        end if;
        update public.products set stock = stock - v_qty, updated_at = now() where id = pr.id;
      end if;
    else
      insert into public.audit_log (business_id, action, ref, detail)
      values (b, 'sinkron_selisih', v_id::text, v_name || ': produk sudah dihapus atau tidak dikenal; baris disimpan tanpa tautan produk');
    end if;
    insert into public.transaction_items (transaction_id, business_id, product_id, name, price, cost, qty)
    values (v_id, b, case when v_known then v_pid else null end, v_name, v_price, v_cost, v_qty);
  end loop;
  return 'ok';
end $function$;
