# Task 068 — Typed connected-path service and protected reads

Status: scoped before implementation, 2026-11-02.

Implement Phase B of the [integration contract](../docs/loredock/CONNECTED_PATH_INTEGRATION.md)
after Task 067's passing offline qualification. PR #71 merged as `a6ac15a` after push
`41451690413` and pull-request `41451831925` passed for exact head
`40cfc4068233cdbaa890108094949d8dd6af8027` (462 tests); the merge tree matches that head.

## Scope

- Port the qualified saved metadata/tree proof, manifest join, per-binding completeness,
  indexed resolution and atomic path admission into strict TypeScript under LoreDock.
  Preserve parser profiles, matching predicates, ambiguity, original support and budgets.
- Reuse the existing CodeAnalysis owner. Add one active connected read per catalog,
  cooperative cancellation/shutdown and explicit busy/unavailable results. Reads never
  start, resume, repair or replace inventories and never call Git or write stored data.
- Add protected GET `/api/code-paths` and `/api/code-paths/roots` inside the existing
  Host/Origin/session/no-store boundary. Reject duplicate, unknown, malformed or oversized
  query inputs before scanning. Internal limits/checkpoint controls are not query options.
- Bind generation/root identity to the complete build, inventory, metadata, scope,
  declaration and adapter/limit identity. Bind projection identity to selection and the
  bounded result. Explicit roots and four-root pages pin inventory and generation.
- Return at most two default paths or one selected path, four root cards with complete
  original support, bounded coverage/reason summaries, and a complete envelope <=512 KiB.
  Never return internal fact, unit, symbol-index or resolution vectors. A root whose
  complete card/support cannot fit remains counted with an explicit unavailable entry.
- Preserve existing graph, answer, candidate, correction and history consumers. Add no
  schema, persistence/cache, model call, corporate source, browser UI or demo restart.

## Concurrency boundary

The newest compatible published inventory remains selectable when a newer attempt is
unpublished. Preserve Task 067's conservative database-change fence during an asynchronous
read: concurrent writes discard that pending response and permit an explicit retry; they
do not unpublish the retained inventory. Exercise both the stable older-inventory read and
concurrent-write rejection. Do not introduce table hooks, read snapshots or write exemptions
without separately qualifying their integrity and resource effects.

## Verification and delivery

- Use small owned regression fixtures, including unrelated parser gaps, ambiguous/relevant
  incomplete targets and tree/manifest corruption. Compare normalized typed paths and
  binding outcomes with the qualified offline implementation on these small inputs.
  Do not rerun any frozen measurement matrix or claim a new full-volume benchmark.
- Test default/selected paths, >4 roots and isolated roots, empty/foreign/out-of-range pages,
  generation changes, complete envelope limits, busy release, abort/shutdown, policy/source
  edits, inventory eviction, missing/incompatible facts, historical reads and restarts.
- Exercise HTTP authentication and input validation, original evidence, no read-side
  mutations, newer unpublished inventory behavior and unchanged legacy derivations.
- Run full strict checks/tests/builds. Document implemented API, identity, concurrency and
  limitations in an ADR and development status. Review the complete diff, verify both CI
  events for the exact PR head, merge and synchronize source before Phase C browser work.
