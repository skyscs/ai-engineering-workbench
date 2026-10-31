# Task 020 — Validated file reuse and visible index changes

Status: accepted through the owner's merge of PR #24 (`ff1cb6f`), 2026-10-31.
Task 019 was accepted through the owner's merge
of PR #23 (`5491545`); the owner requested continuation.

## Objective

Explicitly update indexed knowledge, reuse unchanged authorized text work and see
what changed without losing the previous published index. This is the first bounded
L4 slice, not complete incremental semantic/AI refresh or full L3 acceptance.

## Implementation boundary

- Always resolve/snapshot and inventory every current source from committed Git.
  Capture the prior published index as a fixed baseline at start. No checkout/fetch,
  source execution, background polling of Git or automatic model invocation.
- Reuse only same-source/path/mode/blob/size indexed files from that published baseline
  under the same policy/extractor. Validate stored bytes against both SHA-256 and the
  current Git object ID, complete original spans and metadata derivation fingerprint.
  Legacy checkpoints require a full extraction check before first reuse.
- Recalculate current exclusions and byte/path budgets before reuse. Unsupported,
  failed and excluded byte-dependent inputs are read again when needed; do not claim
  zero Git reads for the corpus's binary canaries.
- Publish independent file/span IDs and search rows in the new index, with reuse
  lineage and durable Git-read-attempt/cache-validation metrics. Corrupted cache falls
  back to the pinned Git object; it never becomes new evidence silently.
- Preserve pause/cancel/resume/restart and atomic publication. Failed updates keep
  the previous published index; available source scopes may publish honestly partial
  coverage. New/deleted files and newly registered sources cannot disappear through
  a cache shortcut. Missing/incomplete inventory is not proof of deletion.
- Add schema 5 and a bounded protected change-summary API. Compare only authorized
  scopes; revoked sources and old-policy content cannot leak through comparison or
  lineage. Separate file content changes, coverage changes and unknown comparisons.
- Expose one contextual Update knowledge action and simple change counts; parser/cache
  diagnostics stay in details. Preserve current/historical selection and late-response
  fences. Corrections/answers remain tied to their original indexes and visibly scoped.

## Acceptance

- On the unchanged frozen corpus, reuse all 18 admitted text files; only the three
  binary canaries require byte reads. Reopen all new citations and prove old/new IDs
  remain distinct, with original revisions/hashes preserved and checkouts unchanged.
- One changed file, an added consumer and a removed file appear in the new search/map
  and comparison while historical results remain pinned. New source inventory is read.
- Tests cover cache/raw/span/metadata corruption, policy/extractor/source isolation,
  limits, partial/failed inventories, pause/cancel/restart, rollback, dirty checkout
  preservation, schema 4 upgrade and protected transport.
- Browser acceptance covers Update knowledge, unchanged/changed summaries, original
  evidence, historical selection, correction isolation, source/policy fences and 390px
  layout. Existing cited-answer/browser regressions remain green.
- Commit English documentation and reproducible evaluation/browser evidence with zero
  real model calls. No Workbench database/runtime or normal source checkout is changed.

## Follow-up

Semantic/AI unit caching, correction reconciliation, broader overview/guidance, real
framework adapters, 20-repository acceptance and the Workbench bridge remain separate.

## Verification record

`pnpm check` passes 245 tests (94 LoreDock), strict typechecks and production builds.
Production evaluation records 21 initial Git file reads, then three on the unchanged
corpus with 18 text files reused. A changed-file/added-consumer/removed-client update
reuses 16 files with five reads, preserving historical citations and discovering the
consumer. Chrome verifies both update states, original/selected evidence, correction
isolation, source/policy fences, restart and 390px layout. Existing answer acceptance
uses four fake invocations and zero real models. See
[review evidence](../docs/fixtures/loredock-refresh/README.md).
