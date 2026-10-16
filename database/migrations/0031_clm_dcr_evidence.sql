begin;

create table public.dcr_clm_sessions(
 tenant_id uuid not null,
 dcr_id uuid not null,
 clm_session_id uuid not null,
 asset_id uuid not null,
 reaction text not null,
 started_at timestamptz not null,
 ended_at timestamptz not null,
 primary key(tenant_id,dcr_id,clm_session_id),
 foreign key(tenant_id,dcr_id) references public.dcrs(tenant_id,id) on delete restrict,
 foreign key(tenant_id,clm_session_id) references public.clm_detailing_sessions(tenant_id,id) on delete restrict,
 foreign key(tenant_id,asset_id) references public.clm_assets(tenant_id,id) on delete restrict
);

create or replace function public.snapshot_dcr_clm_sessions()
returns trigger language plpgsql set search_path=''
as $$
begin
 insert into public.dcr_clm_sessions(tenant_id,dcr_id,clm_session_id,asset_id,reaction,started_at,ended_at)
 select new.tenant_id,new.id,s.id,s.asset_id,s.reaction,s.started_at,s.ended_at
 from public.clm_detailing_sessions s
 where s.tenant_id=new.tenant_id and s.visit_id=new.visit_id
 on conflict do nothing;
 return new;
end;$$;

create trigger dcr_clm_snapshot
after insert on public.dcrs
for each row execute function public.snapshot_dcr_clm_sessions();

alter table public.dcr_clm_sessions enable row level security;
revoke all on public.dcr_clm_sessions from anon,authenticated;
grant select on public.dcr_clm_sessions to authenticated;

create policy dcr_clm_sessions_visible on public.dcr_clm_sessions for select to authenticated
using(exists(select 1 from public.dcrs d where d.tenant_id=dcr_clm_sessions.tenant_id and d.id=dcr_clm_sessions.dcr_id));

commit;