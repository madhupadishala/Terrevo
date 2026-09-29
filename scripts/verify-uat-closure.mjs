import { readFile } from "node:fs/promises";

const source = await readFile("docs/qa/UAT-CLOSURE.md", "utf8");
const rows = source.split("\n").filter((line) => /^\| UAT-\d+ \|/.test(line));
const failures = [];

if (rows.length !== 16) failures.push(`expected 16 blocking UAT scenarios, found ${rows.length}`);

for (const row of rows) {
  const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
  const [id, , , status, tester, timestamp, build, evidence] = cells;
  if (status !== "PASS") failures.push(`${id}: status is ${status || "blank"}`);
  if (!tester) failures.push(`${id}: tester missing`);
  if (!timestamp || Number.isNaN(Date.parse(timestamp)) || !/Z$/i.test(timestamp)) failures.push(`${id}: valid ISO-8601 UTC date/time ending in Z missing`);
  if (!build) failures.push(`${id}: build/commit missing`);
  if (!evidence) failures.push(`${id}: evidence reference missing`);
}

if (failures.length) {
  console.error("Pilot UAT closure failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot UAT closure verified: all 16 blocking scenarios have PASS status and complete evidence metadata.");
