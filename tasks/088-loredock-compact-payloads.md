# Task 088 — Compact validated request-local payload entries

Status: verified and merged through PR #92 as `2d99d83`, 2026-11-04.

## Evidence and scope

Task 087's frozen terminal diagnostic passes complete paths/originals/history but
fails four operation resource gates. Selected service instances disappear after
release; remaining schema/database/statement matches are runtime-template-shaped.
No unexpected retained application owner was identified. The source ledger still
shows every full validated payload held through resolution and final fences.

Implement one opt-in candidate that stores only `facts`, `ranges` and `evidence`
in request-local entries after `analysis.file` completes all original validation.
Record the same consumed identities before dropping duplicate payload identity
fields. Keep every entry, parser gap, original reference, ambiguity alternative,
domain/completeness input and final snapshot/metadata fence. Do not prune empty
files, change the resolver, cache validation/statements or introduce forced GC.

Use a new factory/module, leaving all measured modules and production consumers
unchanged. Compose with the unchanged streaming snapshot candidate. Start from
reviewed Task 087 head `a8dacff`; verify that PR's exact-head push and pull-request
CI and identical merge tree before claiming the accepted baseline.

## Acceptance

- Exact default/repeat/selected/page/isolated projection and receipt bytes match
  the existing candidate on independent supported tiny input. Work/output counters
  and no-write behavior remain equal; history still reopens exact original bytes.
- Fact-free inputs and parser gaps remain visible to domain coverage; ambiguous,
  unsupported and missing target cases preserve refusals/omissions.
- Corrupted payload/original/range, changed policy/source registration and mutations
  at asynchronous boundaries cannot bypass original validation or final fences.
- No live payload/service registry survives a request. The compact record contains
  only the three required projections; identity hashes still enter consumed coverage.
- Preserve first development failures and relevant evidence. Complete focused tests,
  strict typechecks, builds, full checks and source/diff/reference review. Both CI
  events for the exact final head must pass before merge.
- Do not author or execute a resource family in this task. A later separately frozen
  complete uninstrumented qualification must measure any memory benefit. All old
  failures remain; no resource improvement, product promotion or L5 readiness claim.
- No corporate source, real model call or user demo operation.

## Outcome

The new opt-in reader is an exact fork except for its comment, factory name and
request-entry construction. It records consumed identity before retaining just
facts/ranges/evidence. The unchanged resolver/domain/receipt services consume the
same complete data, and the built service composition imports successfully.

Seven focused tests (including three negative-binding subtests) are covered by the
full check: **545 tests, strict typechecks and builds pass**. Exact default/repeat/
selected/page/isolated bytes, work/output/read counters, history, fact-free gaps,
ambiguity, unsupported consumers, corruption, authorization and asynchronous fences
are preserved. Two first focused failures exposed a test assumption about the
existing structured registry refusal; both logs and closed databases are retained.
See the [verification evidence](../docs/fixtures/loredock-compact-payloads/README.md).

Source/fork/full-diff/reference/hash review confirms all eleven baseline dependencies
and every previously measured module remain unchanged. No new resource family was
created or run. A later complete uninstrumented qualification is required; this
task does not claim lower heap/RSS or production readiness.

PR #91 merged as `6a4f588` after exact head `a8dacff` passed push 41740890855 and
pull-request 41740907626 CI (538 tests); the merge tree is identical. Both CI events
for this task's final head remain required before merge.

Exact final head `68081c2` passed push 41741875498 and pull-request 41741903776 CI
(545 tests). Merge `2d99d83` has the identical tree. Task 089 begins the separately
frozen uninstrumented qualification without changing this implementation.
