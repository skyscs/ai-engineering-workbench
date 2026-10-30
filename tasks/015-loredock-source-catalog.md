# Task 015 — LoreDock local source catalog and committed-text index

Status: implemented and locally verified on 2026-09-28; merged through PR #18
at `769c652`, confirmed on 2026-09-30.

## Objective

Connect three local repositories, build a committed-text catalog and reopen exact
source evidence in a minimal separate LoreDock application, without any model call.

## Scope

1. Add separate LoreDock daemon/web entry points and a separate data directory/schema.
   Reuse only narrowly audited infrastructure under [ADR 0018](../docs/decisions/0018-loredock-foundation-and-runtime-gate.md).
   Workbench remains independently runnable and its database stays unchanged.
2. Provide one project screen: add local repositories, start indexing, view progress and
   coverage, search indexed text, open a citation. Show advanced limits/policy only when
   needed. No graph editor, remote credentials, model setup or automatic analysis wizard.
3. Persist the registry, immutable revision vector, policy, inventory, spans and FTS5 index.
   Use Git object reads and bounded UTF-8; support README/text, JSON metadata and safe
   Maven metadata. Display uncommitted changes as excluded. Do not execute source code.
4. Implement durable one-file work units, duplicate requests, pause/cancel/resume,
   interruption on restart, validated checkpoint reuse and atomic build publication.
5. Fence disabled/revoked sources from search/citations immediately and record purge work.
   Make partial sources, unsupported content and limits visible rather than reporting a
   misleading complete build. Use the provisional [contracts](../docs/loredock/CONTRACTS.md).

## Acceptance

- Import the deterministic [three-repository fixture](../fixtures/loredock/README.md).
  Every admitted citation reopens at its exact revision/hash/range; oracle files and
  outside canaries are never indexed. Exclusions include policy, binary and symlink.
- Re-running the same request does not duplicate a build; changing the payload conflicts.
  Add/remove a file, change README/topic, revoke a source and change policy: affected
  search results and coverage update without mutating earlier build records.
- Restart during indexing, resume after a file checkpoint, pause and cancel with a late
  unit result: state stays truthful and a cancelled unit cannot publish into the build.
- Test traversal, symlinks, submodules/LFS pointers, malformed UTF-8, size caps, XML entity
  attempts, source command instructions, unknown revision and a dirty original checkout.
  Original repositories remain unchanged; no hooks, project commands or model calls run.
- Verify a browser flow from adding sources to opening search evidence; all user-facing
  product text and artifacts are English. Existing Workbench checks pass.

## Non-goals and next checkpoint

No full Java/JS call graph, AI summary, embeddings, external connector, broker/database
connection, automatic routing or Workbench pack import. Review the useful catalog and
coverage UX before Task 016. CLI qualification does not block this model-free task.

## Outcome

Delivered separate LoreDock apps, schema 1 ownership and a three-source catalog on
port 4244. The UI registers local sources, starts indexes, shows coverage and revisions,
searches FTS5 passages and reopens persisted exact citations. Durable file units support
pause/cancel/resume, interruption recovery, idempotent submissions and fenced publication.
Source removal fences reads before resumable purge; changed policy fences old indexes.

[ADR 0019](../docs/decisions/0019-loredock-local-catalog.md) records the byte-preserving
Git reader, SQLite source snapshots, conservative extraction and partial-budget decisions.
The [user guide](../docs/loredock/USER_GUIDE.md) covers startup, updates, storage and API.

`pnpm check` passed strict typechecks, 162 tests and production builds. Seventeen new
LoreDock tests cover the corpus, exact evidence/ranges, malformed and unsupported inputs,
no filter/hook execution, dirty originals, request replay, interruption/checkpoint reuse,
late cancellation/revocation, policy changes, source failure, budgets, ownership and HTTP
security. The [Chrome acceptance](../docs/fixtures/loredock-catalog/README.md) verifies
three-source indexing, search/evidence, mobile layout, removal, policy fencing, reindex
and restart. All inputs are synthetic and zero model calls were made.

The branch also carries the already-reviewed L0 commits into main: PR #17 was merged
into the prior UX branch after PR #16 reached main. Workbench application code and
user databases remain unchanged. Task 016 is not started.
