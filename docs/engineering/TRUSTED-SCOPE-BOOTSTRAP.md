# Trusted scope-policy bootstrap — PR #68

PR #68 targets `feature/ui-live-role-workspaces` at
`473e74b549eead71226f6c4204c945e22f4d6bd7`. That revision has no R01 checker or
integration allowlist. The previous HEAD-loaded checker could approve its own
policy changes; it is not an authorization boundary.

The correction is deliberately fail-closed:

- The ordinary PR CI extracts the executable checker from the immutable PR base
  SHA, never HEAD. Missing base code/policy fails the check.
- The checker reads the integration policy with `git show <base SHA>:<path>` and
  compares explicit base/head commit SHAs, including both sides of renames.
- `trusted-scope-lock.yml` uses `pull_request_target`: the workflow and checkout
  are base-owned. It fetches the head commit only as Git data, never checks it out,
  installs its dependencies or executes its code. Token permissions are read-only
  and checkout credentials are not persisted.
- The regression commits a malicious HEAD checker plus an expanded allowlist
  and proves the base checker still rejects the unauthorized file.

## Required owner action (not performed by the fixing agent)

1. Independently review the policy-only PR on `chore/terrevo-trusted-scope-policy`.
   Its five files are this document, the checker, checker test, explicit allowlist
   and trusted workflow. The listed paths are proposed authorization, not evidence
   that approval has occurred. In particular, inspect the six review-regression
   support paths and this document added to the original integration scope.
2. Approve and merge that policy-only PR into `feature/ui-live-role-workspaces`.
   This is a repository-policy bootstrap, not product or production approval.
3. Require the base-owned `Trusted scope policy / trusted-scope-lock` status in
   repository rules/branch protection, with owner review for policy/workflow
   changes. The agent has not changed repository protection settings.
4. Update PR #68 with the approved base and rerun CI/review. Do not substitute a
   PR-authored SHA, weaken the required check or waive a missing baseline.

Until then, PR #68's scope-lock failure is expected and merge/release stays HOLD.
No automatic deployment, database migration or production mutation is involved.
