-- RLS performance cleanup
drop policy if exists expenses_select on public.expenses;
drop policy if exists biz_insert on public.businesses;
create policy biz_insert on public.businesses for insert with check (owner_id=(select auth.uid()));
drop policy if exists mem_select on public.memberships;
create policy mem_select on public.memberships for select using ((user_id=(select auth.uid())) or is_member(business_id,'{owner,admin}'));