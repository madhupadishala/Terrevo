begin;

drop function if exists public.admin_record_departure_presence(uuid,uuid,uuid,uuid,jsonb);
drop trigger if exists visit_presence_samples_immutable on public.visit_presence_samples;
drop trigger if exists visit_presence_integrity_immutable on public.visit_presence_integrity;
drop table if exists public.visit_presence_samples;
drop table if exists public.visit_presence_integrity;
drop function if exists public.reject_presence_integrity_mutation();

commit;
