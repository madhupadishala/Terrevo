#!/usr/bin/env bash
# Real independent PostgreSQL connections; synthetic CI data only.
set -euo pipefail
if [[ "$(psql -X -At -v ON_ERROR_STOP=1 -c 'select current_database()')" != terrevo_ci ]]; then
  echo 'Concurrency suite requires terrevo_ci' >&2; exit 1
fi
concurrency_logs=$(mktemp -d)
concurrency_created=false
cleanup() {
  if [[ "$concurrency_created" == true ]]; then dropdb --if-exists terrevo_concurrency_ci; fi
  rm -rf "$concurrency_logs"
}
trap cleanup EXIT
createdb terrevo_concurrency_ci
concurrency_created=true
pg_dump --schema-only --no-owner | PGDATABASE=terrevo_concurrency_ci psql -X -v ON_ERROR_STOP=1 >/dev/null
export PGDATABASE=terrevo_concurrency_ci
psql -X -v ON_ERROR_STOP=1 -f database/ci/planned-field-concurrency-fixture.sql

race() {
  local name=$1 query=$2 failed=0
  local -a pids=()
  for attempt in {1..16}; do
    psql -X -At -v ON_ERROR_STOP=1 -c "$query" >"$concurrency_logs/$name-$attempt" 2>&1 &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
  if [[ "$failed" == 1 ]]; then cat "$concurrency_logs/$name-"*; return 1; fi
  if [[ $(cat "$concurrency_logs/$name-"* | sort -u | wc -l) != 1 ]]; then
    cat "$concurrency_logs/$name-"*; echo "$name returned differing results" >&2; return 1
  fi
  echo "$name: 16 independent connections returned one operation result"
}
race start "select public.admin_start_tour(
 'f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',
 'f4000000-0000-4000-8000-000000000022',
 (select id from public.tour_plan_days where tenant_id='f4000000-0000-4000-8000-000000000001'),
 null,17.385,78.487,10,null,null,null)"
race checkin "select public.admin_checkin_visit(
 'f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',
 'f4000000-0000-4000-8000-000000000023',
 (select id from public.tour_plan_stops where tenant_id='f4000000-0000-4000-8000-000000000001'),
 17.385,78.487,10,null)"
conflict_query=$(cat <<'SQL'
do $$begin
 begin
  perform public.admin_start_tour(
   'f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',
   'f4000000-0000-4000-8000-000000000022',
   (select id from public.tour_plan_days where tenant_id='f4000000-0000-4000-8000-000000000001'),
   null,18.385,78.487,10,null,null,null);
  raise exception 'Changed start retry accepted' using errcode='P0004';
 exception when unique_violation then
  if sqlerrm<>'idempotency key reused with different start payload' then raise;end if;
 end;
 begin
  perform public.admin_checkin_visit(
   'f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',
   'f4000000-0000-4000-8000-000000000023',
   (select id from public.tour_plan_stops where tenant_id='f4000000-0000-4000-8000-000000000001'),
   17.385,78.487,20,null);
  raise exception 'Changed check-in retry accepted' using errcode='P0004';
 exception when unique_violation then
  if sqlerrm<>'idempotency key reused with different check-in payload' then raise;end if;
 end;
end;$$;
SQL
)
race conflicts "$conflict_query"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$begin
 if (select count(*) from public.tour_executions)<>1
   or (select start_latitude from public.tour_executions) is distinct from 17.385::double precision then
  raise exception 'Concurrent start writes duplicated or altered execution';end if;
 if (select count(*) from public.field_visits)<>1
   or (select checkin_accuracy_meters from public.field_visits) is distinct from 10::double precision then
  raise exception 'Concurrent check-in writes duplicated or altered visit';end if;
end;$$;
SQL
