begin;
insert into auth.users(id) values ('c2000000-0000-4000-8000-000000000001');
insert into public.tenants(id,name,slug) values ('c2000000-0000-4000-8000-000000000010','Import Tenant','import-tenant');
insert into public.tenant_memberships(tenant_id,user_id) values ('c2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000001');
insert into public.organization_units(id,tenant_id,type,code,name) values
 ('c2000000-0000-4000-8000-000000000011','c2000000-0000-4000-8000-000000000010','company','C','Company');
insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 ('c2000000-0000-4000-8000-000000000012','c2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000011','division','D','Division'),
 ('c2000000-0000-4000-8000-000000000013','c2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000012','area','A','Area');
insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 ('c2000000-0000-4000-8000-000000000014','c2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000013','territory','T','Territory');

set local role service_role;
do $$declare n integer;begin
 n:=public.import_master_records('c2000000-0000-4000-8000-000000000010','doctors',
   '[{"code":"D1","name":"Doctor One","specialty":"Cardiology","territory_id":"c2000000-0000-4000-8000-000000000014"},{"code":"D2","name":"Doctor Two","specialty":"GP","territory_id":"c2000000-0000-4000-8000-000000000014"}]'::jsonb);
 if n<>2 then raise exception 'expected two imported doctors';end if;
end;$$;
reset role;
do $$begin
 if (select count(*) from public.doctors where tenant_id='c2000000-0000-4000-8000-000000000010')<>2 then raise exception 'import count mismatch';end if;
 begin
   perform public.import_master_records('c2000000-0000-4000-8000-000000000010','doctors',
     '[{"code":"D3","name":"Doctor Three","specialty":"GP","territory_id":"c2000000-0000-4000-8000-000000000014"},{"code":"D1","name":"Duplicate","specialty":"GP","territory_id":"c2000000-0000-4000-8000-000000000014"}]'::jsonb);
   raise exception 'duplicate import unexpectedly succeeded';
 exception when unique_violation then null;
 end;
 if (select count(*) from public.doctors where tenant_id='c2000000-0000-4000-8000-000000000010')<>2 then raise exception 'failed batch was not atomic';end if;
end;$$;
set local role authenticated;
do $$begin
 begin
   perform public.import_master_records('c2000000-0000-4000-8000-000000000010','doctors','[{"code":"X","name":"Denied"}]'::jsonb);
   raise exception 'authenticated import unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end;$$;
reset role;
rollback;
