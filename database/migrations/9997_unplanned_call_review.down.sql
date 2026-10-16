begin;
drop function if exists public.admin_decide_unplanned_call(uuid,uuid,uuid,text,text);
drop function if exists public.admin_submit_unplanned_call(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,integer,numeric,numeric,numeric);
drop table if exists public.unplanned_call_decisions;
drop table if exists public.unplanned_calls;
commit;
