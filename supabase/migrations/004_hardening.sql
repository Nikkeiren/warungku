-- Hardening 004: authoritative sale validation, function permissions and indexes
begin;
revoke execute on function public.add_owner() from public, anon, authenticated;
revoke execute on function public.is_member(uuid, public.member_role[]) from public, anon;
grant execute on function public.is_member(uuid, public.member_role[]) to authenticated;
create or replace function public.create_sale(b uuid,t jsonb) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare x jsonb; pid uuid; q integer; p record; sub bigint:=0; discount bigint; tax bigint; fee bigint; total bigint; paid bigint; change_amt bigint; seen uuid[]:='{}';
begin
 if auth.uid() is null or not is_member(b) then raise exception 'Tidak punya akses'; end if;
 if jsonb_typeof(t->'items')<>'array' or jsonb_array_length(t->'items')=0 then raise exception 'Transaksi kosong'; end if;
 if exists(select 1 from transactions where id=(t->>'id')::uuid) then return 'duplikat'; end if;
 discount:=coalesce((t->>'discount')::bigint,0);tax:=coalesce((t->>'tax')::bigint,0);fee:=coalesce((t->>'fee')::bigint,0);total:=(t->>'total')::bigint;paid:=(t->>'paid')::bigint;change_amt:=(t->>'change')::bigint;
 if least(discount,tax,fee,total,paid,change_amt)<0 then raise exception 'Nilai negatif'; end if;
 for x in select value from jsonb_array_elements(t->'items') loop
 pid:=(x->>'product_id')::uuid;q:=(x->>'qty')::int;if q<=0 or pid=any(seen) then raise exception 'Item invalid';end if;seen:=array_append(seen,pid);
 select id,price,cost,stock,active,name into p from products where id=pid and business_id=b for update;
 if not found or p.active is not true then raise exception 'Produk tidak valid';end if;
 if (x->>'price')::bigint<>p.price or coalesce((x->>'cost')::bigint,0)<>p.cost then raise exception 'Harga berubah, muat ulang';end if;
 if p.stock is not null and p.stock<q then raise exception 'Stok tidak cukup';end if;sub:=sub+p.price::bigint*q;
 end loop;
 if sub<>(t->>'subtotal')::bigint or discount>sub or total<>sub-discount+tax+fee or paid<total or paid-total<>change_amt then raise exception 'Total tidak valid';end if;
 insert into transactions(id,business_id,no,at,subtotal,discount,tax,fee,total,method,paid,change,note,status) values((t->>'id')::uuid,b,t->>'no',(t->>'at')::timestamptz,sub,discount,tax,fee,total,t->>'method',paid,change_amt,t->>'note','selesai');
 insert into transaction_items(transaction_id,business_id,product_id,name,price,cost,qty) select (t->>'id')::uuid,b,(i->>'product_id')::uuid,p.name,p.price,p.cost,(i->>'qty')::int from jsonb_array_elements(t->'items') i join products p on p.id=(i->>'product_id')::uuid and p.business_id=b;
 update products p set stock=p.stock-s.q,updated_at=now() from (select (i->>'product_id')::uuid pid,(i->>'qty')::int q from jsonb_array_elements(t->'items') i) s where p.id=s.pid and p.business_id=b and p.stock is not null;
 return 'ok';end $$;
create index if not exists idx_audit_business on audit_log(business_id);create index if not exists idx_business_owner on businesses(owner_id);create index if not exists idx_expenses_business on expenses(business_id);create index if not exists idx_members_user on memberships(user_id);create index if not exists idx_products_business on products(business_id);create index if not exists idx_items_business on transaction_items(business_id);create index if not exists idx_items_transaction on transaction_items(transaction_id);create index if not exists idx_transactions_business_at on transactions(business_id,at desc);
commit;