begin;
-- Ordered after the legacy 9997/9998/9999 domain tables.
create or replace function public.capture_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
  tenant_text text;
  record_text text;
  actor_id uuid := auth.uid();
  actor_text text;
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
  else
    before_row := to_jsonb(old);
  end if;

  tenant_text := case when tg_table_name='tenants' then coalesce(after_row ->> 'id',before_row ->> 'id') else coalesce(after_row ->> 'tenant_id', before_row ->> 'tenant_id') end;
  record_text := coalesce(after_row ->> 'id', before_row ->> 'id');

  -- Only the trusted server role can attribute a server-mediated mutation.
  -- End-user headers cannot override their provider-authenticated UID.
  if actor_id is null and current_setting('role',true)='service_role' then
    actor_text := nullif(current_setting('request.headers',true),'')::jsonb ->> 'x-terrevo-actor';
    if actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      actor_id := actor_text::uuid;
    end if;
  end if;

  insert into public.security_audit_events (
    tenant_id,
    actor_user_id,
    table_name,
    record_id,
    operation,
    row_before,
    row_after
  )
  values (
    case
      when tenant_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then tenant_text::uuid
      else null
    end,
    actor_id,
    tg_table_name,
    record_text,
    tg_op,
    before_row,
    after_row
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;


drop trigger if exists terrevo_security_audit on public.nca_categories;
create trigger terrevo_security_audit after insert or update or delete on public.nca_categories for each row execute function public.capture_security_audit_event();
drop trigger if exists terrevo_security_audit on public.nca_towns;
create trigger terrevo_security_audit after insert or update or delete on public.nca_towns for each row execute function public.capture_security_audit_event();
drop trigger if exists terrevo_security_audit on public.nca_records;
create trigger terrevo_security_audit after insert or update or delete on public.nca_records for each row execute function public.capture_security_audit_event();
drop trigger if exists terrevo_security_audit on public.unplanned_calls;
create trigger terrevo_security_audit after insert or update or delete on public.unplanned_calls for each row execute function public.capture_security_audit_event();
drop trigger if exists terrevo_security_audit on public.unplanned_call_decisions;
create trigger terrevo_security_audit after insert or update or delete on public.unplanned_call_decisions for each row execute function public.capture_security_audit_event();
drop trigger if exists terrevo_security_audit on public.tenants;
create trigger terrevo_security_audit after insert or update or delete on public.tenants for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.doctors;
create trigger terrevo_security_audit after insert or update or delete on public.doctors for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.chemists;
create trigger terrevo_security_audit after insert or update or delete on public.chemists for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.stockists;
create trigger terrevo_security_audit after insert or update or delete on public.stockists for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.products;
create trigger terrevo_security_audit after insert or update or delete on public.products for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.employees;
create trigger terrevo_security_audit after insert or update or delete on public.employees for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.samples;
create trigger terrevo_security_audit after insert or update or delete on public.samples for each row execute function public.capture_security_audit_event();

drop trigger if exists terrevo_security_audit on public.gifts;
create trigger terrevo_security_audit after insert or update or delete on public.gifts for each row execute function public.capture_security_audit_event();

commit;
