import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsInputError, createAnalyticsService } from "../../../modules/analytics/src/index.ts";

/** Verifies a valid rolling window is delegated unchanged to the repository. */
async function acceptsBoundedRollingWindow() {
  let received = 0;
  const service = createAnalyticsService({
    async getManagerAnalytics(_tenantId, _token, days) {
      received = days;
      return {} as never;
    },
  });
  await service.getManagerAnalytics("tenant", "token", 30);
  assert.equal(received, 30);
}

/** Verifies invalid rolling-window inputs are rejected before repository access. */
function rejectsInvalidWindows() {
  const service = createAnalyticsService({ getManagerAnalytics: async () => ({} as never) });
  assert.throws(() => service.getManagerAnalytics("tenant", "token", 0), AnalyticsInputError);
  assert.throws(() => service.getManagerAnalytics("tenant", "token", 91), AnalyticsInputError);
  assert.throws(() => service.getManagerAnalytics("tenant", "token", 7.5), AnalyticsInputError);
}

test("analytics accepts a bounded rolling window", acceptsBoundedRollingWindow);
test("analytics rejects invalid windows", rejectsInvalidWindows);
