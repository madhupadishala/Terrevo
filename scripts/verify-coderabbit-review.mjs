import fs from "node:fs";
import { spawnSync } from "node:child_process";

const requiredEnv = ["MANIFEST","GH_TOKEN","REPOSITORY","PR_NUMBER","HEAD_SHA"];
for (const key of requiredEnv) {
  if (!process.env[key]?.trim()) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST, "utf8"));
const policy = JSON.parse(fs.readFileSync("governance/product-gates.json", "utf8"));
const trusted = policy.trustedProducers?.codeRabbit;

if (!trusted?.login || !trusted?.id) {
  console.error("Trusted CodeRabbit producer is not configured");
  process.exit(1);
}

const exactSha = manifest.exactCommit;
const headSha = process.env.HEAD_SHA;
const repository = process.env.REPOSITORY;
const prNumber = Number(process.env.PR_NUMBER);

if (!/^[0-9a-f]{40}$/.test(exactSha || "") || !/^[0-9a-f]{40}$/.test(headSha || "")) {
  console.error("Invalid exactCommit or HEAD_SHA");
  process.exit(1);
}
if (!Number.isInteger(prNumber) || prNumber < 1) {
  console.error("Invalid PR_NUMBER");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${process.env.GH_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
};

async function pagedRest(pathname) {
  const all = [];
  for (let page = 1; page <= 50; page += 1) {
    const url = new URL(`https://api.github.com/repos/${repository}/${pathname}`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`GitHub API request failed (${response.status}): ${url.pathname}`);
      process.exit(1);
    }
    const payload = await response.json();
    if (!Array.isArray(payload)) {
      console.error(`Expected array payload from ${url.pathname}`);
      process.exit(1);
    }
    all.push(...payload);
    if (payload.length < 100) return all;
  }
  console.error(`Pagination safety limit exceeded for ${pathname}`);
  process.exit(1);
}

function commitExists(commit) {
  const result = spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function isAncestor(ancestor, descendant) {
  if (!commitExists(ancestor) || !commitExists(descendant)) return false;

  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
    stdio: "ignore"
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  console.error(`Unable to evaluate ancestry: ${ancestor} -> ${descendant}`);
  process.exit(1);
}

function changedPaths(from, to) {
  const result = spawnSync(
    "git",
    ["diff", "--no-renames", "--name-only", "-z", from, to],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    console.error(`Unable to calculate qualification diff: ${from} -> ${to}`);
    process.exit(1);
  }
  return result.stdout.split("\0").filter(Boolean);
}

const reviews = await pagedRest(`pulls/${prNumber}/reviews`);
const trustedReviews = reviews
  .filter(review =>
    review.user?.login === trusted.login &&
    review.user?.id === trusted.id &&
    typeof review.commit_id === "string" &&
    /^[0-9a-f]{40}$/.test(review.commit_id) &&
    isAncestor(exactSha, review.commit_id) &&
    isAncestor(review.commit_id, headSha)
  )
  .sort((a, b) =>
    new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0) ||
    (a.id || 0) - (b.id || 0)
  );

const latestReview = trustedReviews.at(-1);
if (!latestReview) {
  console.error("No trusted CodeRabbit review exists between exactCommit and current head");
  process.exit(1);
}
if (latestReview.state !== "APPROVED") {
  console.error(`Latest trusted CodeRabbit review in qualification range is ${latestReview.state}, not APPROVED`);
  process.exit(1);
}

const postReviewChanges = changedPaths(latestReview.commit_id, headSha);
const invalidPostReviewChanges = postReviewChanges.filter(
  file => !file.startsWith("docs/evidence/") && !file.startsWith("docs/qa/")
);
if (invalidPostReviewChanges.length) {
  console.error(`Non-evidence changes exist after CodeRabbit-reviewed commit ${latestReview.commit_id}:`);
  for (const file of invalidPostReviewChanges) console.error(`- ${file}`);
  process.exit(1);
}

const [owner, name] = repository.split("/");
let cursor = null;
let unresolvedCount = 0;
for (let page = 1; page <= 50; page += 1) {
  const query = `
    query($owner:String!,$name:String!,$number:Int!,$after:String) {
      repository(owner:$owner,name:$name) {
        pullRequest(number:$number) {
          reviewThreads(first:100,after:$after) {
            nodes { isResolved }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  `;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      variables: { owner, name, number: prNumber, after: cursor }
    })
  });
  if (!response.ok) {
    console.error(`GitHub GraphQL request failed: ${response.status}`);
    process.exit(1);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    console.error("Review-thread query failed:", JSON.stringify(payload.errors));
    process.exit(1);
  }
  const threads = payload.data?.repository?.pullRequest?.reviewThreads;
  if (!threads) {
    console.error("Review-thread payload missing");
    process.exit(1);
  }
  unresolvedCount += (threads.nodes || []).filter(thread => !thread.isResolved).length;
  if (!threads.pageInfo?.hasNextPage) break;
  cursor = threads.pageInfo.endCursor;
  if (!cursor || page === 50) {
    console.error("Review-thread pagination could not be completed");
    process.exit(1);
  }
}

if (unresolvedCount > 0) {
  console.error(`Unresolved review threads remain: ${unresolvedCount}`);
  process.exit(1);
}

console.log(
  `Trusted CodeRabbit approval: PASS — review ${latestReview.id} on ${latestReview.commit_id}; zero unresolved threads`
);
