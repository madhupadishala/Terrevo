begin;

create table public.expense_receipt_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  expense_claim_id uuid not null references public.expense_claims(id),
  line_sequence integer not null check (line_sequence>0),
  document_ref text not null check (length(trim(document_ref)) between 1 and 500),
  status text not null check (status in ('VERIFIED','REVOKED')),
  reviewer_user_id uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  review_comment text,
  unique (tenant_id,expense_claim_id,line_sequence)
);

create table public.expense_policy_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  category text not null check (category in ('TRAVEL','MEAL','LODGING','LOCAL_CONVEYANCE','OTHER')),
  max_minor bigint not null check (max_minor>=0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  effective_from date not null,
  expires_at date not null,
  policy_ref text not null check (length(trim(policy_ref)) between 1 and 300),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at>=effective_from),
  unique (tenant_id,category,currency_code,effective_from,policy_ref)
);

alter table public.expense_receipt_reviews enable row level security;
alter table public.expense_receipt_reviews force row level security;
alter table public.expense_policy_limits enable row level security;
alter table public.expense_policy_limits force row level security;

revoke all on public.expense_receipt_reviews from public,anon,authenticated;
revoke all on public.expense_policy_limits from public,anon,authenticated;
grant all on public.expense_receipt_reviews to service_role;
grant all on public.expense_policy_limits to service_role;
-- Evidence is projected only after the server has independently established claim/tenant scope.

commit;
