import test from "node:test";
import assert from "node:assert/strict";
import { buildDistributionLines, buildDoctorProducts, distributionKey, projectedInventoryBalance, weekStartFromDate } from "../src/field.ts";

test("doctor products preserve selection order and explicit sequence", () => {
  assert.deepEqual(buildDoctorProducts(["p2", "p1", "p2"]), [
    { sequence: 1, productId: "p2", detailNotes: null },
    { sequence: 2, productId: "p1", detailNotes: null },
  ]);
});

test("distribution lines cannot exceed available employee inventory", () => {
  const balance = { id: "b", employeeId: "e", itemType: "sample" as const, itemId: "s", quantity: 3 };
  assert.deepEqual(buildDistributionLines([balance], { [distributionKey(balance)]: "2" }), [
    { itemType: "sample", itemId: "s", quantity: 2 },
  ]);
  assert.throws(
    () => buildDistributionLines([balance], { [distributionKey(balance)]: "4" }),
    /available balance/i,
  );
});


test("projected inventory shows remaining balance without mutating actual stock", () => {
  const balance = { id: "b", employeeId: "e", itemType: "sample" as const, itemId: "s", quantity: 5 };
  assert.equal(projectedInventoryBalance(balance, { [distributionKey(balance)]: "2" }), 3);
  assert.equal(projectedInventoryBalance(balance, { [distributionKey(balance)]: "6" }), null);
  assert.equal(balance.quantity, 5);
});

test("week start is derived deterministically from a work date", () => {
  assert.equal(weekStartFromDate("2026-09-29"), "2026-09-28");
  assert.equal(weekStartFromDate("2026-09-28"), "2026-09-28");
});
