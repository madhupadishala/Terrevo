begin;

create table public.visit_presence_integrity(
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null,
  execution_id uuid not null,
  operation_id uuid not null,
  request_hash bytea not null,
  status text not null check(status in('CONSISTENT','REVIEW_REQUIRED','SPOOF_SUSPECTED')),
  sample_count integer not null check(sample_count between 3 and 10),
  total_distance_meters double precision not null check(total_distance_meters>=0),
  max_segment_speed_kph double precision not null check(max_segment_speed_kph>=0),
  mocked_detected boolean not null,
  reason text not null check(length(trim(reason)) between 1 and 500),
  device_id text,
  checkout_at timestamptz not null,
  checkout_latitude double precision not null check(checkout_latitude between -90 and 90),
  checkout_longitude double precision not null check(checkout_longitude between -180 and 180),
  checkout_accuracy_meters double precision not null check(checkout_accuracy_meters between 0 and 1000),
  server_delay_seconds double precision not null check(server_delay_seconds>=0),
  recorded_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,id),
  unique(tenant_id,visit_id),
  unique(tenant_id,operation_id),
  foreign key(tenant_id,visit_id) references public.field_visits(tenant_id,id) on delete restrict,
  foreign key(tenant_id,execution_id) references public.tour_executions(tenant_id,id) on delete restrict
);

create table public.visit_presence_samples(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  presence_id uuid not null,
  sequence_no integer not null check(sequence_no between 1 and 10),
  captured_at timestamptz not null,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy_meters double precision not null check(accuracy_meters between 0 and 1000),
  mocked boolean,
  distance_from_previous_meters double precision not null check(distance_from_previous_meters>=0),
  speed_from_previous_kph double precision check(speed_from_previous_kph is null or speed_from_previous_kph>=0),
  primary key(tenant_id,presence_id,sequence_no),
  foreign key(tenant_id,presence_id) references public.visit_presence_integrity(tenant_id,id) on delete cascade
);

create or replace function public.reject_presence_integrity_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'presence integrity evidence is immutable';
end;
$$;

create trigger visit_presence_integrity_immutable
before update or delete on public.visit_presence_integrity
for each row execute function public.reject_presence_integrity_mutation();

create trigger visit_presence_samples_immutable
before update or delete on public.visit_presence_samples
for each row execute function public.reject_presence_integrity_mutation();

