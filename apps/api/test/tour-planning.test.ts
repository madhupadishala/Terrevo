import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/handler.ts";

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "public-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
};

function sequenceFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected fetch call: ${String(input)}`);
    return Response.json(next.body ?? {}, { status: next.status ?? 200 });
  };
  return { fetcher, calls };
}

const tenantId = "11111111-1111-4111-8111-111111111111";
const territoryId = "22222222-2222-4222-8222-222222222222";
const planId = "33333333-3333-4333-8333-333333333333";
const dayId = "44444444-4444-4444-8444-444444444444";
const doctorId = "55555555-5555-4555-8555-555555555555";

function authResponses() {
  return [
    { body: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "mr@example.com" } },
    { body: [{ id: tenantId }] },
  ];
}

function headers() {
  return {
    authorization: "Bearer user-token",
    "x-tenant-id": tenantId,
    "content-type": "application/json",
  };
}

const draftBody = {
  weekStart: "2026-10-05",
  days: [{
    date: "2026-10-05",
    territoryId,
    remarks: "Monday",
    stops: [{ sequence: 1, type: "doctor", targetId: doctorId }],
  }],
};

test("TRV-TOURPLAN-001 lists own weekly plans using user token", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: planId, week_start: "2026-10-05", status: "DRAFT", submitted_at: null }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/tour-plans", { headers: headers() }),
  );

  assert.equal(response.status, 200);
  assert.match(calls[2].url, /\/rest\/v1\/tour_plans\?/);
  assert.equal((calls[2].init?.headers as Record<string,string>).authorization, "Bearer user-token");
});

test("TRV-TOURPLAN-001 rejects non-Monday week before privileged write", async () => {
  const { fetcher, calls } = sequenceFetch(authResponses());
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/tour-plans", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ...draftBody, weekStart: "2026-10-06" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(calls.length, 2);
});

test("TRV-TOURPLAN-003 denies territory outside TOUR_PLAN_OWN scope", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: false },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/tour-plans", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(draftBody),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(calls.some((call) => (call.init?.headers as Record<string,string> | undefined)?.authorization === "Bearer server-only-test-key"), false);
});

test("TRV-TOURPLAN-006 saves atomically then reloads the draft", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: true },
    { body: planId },
    { body: [{ id: planId, week_start: "2026-10-05", status: "DRAFT", submitted_at: null }] },
    { body: [{ id: dayId, plan_date: "2026-10-05", territory_id: territoryId, remarks: "Monday" }] },
    { body: [{ tour_plan_day_id: dayId, sequence_no: 1, stop_type: "doctor", doctor_id: doctorId, chemist_id: null, stockist_id: null, remarks: null }] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request("https://api.terrevo.test/v1/tour-plans", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(draftBody),
    }),
  );
  const body = await response.json() as { plan: { id: string; days: unknown[] } };

  assert.equal(response.status, 201);
  assert.equal(body.plan.id, planId);
  assert.equal(body.plan.days.length, 1);
  assert.match(calls[3].url, /\/rpc\/admin_save_tour_plan$/);
  assert.equal((calls[3].init?.headers as Record<string,string>).authorization, "Bearer server-only-test-key");
});

test("TRV-TOURPLAN-007 refuses editing an already submitted plan", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: planId, week_start: "2026-10-05", status: "SUBMITTED", submitted_at: "2026-10-01T10:00:00Z" }] },
    { body: [] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request(`https://api.terrevo.test/v1/tour-plans/${planId}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(draftBody),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal(calls.some((call) => /admin_save_tour_plan/.test(call.url)), false);
});

test("TRV-TOURPLAN-008 refuses submission with no stops", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: planId, week_start: "2026-10-05", status: "DRAFT", submitted_at: null }] },
    { body: [{ id: dayId, plan_date: "2026-10-05", territory_id: territoryId, remarks: null }] },
    { body: [] },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request(`https://api.terrevo.test/v1/tour-plans/${planId}/submit`, {
      method: "POST",
      headers: headers(),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal(calls.some((call) => /admin_submit_tour_plan/.test(call.url)), false);
});

test("TRV-TOURPLAN-009 submits valid draft only after territory authorization", async () => {
  const { fetcher, calls } = sequenceFetch([
    ...authResponses(),
    { body: [{ id: planId, week_start: "2026-10-05", status: "DRAFT", submitted_at: null }] },
    { body: [{ id: dayId, plan_date: "2026-10-05", territory_id: territoryId, remarks: null }] },
    { body: [{ tour_plan_day_id: dayId, sequence_no: 1, stop_type: "doctor", doctor_id: doctorId, chemist_id: null, stockist_id: null, remarks: null }] },
    { body: true },
    { body: {} },
  ]);
  const response = await createHandler(env, { fetcher })(
    new Request(`https://api.terrevo.test/v1/tour-plans/${planId}/submit`, {
      method: "POST",
      headers: headers(),
    }),
  );

  assert.equal(response.status, 204);
  assert.match(calls[6].url, /\/rpc\/admin_submit_tour_plan$/);
  assert.equal((calls[6].init?.headers as Record<string,string>).authorization, "Bearer server-only-test-key");
});
