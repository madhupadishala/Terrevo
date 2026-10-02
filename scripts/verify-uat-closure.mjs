import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const source = await readFile("docs/qa/UAT-CLOSURE.md", "utf8");
const rows = source.split("\n").filter((line) => /^\| UAT-\d+ \|/.test(line));
const failures = [];

const expectedIds = Array.from({ length: 16 }, (_, index) =>
  `UAT-${String(index + 1).padStart(2, "0")}`,
);
const seenIds = new Set();
const checkedOutCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const candidateCommit =
  process.env.SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? checkedOutCommit;

if (!/^[0-9a-f]{40}$/i.test(candidateCommit)) {
  failures.push("release candidate commit is not a full 40-character Git SHA");
}
if (candidateCommit.toLowerCase() !== checkedOutCommit.toLowerCase()) {
  failures.push(
    `release candidate ${candidateCommit} does not match checked-out commit ${checkedOutCommit}`,
  );
}

for (const row of rows) {
  const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
  const [id, , , status, tester, timestamp, build, evidence] = cells;

  if (!expectedIds.includes(id)) {
    failures.push(`unexpected UAT scenario ID: ${id}`);
  } else if (seenIds.has(id)) {
    failures.push(`duplicate UAT scenario ID: ${id}`);
  } else {
    seenIds.add(id);
  }

  if (status !== "PASS") failures.push(`${id}: status is ${status || "blank"}`);
  if (!tester) failures.push(`${id}: tester missing`);
  if (!timestamp || Number.isNaN(Date.parse(timestamp)) || !/Z$/i.test(timestamp)) {
    failures.push(`${id}: valid ISO-8601 UTC date/time ending in Z missing`);
  }
  if (!build) {
    failures.push(`${id}: build/commit missing`);
  } else if (build.toLowerCase() !== candidateCommit.toLowerCase()) {
    failures.push(`${id}: build/commit does not match release candidate ${candidateCommit}`);
  }
  if (!evidence) failures.push(`${id}: evidence reference missing`);
}

for (const id of expectedIds) {
  if (!seenIds.has(id)) failures.push(`missing blocking UAT scenario: ${id}`);
}

if (failures.length) {
  console.error("Pilot UAT closure failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot UAT closure verified: all 16 blocking scenarios have PASS status and complete evidence metadata.");
