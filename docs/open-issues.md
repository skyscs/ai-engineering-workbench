# Open implementation issues

## AEW-001 — Safe navigation to the local UI returns HTTP 403

Priority: P2. Introduced in Task 001, still present after PR #1 was merged.

The global middleware at apps/daemon/src/app.ts rejects Sec-Fetch-Site: cross-site
even for a user following a link to the HTML UI. Direct navigation returns 200,
but a GET / with navigate/document/?1 fetch metadata returns INVALID_ORIGIN JSON.

Follow-up: permit safe top-level UI navigation while preserving Host validation
and all API session, Origin and CSRF checks. Add a regression test. This issue
was reproduced during the first PR review; it has not been fixed.

## AEW-002 — Codex silently accepts a nonexistent profile

Priority: P1 before profile-based AI Connection execution in Task 008.

Observed with CLI 0.153.4: --profile aew-intentionally-missing-runtime-fixture
did not fail. The synthetic investigation completed with exit code 0. Consequently,
passing a requested profile name is not evidence that the requested configuration
was actually selected, and an absent corporate profile could go unnoticed.

Follow-up: validate that an explicitly selected profile exists and is readable
using the verified CLI version's configuration format before spawning. Default
configuration is an explicit separate selection; never use it as fallback for a
missing named profile. Record requested versus verified configuration accurately.
Do not read authentication secrets to perform this preflight.

See docs/fixtures/runtime/resumed-probes.json for the captured probe result.
