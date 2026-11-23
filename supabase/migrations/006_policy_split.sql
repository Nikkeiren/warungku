-- Split ALL policies into explicit write-only policies to avoid overlapping SELECT policy evaluation
drop policy if exists mem_write on public.memberships;
create policy mem_insert on public.memberships for insert with check (is_member(business_id,'{owner}'));
create policy mem_update on public.memberships for update using (is_member(business_id,'{owner}')) with check (is_member(business_id,'{owner}'));
create policy mem_delete on public.memberships for delete using (is_member(business_id,'{owner}'));
drop policy if exists products_write on public.products;
create policy products_insert on public.products for insert with check (is_member(business_id,'{owner,admin}'));
create policy products_update on public.products for update using (is_member(business_id,'{owner,admin}')) with check (is_member(business_id,'{owner,admin}'));
create policy products_delete on public.products for delete using (is_member(business_id,'{owner,admin}'));