begin;

drop policy if exists customer_relationships_scoped_read on public.customer_relationships;

create policy customer_relationships_scoped_read
on public.customer_relationships
for select
to authenticated
using(
  (
    source_kind='doctor' and target_kind='chemist'
    and exists(
      select 1 from public.doctors d
       where d.tenant_id=customer_relationships.tenant_id
         and d.id=customer_relationships.source_id
         and d.status='active'
         and public.has_master_access(d.tenant_id,d.territory_id)
    )
    and exists(
      select 1 from public.chemists c
       where c.tenant_id=customer_relationships.tenant_id
         and c.id=customer_relationships.target_id
         and c.status='active'
         and public.has_master_access(c.tenant_id,c.territory_id)
    )
  )
  or
  (
    source_kind='chemist' and target_kind='stockist'
    and exists(
      select 1 from public.chemists c
       where c.tenant_id=customer_relationships.tenant_id
         and c.id=customer_relationships.source_id
         and c.status='active'
         and public.has_master_access(c.tenant_id,c.territory_id)
    )
    and exists(
      select 1 from public.stockists s
       where s.tenant_id=customer_relationships.tenant_id
         and s.id=customer_relationships.target_id
         and s.status='active'
         and public.has_master_access(s.tenant_id,s.territory_id)
    )
  )
);

drop function if exists public.can_read_customer_relationship(uuid,text,uuid,text,uuid);
drop function if exists public.customer_kind_territory(uuid,text,uuid);

revoke all on function public.admin_link_customer(uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_unlink_customer(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_link_customer(uuid,uuid,text,uuid,text,uuid) to service_role;
grant execute on function public.admin_unlink_customer(uuid,uuid,uuid) to service_role;

commit;
