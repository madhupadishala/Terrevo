import { execFileSync } from "node:child_process";

const deployRelevant = [
  /^api\//,
  /^apps\/api\/src\//,
  /^apps\/web\/src\//,
  /^apps\/web\/public\//,
  /^apps\/web\/vite\.config\.[cm]?[jt]s$/,
  /^modules\//,
  /^database\/migrations\//,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^vercel\.json$/,
  /^scripts\/verify-vercel-runtime\.mjs$/,
];

function changedFiles() {
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", "HEAD^", "HEAD"],
      { encoding: "utf8" },
    )
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    // Fail open to a deployment when Git history is unavailable.
    return null;
  }
}

const files = changedFiles();
if (files === null) {
  console.log("Vercel deployment required: unable to determine changed files safely.");
  process.exit(1);
}

const relevant = files.filter((file) =>
  deployRelevant.some((pattern) => pattern.test(file)),
);

if (relevant.length === 0) {
  console.log(
    `Vercel deployment skipped: ${files.length} changed file(s) are non-runtime only.`,
  );
  process.exit(0);
}

console.log(
  `Vercel deployment required for runtime-impacting files: ${relevant.join(", ")}`,
);
process.exit(1);
