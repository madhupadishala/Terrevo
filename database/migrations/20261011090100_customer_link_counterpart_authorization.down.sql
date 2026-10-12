begin;
-- Security floor: retain customer-level visibility during rollback.
alter policy business_customer_links_read on public.business_customer_links
 using (approval='APPROVED' and exists (
  select 1 from public.business_customer_link_grants g
  where g.tenant_id=business_customer_links.tenant_id and g.user_id=auth.uid()
   and g.territory_id=business_customer_links.territory_id
 ) and exists (
  select 1 from (
   select id,tenant_id,status from public.doctors
   union all select id,tenant_id,status from public.chemists
   union all select id,tenant_id,status from public.stockists
  ) source_customer
  where source_customer.tenant_id=business_customer_links.tenant_id
   and source_customer.id=business_customer_links.source_id and source_customer.status='active'
 ) and exists (
  select 1 from (
   select id,tenant_id,status from public.doctors
   union all select id,tenant_id,status from public.chemists
   union all select id,tenant_id,status from public.stockists
  ) target_customer
  where target_customer.tenant_id=business_customer_links.tenant_id
   and target_customer.id=business_customer_links.target_id and target_customer.status='active'
 ));
alter table public.business_customer_link_grants
 drop constraint business_customer_link_grants_user_id_fkey,
 add constraint business_customer_link_grants_user_id_fkey foreign key(user_id)
 references auth.users(id) not valid;
commit;
alter table public.business_customer_link_grants validate constraint business_customer_link_grants_user_id_fkey;
