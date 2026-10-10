import assert from "node:assert/strict";
import test from "node:test";
import {
  activeTour, checkIn, checkOut, emptyWorkspace, openVisit,
  readWorkspace, saveNotes, startTour, submitTour, STORAGE_KEY,
} from "../src/workspace.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const DATE = "2026-10-10T10:00:00.000Z";

test("local field lifecycle: start, check in, record notes, check out, submit", () => {
  const one = startTour(emptyWorkspace(), "Central Zone", A, DATE);
  assert.equal(activeTour(one)?.territory, "Central Zone");
  const two = checkIn(one, "Example Doctor", "DOCTOR", B, DATE);
  assert.equal(openVisit(two)?.status, "CHECKED_IN");
  const three = saveNotes(two, B, "Test-only visit note");
  const four = checkOut(three, B, DATE);
  assert.equal(four.visits[0].notes, "Test-only visit note");
  assert.equal(openVisit(four), undefined);
  const five = submitTour(four, DATE);
  assert.equal(activeTour(five), undefined);
  assert.equal(five.tours[0].status, "SUBMITTED");
  assert.equal(five.visits[0].status, "CHECKED_OUT");
});

test("cannot start duplicate active tour, create visit without tour, or check in twice", () => {
  assert.throws(() => checkIn(emptyWorkspace(), "Example", "DOCTOR", B, DATE), /Start a tour/);
  const one = startTour(emptyWorkspace(), "Central Zone", A, DATE);
  assert.throws(() => startTour(one, "Another zone", B, DATE), /active tour/);
  const two = checkIn(one, "Example Doctor", "DOCTOR", B, DATE);
  assert.throws(() => checkIn(two, "Another HCP", "DOCTOR", "c", DATE), /Check out/);
  assert.throws(() => submitTour(two, DATE), /Check out/);
});

test("cannot checkout again or mutate unknown visit", () => {
  const one = startTour(emptyWorkspace(), "Central Zone", A, DATE);
  const two = checkIn(one, "Example Doctor", "DOCTOR", B, DATE);
  const three = checkOut(two, B, DATE);
  assert.throws(() => checkOut(three, B, DATE), /open visit/);
  assert.throws(() => saveNotes(three, "unknown", ""), /not found/);
  assert.throws(() => saveNotes(three, B, "x".repeat(2001)), /2,000/);
});

test("local workspace rehydrates and rejects malformed storage", () => {
  const saved = startTour(emptyWorkspace(), "Central Zone", A, DATE);
  assert.deepEqual(readWorkspace({ getItem: key => key === STORAGE_KEY ? JSON.stringify(saved) : null }), saved);
  assert.deepEqual(readWorkspace({ getItem: () => "{invalid" }), emptyWorkspace());
  assert.deepEqual(readWorkspace({ getItem: () => '{"version":1,"tours":"oops","visits":[]}' }), emptyWorkspace());
  assert.deepEqual(readWorkspace({ getItem: () => null }), emptyWorkspace());
});
