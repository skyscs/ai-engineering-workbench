# Task 115 — Use native v2 paths in the existing public browser

Status: scoped, 2026-11-04.

After Task 114's final resource result and exact-head CI acceptance, migrate the existing
read-only connected-path consumer to the accepted actual CodePathsV2 producer. Keep the
two existing GET endpoints and the existing browser entry point; return the native v2
schema/identity directly, with no v1 relabel, fallback or experimental adapter. Do not
change the qualified analysis, resolution, accounting, storage or native capture code.

Wire one explicit production path owner through startup, HTTP requests, abort signals
and shutdown. Retain request validation, host/origin/session checks, no-store responses,
publication/generation pins, policy/revocation fences and per-catalog concurrency.
Keep the app factory's test/default ownership coherent and close every actual owner in
tests. HTTP callers cannot supply budgets, parser identities or filesystem locations.
Do not alter source-only backup/native history contracts or create saved receipts on GET.

Update browser types to the actual v2 response. Preserve root pagination/selection,
coverage, unavailable states, race/cancellation handling and original evidence links.
Show direct matching Kafka topic evidence where available, with candidate/unknown
runtime and deployment status intact. A live derivation from a saved index must not be
presented as a saved receipt or a verified current runtime path. Reanalysis prompts for
incompatible old inventories remain explicit. No new configuration form is needed.

Use small owned complete and incomplete examples for public HTTP/browser checks.
Require actual v2 schema/accounting/topic identity, supported direct-literal delivery,
an explicit unresolved case, selected/page behavior, stale-generation refusal, unchanged
source authority and read-only behavior. Keep meaningful existing session/CSRF and browser
race regressions. Exercise production startup/shutdown with an isolated data directory;
do not modify the user's checkout or prepared demo. No reserved family replay or model
call is needed. Strict typechecks, relevant integration/browser checks and full tests
must pass, followed by both exact-head CI events before merge.

Update user/developer documentation for the behavior actually exposed. Native saved
capture/history APIs, save/open UI, receipt listing/deletion, semantic answer context,
private pilot, L5 and the Workbench bridge remain subsequent tasks. Scope the smallest
next saved-path workflow after this read-only migration is accepted.
