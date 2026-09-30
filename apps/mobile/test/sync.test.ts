import test from "node:test";
import assert from "node:assert/strict";
import { isSyncDue, isSyncQueueItem, retryDelayMs, summarizeSyncQueue, syncModeFor, type SyncQueueItem } from "../src/sync.ts";

test("only retry-safe evidence writes auto replay", () => {
  assert.equal(syncModeFor("doctor-call"), "AUTO");
  assert.equal(syncModeFor("expense-submit"), "AUTO");
  assert.equal(syncModeFor("start-tour"), "MANUAL");
  assert.equal(syncModeFor("check-in"), "MANUAL");
  assert.equal(syncModeFor("check-out"), "MANUAL");
  assert.equal(syncModeFor("submit-tour"), "MANUAL");
  assert.equal(syncModeFor("joint-work-join"), "MANUAL");
});

test("retry delay is bounded exponential backoff", () => {
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(2), 60_000);
  assert.equal(retryDelayMs(3), 120_000);
  assert.equal(retryDelayMs(99), 3_600_000);
});

test("due checks and queue summary preserve manual and dead-letter state", () => {
  const base: SyncQueueItem = {
    scope: "tenant.user.doctor-call.v",
    userId: "user",
    tenantId: "tenant",
    action: "doctor-call",
    targetId: "v",
    operationId: "op",
    payload: {},
    mode: "AUTO",
    state: "QUEUED",
    attempts: 1,
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    nextAttemptAt: "2026-09-30T00:00:30.000Z",
    lastError: null,
  };
  assert.equal(isSyncDue(base, new Date("2026-09-30T00:00:29.000Z")), false);
  assert.equal(isSyncDue(base, new Date("2026-09-30T00:00:30.000Z")), true);
  assert.deepEqual(summarizeSyncQueue([
    base,
    { ...base, scope: "manual", mode: "MANUAL" },
    { ...base, scope: "dead", state: "DEAD_LETTER" },
  ]), { waiting: 1, manual: 1, needsAttention: 1 });
});

test("persisted queue validation rejects corrupt retry metadata", () => {
  const valid: SyncQueueItem = {
    scope: "tenant.user.order.v",
    userId: "user",
    tenantId: "tenant",
    action: "order",
    targetId: "v",
    operationId: "op",
    payload: { lines: [] },
    mode: "AUTO",
    state: "QUEUED",
    attempts: 1,
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    nextAttemptAt: null,
    lastError: null,
  };
  assert.equal(isSyncQueueItem(valid), true);
  assert.equal(isSyncQueueItem({ ...valid, attempts: "1" }), false);
  assert.equal(isSyncQueueItem({ ...valid, createdAt: "not-a-date" }), false);
  assert.equal(isSyncQueueItem({ ...valid, mode: "BACKGROUND" }), false);
  assert.equal(isSyncQueueItem({ ...valid, state: "UNKNOWN" }), false);
  const { payload: _payload, ...withoutPayload } = valid;
  assert.equal(isSyncQueueItem(withoutPayload), false);
});
