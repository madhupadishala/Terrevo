# ADR-003: Controlled Change and Frozen Baselines
Status: Accepted

Approved modules/screens become baselined. Unrelated tasks must not change them.

Rules:
- No direct feature work on main.
- Small feature branches and PRs.
- Every PR declares scope and UI/database/API impact.
- No adjacent refactoring or hidden dependency upgrades.
- Visual changes require UI CHANGE = YES.
- Database changes are reviewable migrations.
- Completed modules change only via requirements naming the baseline impact.
- Feature flags isolate incomplete/risky functionality.

Reason: prevent work in one area from silently redesigning or destabilizing accepted work.
