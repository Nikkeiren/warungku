-- 009: perbaikan pemuatan membership dan pembatasan daftar anggota.
-- get_my_memberships memakai hak akses pemanggil + RLS; tidak memakai SECURITY DEFINER.
create or replace function public.get_my_memberships()
returns table (role public.member_role, businesses jsonb)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select m.role, to_jsonb(b) as businesses
  from public.memberships as m
  join public.businesses as b on b.id = m.business_id
  where m.user_id = (select auth.uid())
    and (select auth.uid()) is not null
  order by (m.role = 'owner'::public.member_role) desc, b.created_at asc;
$$;

revoke execute on function public.get_my_memberships() from public, anon;
grant execute on function public.get_my_memberships() to authenticated;

-- Email anggota hanya boleh dilihat owner, bukan admin.
create or replace function public.list_members(b uuid)
returns table (user_id uuid, email text, role public.member_role)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.user_id, u.email::text, m.role
  from public.memberships as m
  join auth.users as u on u.id = m.user_id
  where m.business_id = b
    and public.is_member(b, array['owner']::public.member_role[]);
$$;

revoke execute on function public.list_members(uuid) from public, anon;
grant execute on function public.list_members(uuid) to authenticated;
