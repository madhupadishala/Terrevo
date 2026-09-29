import test from "node:test";
import assert from "node:assert/strict";
import { accountMutationScope, buildDistributionLines, buildDoctorProducts, buildOrderLines, buildRcpaLines, distributionKey, projectedInventoryBalance, weekStartFromDate } from "../src/field.ts";

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

test("order lines preserve selection order and require positive quantities", () => {
  assert.deepEqual(buildOrderLines(["p2", "p1", "p2"], { p2: "3", p1: "1" }), [
    { sequence: 1, productId: "p2", quantity: 3, remarks: null },
    { sequence: 2, productId: "p1", quantity: 1, remarks: null },
  ]);
  assert.throws(() => buildOrderLines(["p1"], { p1: "0" }), /positive whole number/i);
});

test("RCPA combines company and competitor observations without inventing values", () => {
  assert.deepEqual(buildRcpaLines(
    ["p1"],
    { p1: { prescriptionCount: "4", stockQuantity: "", salesQuantity: "2" } },
    [{ brand: "Brand X", prescriptionCount: "3", stockQuantity: "1", salesQuantity: "" }],
  ), [
    { sequence: 1, productId: "p1", competitorBrand: null, prescriptionCount: 4, stockQuantity: 0, salesQuantity: 2 },
    { sequence: 2, productId: null, competitorBrand: "Brand X", prescriptionCount: 3, stockQuantity: 1, salesQuantity: 0 },
  ]);
});


test("critical retry scopes are isolated by tenant and user", () => {
  const base = "leave-submit";
  assert.equal(accountMutationScope("user-a", "tenant-a", base), "tenant-a.user-a.leave-submit");
  assert.notEqual(
    accountMutationScope("user-a", "tenant-a", base),
    accountMutationScope("user-b", "tenant-a", base),
  );
  assert.notEqual(
    accountMutationScope("user-a", "tenant-a", base),
    accountMutationScope("user-a", "tenant-b", base),
  );
  assert.throws(() => accountMutationScope("", "tenant-a", base), /requires user, tenant/i);
});
