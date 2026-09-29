import test from "node:test";
import assert from "node:assert/strict";
import { presenceStatusMessage } from "../src/presence.ts";

test("server presence result messages stay explicit", () => {
  assert.match(presenceStatusMessage("CONSISTENT"), /consistent/i);
  assert.match(presenceStatusMessage("REVIEW_REQUIRED"), /review/i);
  assert.match(presenceStatusMessage("SPOOF_SUSPECTED"), /suspicious/i);
});
