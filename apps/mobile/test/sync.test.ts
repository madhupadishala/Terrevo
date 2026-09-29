import test from "node:test";
import assert from "node:assert/strict";
import { isDefinitiveSyncFailure, parseSyncOperation, shouldStopSyncAfterFailure } from "../src/sync.ts";

test("sync scope parsing remains identity scoped", () => {
  assert.deepEqual(parseSyncOperation("tenant-a.user-a.order.visit-1", "user-a", "tenant-a"), {
    kind: "order",
    targetId: "visit-1",
  });
  assert.deepEqual(parseSyncOperation("tenant-a.user-a.leave-submit", "user-a", "tenant-a"), {
    kind: "leave-submit",
    targetId: null,
  });
  assert.equal(parseSyncOperation("tenant-a.user-b.order.visit-1", "user-a", "tenant-a"), null);
  assert.equal(parseSyncOperation("tenant-b.user-a.order.visit-1", "user-a", "tenant-a"), null);
});

test("sync failure policy distinguishes definitive business failures from retryable infrastructure", () => {
  assert.equal(isDefinitiveSyncFailure({ status: 400 }), true);
  assert.equal(isDefinitiveSyncFailure({ status: 409 }), true);
  assert.equal(isDefinitiveSyncFailure({ status: 500 }), false);
  assert.equal(shouldStopSyncAfterFailure({ status: 400 }), false);
  assert.equal(shouldStopSyncAfterFailure({ status: 401 }), true);
  assert.equal(shouldStopSyncAfterFailure({ status: 429 }), true);
  assert.equal(shouldStopSyncAfterFailure({ status: 503 }), true);
  assert.equal(shouldStopSyncAfterFailure(new TypeError("network")), true);
});
