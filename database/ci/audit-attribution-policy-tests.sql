begin;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
select set_config('request.headers','{"x-terrevo-actor":"f6000000-0000-4000-8000-000000000002"}',true);
insert into public.tenants(id,name,slug)values('f6000000-0000-4000-8000-000000000011','Synthetic attributed change','ci-attributed-change');
set local role service_role;
update public.tenants set geofence_radius_meters=100 where id='f6000000-0000-4000-8000-000000000011';
do $$begin
 if not exists(select 1 from public.security_audit_events where tenant_id='f6000000-0000-4000-8000-000000000011' and actor_user_id='f6000000-0000-4000-8000-000000000002' and table_name='tenants' and operation='UPDATE')then
  raise exception 'Server-mediated mutation lost trusted actor';
 end if;
end;$$;
reset role;
-- A raw migration/seed connection must not impersonate the trusted server by
-- setting a header. Historical system events retain their honest null actor.
insert into public.tenants(id,name,slug)values('f6000000-0000-4000-8000-000000000012','Synthetic system change','ci-system-change');
do $$begin
 if exists(select 1 from public.security_audit_events where tenant_id='f6000000-0000-4000-8000-000000000012' and actor_user_id is not null)then raise exception 'Untrusted system header attributed actor';end if;
 if has_function_privilege('authenticated','public.capture_security_audit_event()','EXECUTE')then raise exception 'Client can invoke audit capture';end if;
end;$$;
set local role authenticated;
do $$begin
 begin
  insert into public.security_audit_events(table_name,operation,actor_user_id)values('forged','INSERT','f6000000-0000-4000-8000-000000000002');
  raise exception 'Client forged audit event' using errcode='P0004';
 exception when insufficient_privilege then null;
 end;
end;$$;
rollback;
