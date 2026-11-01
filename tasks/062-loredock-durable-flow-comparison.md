# Task 062 — Offline durable-fact flow comparison

Status: scoped before implementation, 2026-11-01.

Execute the prospective comparison in [Task 061's design](../docs/loredock/DURABLE_FLOW_DESIGN.md)
using only fresh owned synthetic repositories. Keep production code, selection, APIs,
answer/correction behavior, persisted schema and the running user demo unchanged.

## Scope

- Freeze deterministic generated inputs, independent support oracles and the prototype
  implementation before collecting results. Preserve the first observations and any
  harness failures; do not tune selection against observed failures.
- Compare unchanged production control, exact saved-fact parity and naive wider input
  under the existing graph/declaration/output limits. Reuse the pinned assembler only in
  an explicitly labeled offline prototype. Read saved facts through CodeAnalysis validation,
  retain original citations, yield per file and recheck inventory/scope before publication.
- Execute all nine F01–F09 scenarios: small parity, 120 short-path files per source,
  a dense 200-function file, ambiguous imports/handlers, unresolved wiring, missing/partial
  inventories, integrity/parser failures, yielded scope changes, and history/restart/eviction.
  Each fresh variant has at most 600 code files. Keep five-second cooperative reader limits.
- Record full input/file/fact/graph/support vectors, exact original reopening, provenance,
  coverage/omissions, validation and assembly timing, sampled RSS, output bytes, Git calls
  and SQLite writes. Use one first and one repeat measurement on unchanged snapshots;
  lifecycle mutations are deliberate setup events, distinguished from projection work.
- Retain negative wider-selection results. Do not rerun frozen experiments or models,
  access corporate code, increase production budgets or claim semantic/private-pilot readiness.

## Verification and delivery

Commit scope before implementation. Use a separate worktree so builds cannot replace the
user demo's served assets. Add meaningful checks for the offline reader/comparison contract,
run appropriate strict/full checks, review complete changes and record English results and
next-step decisions. No browser rerun is needed for offline-only work. Publish a separate
PR, wait for both CI events on the exact head, merge and synchronize the source checkout.
