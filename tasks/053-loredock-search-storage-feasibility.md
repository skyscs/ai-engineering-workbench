# Task 053 — External-content literal search feasibility

Status: in progress, 2026-11-01.

Follow Tasks 051–052 with a prospective, model-free storage experiment. The literal FTS
index repeats text already retained in original spans. Compare an external-content FTS5
index against the current implementation on owned synthetic catalogs before selecting a
production schema migration. Preserve the running demo, frozen evaluations and all gates.

## Contract

- Freeze the design and query cases before implementing/measuring the candidate. Use one
  fresh twenty-source capacity fixture with five added files per source: 179 eligible
  files, two unchanged index generations and one retained code inventory. This is a small
  storage experiment, not another full-volume benchmark or semantic qualification.
- Clone the stopped initial catalog so both variants begin with identical IDs, originals,
  reviews and index history. The candidate keeps a stable INTEGER PRIMARY KEY mapping to
  span IDs, a view onto original span text and FTS5 external content. Preserve tokenizer,
  row identities, rank and snippet semantics. Leave question-search storage unchanged.
- Keep all candidate code in experiment scripts/tests. A minimal store adapter changes
  only literal-search insertion inside the existing file transaction. Use the existing
  read, refresh and revoke code to exercise behavior. No production migration/API/UI change
  or general command accepting a user's data directory. Delete only owned temporary copies.
- Compare ordered literal results, row IDs, ranks, snippets, original evidence, question
  search/context and retained non-search records at the frozen stages. Verify FTS/content
  integrity, rollback, restart, refresh reuse, purge and VACUUM stability. Count candidate
  mapping/view overhead when comparing compacted allocation; do not double-count shared text.
- Record every fixed query comparison and stage, sizes and implementation/runtime identity.
  Require exact mechanical equivalence, lower or equal total compacted allocation and at
  least 10% smaller literal-search-plus-mapping allocation on the fixed pre-purge shape.
  Latency is diagnostic only. A failed gate keeps production unchanged and is retained.

## Delivery

Run focused integration checks, strict checks, all tests/builds and the compiled experiment.
Retain results and limitations, review/create PR and merge after both exact-head CI events
pass. If the gate passes, the next bounded task is migration/write/purge hardening before
production adoption; otherwise document the blocker. No real-model or corporate inputs.
