# Task 046 — Code coverage in the indexing workflow

Status: implemented and locally verified, 2026-11-01.
Scope was committed in `39eaa20` after PR #49 (`7ee582f`) passed both exact-head CI events.

Connect Task 045's durable service to the existing local application. Keep one primary
workflow: Index sources / Update knowledge publishes committed text, then local bounded
code analysis runs automatically for the newly published current index. Add no model,
corporate inputs, parser widening, graph-limit increase or new configuration fields.

## Contract

- Own one analysis service in the daemon and stop it before closing storage. A small
  daemon-owned coordinator observes newly published current indexes, coalesces superseded
  publications and waits for active analysis before starting the newest pending index.
  It never automatically resumes interrupted/paused work or retries a failed attempt.
  Previously published indexes at daemon startup remain explicit Analyze code actions;
  new publication starts use a stable retained request identity. Source/policy changes
  discard obsolete pending scope. Surface automatic start failures without failing the
  already published source index. No raw Git reads are added by analysis.
- Expose bounded inventory summaries, 50-file pages, one validated file payload and
  explicit start/pause/resume/cancel through the existing Host/Origin/session/CSRF boundary.
  Require expected policy/registry versions on manual starts. Reject unknown inputs,
  invalid offsets/actions, stale scope and foreign file IDs. Preserve existing payload
  budgets, two-inventory eviction, parser-version checks and original evidence authority.
- Show a compact Code coverage section next to source-index progress, using the selected
  published index. Distinguish examined/retained code, excluded/failed/unattempted files
  and unsupported files/message counts. Explain that syntax coverage does not establish
  runtime behavior or complete system understanding. Code analysis does not block existing
  search, maps or candidate previews. Keep detailed file rows and limits collapsed.
- Offer appropriate pause/resume/cancel or Analyze code controls without extra input
  fields. List bounded pages with escaped source/path text; inspect one file's supported
  symbols/operations and retained gaps, with keyboard-accessible original references.
  Do not expose raw JSON or parser hashes as the default reading flow.
- Fence delayed summary/page/file/evidence responses after source, policy, selected index,
  run replacement, page or file changes. Clear stale detail on retained-inventory eviction.
  Poll only while the section is mounted, avoid overlapping requests, and recover visibly
  from errors. Automatic analysis is a separate local preparation phase; it does not
  change the preserved graph, candidate ranking, model context or historical evaluations.

## Acceptance

Verify coordinator publication/replay/queue/coalescing/shutdown and stale-scope behavior,
without timing-dependent heavy fixtures. Verify protected HTTP reads/mutations, validation,
pagination, file ownership, all lifecycle actions, errors, revocation and policy fences.
Run strict types/full checks and explicit owned-browser acceptance on port 4244: automatic
coverage, file detail and keyboard originals, narrow layout/escaping, refresh/restart and
held responses after scope/detail changes. Keep existing candidate-browser regressions.
No full-volume or real-model rerun is authorized by this slice.

After exact-head push and pull-request CI pass, merge and continue with separately bounded
query access to inventory facts and originals. Complete-file coverage alone does not
satisfy semantic acceptance or authorize the Workbench bridge.

## Outcome

New current publications now trigger bounded local analysis through a daemon-owned
observer; active work is respected and superseded publications coalesce. Existing indexes,
failed attempts and interrupted work remain explicit. Automatic admission errors are
reported without changing the source index. Protected lifecycle/file APIs and the compact
Code coverage section retain all original validation, parser identities and budgets.

The UI distinguishes affected files from gap-message counts, keeps details collapsed,
provides fifty-file pages and keyboard originals, and rejects delayed scope/page/file
responses. Request generations also protect project-state polling; obsolete pending
source-index receipts clear on policy/registry/publication changes.

Strict types, all 379 tests and production builds pass. New browser acceptance covers
121 files across twenty sources, all three pages, six unsupported files/seven messages,
keyboard/focus/escaping, refresh/restart and held-response fences. The existing candidate
browser regression also passes. See [verification](../docs/fixtures/loredock-code-coverage/README.md)
and [ADR 0041](../docs/decisions/0041-loredock-code-coverage-workflow.md).
No graph/prompt/selection widening, corporate input, full-volume rerun or model request.
Next: bounded query access to full-inventory facts with original support and explicit gaps.
