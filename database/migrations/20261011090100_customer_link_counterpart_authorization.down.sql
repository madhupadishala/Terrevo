begin;
alter policy business_customer_links_read on public.business_customer_links
 using (approval='APPROVED' and exists (
  select 1 from public.business_customer_link_grants g
  where g.tenant_id=business_customer_links.tenant_id and g.user_id=auth.uid()
   and g.territory_id=business_customer_links.territory_id
 ));
alter table public.business_customer_link_grants
 drop constraint business_customer_link_grants_user_id_fkey,
 add constraint business_customer_link_grants_user_id_fkey foreign key(user_id)
 references auth.users(id);
commit;
