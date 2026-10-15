begin;

create or replace function public.customer_kind_territory(
  p_tenant_id uuid,p_kind text,p_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_territory uuid;
begin
  if p_kind='doctor' then
    select territory_id into v_territory from public.doctors where tenant_id=p_tenant_id and id=p_id and status='active';
  elsif p_kind='chemist' then
    select territory_id into v_territory from public.chemists where tenant_id=p_tenant_id and id=p_id and status='active';
  elsif p_kind='stockist' then
    select territory_id into v_territory from public.stockists where tenant_id=p_tenant_id and id=p_id and status='active';
  end if;
  return v_territory;
end;
$$;

create or replace function public.can_read_customer_relationship(
  p_tenant_id uuid,p_source_kind text,p_source_id uuid,p_target_kind text,p_target_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_source_territory uuid;v_target_territory uuid;
begin
  v_source_territory:=public.customer_kind_territory(p_tenant_id,p_source_kind,p_source_id);
  v_target_territory:=public.customer_kind_territory(p_tenant_id,p_target_kind,p_target_id);
  if v_source_territory is null or v_target_territory is null then return false;end if;
  return public.has_master_access(p_tenant_id,v_source_territory)
    and public.has_master_access(p_tenant_id,v_target_territory);
end;
$$;

drop policy if exists customer_relationships_scoped_read on public.customer_relationships;
create policy customer_relationships_scoped_read on public.customer_relationships
for select to authenticated
using(public.can_read_customer_relationship(tenant_id,source_kind,source_id,target_kind,target_id));

revoke all on function public.customer_kind_territory(uuid,text,uuid) from public,anon;
revoke all on function public.can_read_customer_relationship(uuid,text,uuid,text,uuid) from public,anon;
grant execute on function public.can_read_customer_relationship(uuid,text,uuid,text,uuid) to authenticated;

commit;
