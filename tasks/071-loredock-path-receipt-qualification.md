# Task 071 — Offline immutable path receipt qualification

Status: scoped before implementation, 2026-11-03.

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
