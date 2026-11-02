# Task 071 — Offline immutable path receipt qualification

Status: completed offline, gate rejected, 2026-11-03. Scope `f17ac85`; freeze `634c77b`; measured candidate `0e50192`.

## Baseline and authorization

Continue the owner's authorized synthetic development sequence. Task 070 merged as
`4c31c53` after exact head `ee1b17e91e586e963282764480aeaf7b5bd1e2e2` passed push
41464612840 and pull-request 41464618513. The primary checkout is clean and matches
origin/main. Follow `docs/loredock/CONNECTED_PATH_CONSUMERS.md` and ADR 0050.

## Scope

Freeze new owned four-repository inputs, an independently authored structural oracle,
resource limits and a one-run measurement protocol before implementing/observing a
separate offline receipt reader/writer. Preserve exact projection JSON, complete original
support and all resolution-scope dependencies. Check historical reads after fact eviction,
restart and new publication without deriving a replacement. Exercise integrity, lifecycle,
resource and synchronous final-publication fences, including a second SQLite connection.

No production code/schema/API/UI/parser change, new answer/review/candidate behavior,
model invocation, corporate source, user-data mutation or demo restart. The offline writer
may create only owned experiment artifacts. It must not become an arbitrary import API.
Existing frozen matrices and model budgets remain exhausted; never rerun them.

## Verification and stop conditions

Use separate small regressions for implementation mistakes. Commit the final candidate and
harness before the single frozen qualification. Retain first outcomes, stdout/stderr/exit
status and artifacts; do not rerun or retune a failed frozen matrix. A failure permits
analysis and a prospective successor, not promotion. A pass is structural/integrity evidence,
not independent semantic or private-pilot acceptance.

Run appropriate strict/regression/full checks, review the complete diff, publish a PR and
merge only after push and pull-request CI pass for the exact head. Keep worktree/toolchain/
raw measurements outside /tmp. Production receipt storage and consumer adoption require a
separate next scope even after a pass.

## Result

Implemented only offline scripts and five separate regression tests. The first frozen run
returns exit 1: 86/88 cases, 989 passed counted assertions, 113 observations. Default paths
stop before subscriber/write because the current resolver requires the exact `orderTopic`
setting name. The alternatives-history case has a harness precondition error: a label-only
lookup selects a handler reference instead of the Java symbol. Neither failure is retuned
or rerun. [All raw outcomes and diagnosis](../docs/fixtures/loredock-path-receipts/README.md)
remain archived; production promotion is rejected.

All other availability, bound, cancellation, corruption and lifecycle cases pass. Historical
reads survive ordinary fact eviction/restart without deriving replacements; source/policy
changes fence complete dependencies. Captures serialize exact projection bytes and guard
final publication against a competing SQLite writer. All 38 successful operation readings
meet their frozen resource thresholds, but shorter paths do not qualify full-hop success.

The repository check passes 483 existing tests and builds. Five new focused source-based
regressions and a targeted strict check also pass (488 tests now defined). Review caught
and removed a test-only prebuilt-dist dependency before CI by injecting services into the
fixture helper. Input hashes and the measured candidate were preserved after execution;
archive reconstruction verifies all 42 raw receipt files. No production schema, API, parser,
model, consumer, demo or user-data change was introduced.

Next: a separately scoped event-topic evidence contract, then fresh useful-path/receipt
qualification. This failed gate and the unexecuted tail of each failing case stay explicit.
