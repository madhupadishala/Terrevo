import assert from "node:assert/strict";
import test from "node:test";
import { dateFromLocal, getMonthGrid, localDate, shiftMonth, weekStart } from "../src/plan-calendar.ts";

test("monthly grid has Monday-first six-week layout with correct year boundaries", () => {
  const grid = getMonthGrid("2027-01-17", "2027-01-17");
  assert.equal(grid.length, 42);
  assert.equal(grid[0].date, "2026-12-28");
  assert.equal(grid[6].date, "2027-01-03");
  assert.equal(grid[41].date, "2027-02-07");
  assert.equal(grid.filter(x=>x.isToday).length, 1);
  assert.equal(grid.filter(x=>x.inMonth).length, 31);
});
test("week start uses local civil dates and crosses calendar months correctly", () => {
  assert.equal(weekStart("2026-10-11"), "2026-10-05");
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
});
test("month navigation does not skip February from long months", () => {
  assert.equal(shiftMonth("2027-01-31", 1), "2027-02-01");
  assert.equal(shiftMonth("2027-03-31", -1), "2027-02-01");
  assert.equal(localDate(dateFromLocal("2027-02-28")), "2027-02-28");
  assert.throws(()=>dateFromLocal("2027-02-30"),/Invalid date/);
});
