begin;
drop trigger if exists terrevo_security_audit on public.nca_categories;
drop trigger if exists terrevo_security_audit on public.nca_towns;
drop trigger if exists terrevo_security_audit on public.nca_records;
drop trigger if exists terrevo_security_audit on public.unplanned_calls;
drop trigger if exists terrevo_security_audit on public.unplanned_call_decisions;
drop trigger if exists terrevo_security_audit on public.tenants;
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
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
  else
    before_row := to_jsonb(old);
  end if;

  tenant_text := coalesce(after_row ->> 'tenant_id', before_row ->> 'tenant_id');
  record_text := coalesce(after_row ->> 'id', before_row ->> 'id');

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
    auth.uid(),
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


drop trigger if exists terrevo_security_audit on public.doctors;

drop trigger if exists terrevo_security_audit on public.chemists;

drop trigger if exists terrevo_security_audit on public.stockists;

drop trigger if exists terrevo_security_audit on public.products;

drop trigger if exists terrevo_security_audit on public.employees;

drop trigger if exists terrevo_security_audit on public.samples;

drop trigger if exists terrevo_security_audit on public.gifts;

commit;