create or replace function public.admin_record_departure_presence(
  p_tenant_id uuid,p_user_id uuid,p_visit_id uuid,p_operation_id uuid,p_samples jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_visit public.field_visits%rowtype;
  v_owner uuid;
  v_device_id text;
  v_event_id uuid;
  v_existing_visit_id uuid;
  v_existing_hash bytea;
  v_request_hash bytea;
  v_count integer;
  v_sample jsonb;
  v_sequence bigint;
  v_lat double precision;
  v_lon double precision;
  v_accuracy double precision;
  v_captured_at timestamptz;
  v_mocked boolean;
  v_prev_lat double precision;
  v_prev_lon double precision;
  v_prev_at timestamptz;
  v_distance double precision;
  v_elapsed_seconds double precision;
  v_speed_kph double precision;
  v_total_distance double precision:=0;
  v_max_speed double precision:=0;
  v_mocked_detected boolean:=false;
  v_poor_accuracy boolean:=false;
  v_invalid_time boolean:=false;
  v_late boolean:=false;
  v_max_accuracy double precision;
  v_received_at timestamptz:=clock_timestamp();
  v_server_delay double precision;
  v_status text;
  v_reason text;
begin
  if jsonb_typeof(p_samples)<>'array' then raise exception 'samples must be an array'; end if;
  v_count:=jsonb_array_length(p_samples);
  if v_count<3 or v_count>10 then raise exception 'samples must contain 3 to 10 location points'; end if;

  v_request_hash:=extensions.digest(
    jsonb_build_object('visitId',p_visit_id,'samples',p_samples)::text,
    'sha256'
  );

  select evidence.id,evidence.visit_id,evidence.request_hash
    into v_event_id,v_existing_visit_id,v_existing_hash
    from public.visit_presence_integrity evidence
   where evidence.tenant_id=p_tenant_id and evidence.operation_id=p_operation_id;
  if v_event_id is not null then
    if v_existing_visit_id is distinct from p_visit_id or v_existing_hash is distinct from v_request_hash then
      raise exception 'idempotency key reused with different presence payload';
    end if;
    return v_event_id;
  end if;

  select visit.* into v_visit
    from public.field_visits visit
   where visit.tenant_id=p_tenant_id and visit.id=p_visit_id
   for update;
  if v_visit.id is null then raise exception 'visit not found'; end if;
  if v_visit.status<>'CHECKED_OUT' or v_visit.checkout_at is null
     or v_visit.checkout_latitude is null or v_visit.checkout_longitude is null
     or v_visit.checkout_accuracy_meters is null then
    raise exception 'visit must be checked out before presence evidence';
  end if;

  select employee.user_id,execution.device_id
    into v_owner,v_device_id
    from public.tour_executions execution
    join public.employees employee
      on employee.tenant_id=execution.tenant_id and employee.id=execution.employee_id
   where execution.tenant_id=p_tenant_id and execution.id=v_visit.execution_id;
  if v_owner is distinct from p_user_id then raise exception 'visit does not belong to user'; end if;

  if exists(
    select 1 from public.visit_presence_integrity evidence
     where evidence.tenant_id=p_tenant_id and evidence.visit_id=p_visit_id
  ) then
    raise exception 'presence evidence already recorded for visit';
  end if;

  select tenant.max_gps_accuracy_meters into v_max_accuracy
    from public.tenants tenant where tenant.id=p_tenant_id;
  if v_max_accuracy is null then raise exception 'tenant GPS settings unavailable'; end if;

  v_prev_lat:=v_visit.checkout_latitude;
  v_prev_lon:=v_visit.checkout_longitude;
  v_prev_at:=v_visit.checkout_at;
  v_poor_accuracy:=v_visit.checkout_accuracy_meters>v_max_accuracy;
  v_server_delay:=greatest(0,extract(epoch from(v_received_at-v_visit.checkout_at)));
  v_late:=v_server_delay>300;

  for v_sample,v_sequence in
    select value,ordinality from jsonb_array_elements(p_samples) with ordinality
  loop
    if jsonb_typeof(v_sample)<>'object' then raise exception 'invalid presence sample'; end if;
    if jsonb_typeof(v_sample->'latitude')<>'number'
       or jsonb_typeof(v_sample->'longitude')<>'number'
       or jsonb_typeof(v_sample->'accuracyMeters')<>'number'
       or jsonb_typeof(v_sample->'capturedAt')<>'string' then
      raise exception 'invalid presence sample fields';
    end if;

    v_lat:=(v_sample->>'latitude')::double precision;
    v_lon:=(v_sample->>'longitude')::double precision;
    v_accuracy:=(v_sample->>'accuracyMeters')::double precision;
    v_captured_at:=(v_sample->>'capturedAt')::timestamptz;

    if v_lat not between -90 and 90 or v_lon not between -180 and 180 or v_accuracy not between 0 and 1000 then
      raise exception 'presence sample out of range';
    end if;

    if not (v_sample ? 'mocked') or v_sample->'mocked'='null'::jsonb then
      v_mocked:=null;
    elsif jsonb_typeof(v_sample->'mocked')='boolean' then
      v_mocked:=(v_sample->>'mocked')::boolean;
    else
      raise exception 'invalid mocked flag';
    end if;

    v_distance:=public.geo_distance_meters(v_prev_lat,v_prev_lon,v_lat,v_lon);
    v_elapsed_seconds:=extract(epoch from(v_captured_at-v_prev_at));
    if v_elapsed_seconds<=0 then
      v_invalid_time:=true;
    else
      v_speed_kph:=v_distance/v_elapsed_seconds*3.6;
      v_max_speed:=greatest(v_max_speed,v_speed_kph);
    end if;

    v_total_distance:=v_total_distance+v_distance;
    v_mocked_detected:=v_mocked_detected or coalesce(v_mocked,false);
    v_poor_accuracy:=v_poor_accuracy or v_accuracy>v_max_accuracy;
    v_prev_lat:=v_lat;
    v_prev_lon:=v_lon;
    v_prev_at:=v_captured_at;
  end loop;

  if v_mocked_detected then
    v_status:='SPOOF_SUSPECTED';
    v_reason:='Device reported mocked location in departure evidence.';
  elsif v_invalid_time then
    v_status:='REVIEW_REQUIRED';
    v_reason:='Departure sample timing is not sequential.';
  elsif v_max_speed>180 then
    v_status:='REVIEW_REQUIRED';
    v_reason:='Departure evidence contains an implausible movement segment.';
  elsif v_poor_accuracy then
    v_status:='REVIEW_REQUIRED';
    v_reason:='One or more departure points exceed the tenant GPS accuracy limit.';
  elsif v_late then
    v_status:='REVIEW_REQUIRED';
    v_reason:='Departure evidence arrived outside the expected five-minute verification window.';
  else
    v_status:='CONSISTENT';
    v_reason:='Departure samples are physically plausible; stationary or irregular nearby movement is allowed.';
  end if;

  v_event_id:=extensions.gen_random_uuid();

  insert into public.visit_presence_integrity(
    id,tenant_id,visit_id,execution_id,operation_id,request_hash,status,sample_count,
    total_distance_meters,max_segment_speed_kph,mocked_detected,reason,device_id,
    checkout_at,checkout_latitude,checkout_longitude,checkout_accuracy_meters,
    server_delay_seconds,recorded_at
  ) values(
    v_event_id,p_tenant_id,p_visit_id,v_visit.execution_id,p_operation_id,v_request_hash,v_status,v_count,
    v_total_distance,v_max_speed,v_mocked_detected,v_reason,v_device_id,
    v_visit.checkout_at,v_visit.checkout_latitude,v_visit.checkout_longitude,v_visit.checkout_accuracy_meters,
    v_server_delay,v_received_at
  );

  v_prev_lat:=v_visit.checkout_latitude;
  v_prev_lon:=v_visit.checkout_longitude;
  v_prev_at:=v_visit.checkout_at;

  for v_sample,v_sequence in
    select value,ordinality from jsonb_array_elements(p_samples) with ordinality
  loop
    v_lat:=(v_sample->>'latitude')::double precision;
    v_lon:=(v_sample->>'longitude')::double precision;
    v_accuracy:=(v_sample->>'accuracyMeters')::double precision;
    v_captured_at:=(v_sample->>'capturedAt')::timestamptz;
    if not (v_sample ? 'mocked') or v_sample->'mocked'='null'::jsonb then v_mocked:=null;
    else v_mocked:=(v_sample->>'mocked')::boolean; end if;

    v_distance:=public.geo_distance_meters(v_prev_lat,v_prev_lon,v_lat,v_lon);
    v_elapsed_seconds:=extract(epoch from(v_captured_at-v_prev_at));
    if v_elapsed_seconds<=0 then v_speed_kph:=null;
    else v_speed_kph:=v_distance/v_elapsed_seconds*3.6; end if;

    insert into public.visit_presence_samples(
      tenant_id,presence_id,sequence_no,captured_at,latitude,longitude,accuracy_meters,mocked,
      distance_from_previous_meters,speed_from_previous_kph
    ) values(
      p_tenant_id,v_event_id,v_sequence,v_captured_at,v_lat,v_lon,v_accuracy,v_mocked,
      v_distance,v_speed_kph
    );

    v_prev_lat:=v_lat;
    v_prev_lon:=v_lon;
    v_prev_at:=v_captured_at;
  end loop;

  return v_event_id;
end;
$$;

alter table public.visit_presence_integrity enable row level security;
alter table public.visit_presence_samples enable row level security;

revoke all on public.visit_presence_integrity from anon,authenticated;
revoke all on public.visit_presence_samples from anon,authenticated;
grant select on public.visit_presence_integrity to authenticated;
grant select on public.visit_presence_samples to authenticated;

create policy visit_presence_integrity_read on public.visit_presence_integrity
for select to authenticated
using(public.can_read_field_visit(tenant_id,visit_id));

create policy visit_presence_samples_read on public.visit_presence_samples
for select to authenticated
using(exists(
  select 1 from public.visit_presence_integrity evidence
   where evidence.tenant_id=visit_presence_samples.tenant_id
     and evidence.id=visit_presence_samples.presence_id
     and public.can_read_field_visit(evidence.tenant_id,evidence.visit_id)
));

revoke all on function public.admin_record_departure_presence(uuid,uuid,uuid,uuid,jsonb) from public;
grant execute on function public.admin_record_departure_presence(uuid,uuid,uuid,uuid,jsonb) to service_role;

comment on table public.visit_presence_integrity is
  'Immutable server-derived departure integrity conclusion for a checked-out field visit.';
comment on table public.visit_presence_samples is
  'Immutable raw post-checkout location samples used to derive visit presence integrity.';

commit;
