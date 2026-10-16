begin;

create or replace function public.admin_link_customer(
  p_tenant_id uuid,p_user_id uuid,p_source_kind text,p_source_id uuid,p_target_kind text,p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_relationship text;v_id uuid;v_source_territory uuid;v_target_territory uuid;
begin
  if p_source_kind='doctor' and p_target_kind='chemist' then v_relationship:='DOCTOR_CHEMIST';
  elsif p_source_kind='chemist' and p_target_kind='stockist' then v_relationship:='CHEMIST_STOCKIST';
  else raise exception 'unsupported customer relationship';end if;
  if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=p_user_id and m.status='active')
  then raise exception 'active tenant membership required';end if;
  v_source_territory:=public.customer_kind_territory(p_tenant_id,p_source_kind,p_source_id);
  v_target_territory:=public.customer_kind_territory(p_tenant_id,p_target_kind,p_target_id);
  if v_source_territory is null or v_target_territory is null then raise exception 'active customer not found';end if;
  select id into v_id from public.customer_relationships
   where tenant_id=p_tenant_id and source_kind=p_source_kind and source_id=p_source_id
     and target_kind=p_target_kind and target_id=p_target_id;
  if v_id is not null then return v_id;end if;
  insert into public.customer_relationships(tenant_id,source_kind,source_id,target_kind,target_id,relationship,created_by)
  values(p_tenant_id,p_source_kind,p_source_id,p_target_kind,p_target_id,v_relationship,p_user_id) returning id into v_id;
  insert into public.customer_relationship_audit(tenant_id,relationship_id,actor_user_id,action,source_kind,source_id,target_kind,target_id)
  values(p_tenant_id,v_id,p_user_id,'LINK',p_source_kind,p_source_id,p_target_kind,p_target_id);
  return v_id;
end;
$$;

revoke all on function public.admin_link_customer(uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_link_customer(uuid,uuid,text,uuid,text,uuid) to service_role;

commit;
