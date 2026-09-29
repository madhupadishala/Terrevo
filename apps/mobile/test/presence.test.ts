import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDeparture, type PresencePoint } from "../src/presence.ts";

const base: PresencePoint = {
  latitude: 17.385,
  longitude: 78.4867,
  accuracyMeters: 8,
  capturedAt: "2026-09-29T11:00:00.000Z",
  mocked: false,
};

function point(offsetSeconds: number, latitude: number, longitude: number, mocked: boolean | null = false): PresencePoint {
  return {
    latitude,
    longitude,
    accuracyMeters: 10,
    capturedAt: new Date(new Date(base.capturedAt).getTime() + offsetSeconds * 1000).toISOString(),
    mocked,
  };
}

test("irregular nearby movement is consistent", () => {
  const result = evaluateDeparture(base, [
    point(20, 17.38503, 78.48672),
    point(50, 17.38501, 78.48669),
    point(80, 17.38518, 78.48682),
    point(110, 17.38512, 78.48678),
  ]);
  assert.equal(result.status, "CONSISTENT");
});

test("stationary after checkout is not treated as fraud", () => {
  const result = evaluateDeparture(base, [
    point(20, 17.385, 78.4867),
    point(50, 17.385, 78.4867),
    point(80, 17.385, 78.4867),
  ]);
  assert.equal(result.status, "CONSISTENT");
});

test("mocked Android point is spoof suspected", () => {
  const result = evaluateDeparture(base, [
    point(20, 17.38501, 78.48671, true),
    point(50, 17.38502, 78.48672),
    point(80, 17.38503, 78.48673),
  ]);
  assert.equal(result.status, "SPOOF_SUSPECTED");
});

test("impossible jump is review required", () => {
  const result = evaluateDeparture(base, [
    point(20, 17.5, 78.6),
    point(50, 17.5001, 78.6001),
    point(80, 17.5002, 78.6002),
  ]);
  assert.equal(result.status, "REVIEW_REQUIRED");
});
