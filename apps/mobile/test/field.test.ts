import test from "node:test";
import assert from "node:assert/strict";
import { buildDistributionLines, buildDoctorProducts, distributionKey } from "../src/field.ts";

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
