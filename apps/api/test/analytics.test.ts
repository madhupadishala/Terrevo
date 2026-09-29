import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsInputError, createAnalyticsService } from "../../../modules/analytics/src/index.ts";

test("analytics accepts a bounded rolling window", async () => {
  let received = 0;
  const service = createAnalyticsService({
    async getManagerAnalytics(_tenantId, _token, days) {
      received = days;
      return {} as never;
    },
  });
  await service.getManagerAnalytics("tenant", "token", 30);
  assert.equal(received, 30);
});

test("analytics rejects invalid windows", () => {
  const service = createAnalyticsService({ getManagerAnalytics: async () => ({} as never) });
  assert.throws(() => service.getManagerAnalytics("tenant", "token", 0), AnalyticsInputError);
  assert.throws(() => service.getManagerAnalytics("tenant", "token", 91), AnalyticsInputError);
  assert.throws(() => service.getManagerAnalytics("tenant", "token", 7.5), AnalyticsInputError);
});
