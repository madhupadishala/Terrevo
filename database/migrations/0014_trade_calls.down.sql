begin;
drop trigger if exists field_visits_trade_call_guard on public.field_visits;
drop function if exists public.require_trade_call_before_checkout();
drop function if exists public.admin_save_trade_call(uuid,uuid,uuid,uuid,text,text,text);
drop table if exists public.trade_call_operations;
drop table if exists public.trade_calls;
commit;
