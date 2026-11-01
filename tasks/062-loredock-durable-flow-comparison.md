# Task 062 — Offline durable-fact flow comparison

Status: implemented and locally verified, 2026-11-01; wider promotion rejected.
Scope `b368729`; inputs `759cb04`; prototype `ca93fb7`; measured correction `786fb82`.

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

## Recorded outcome

All 21 variants of F01–F09 are recorded in [verification](../docs/fixtures/loredock-durable-flows/README.md).
Six main parity vectors and the partial syntax graph agree with production. The 365-file
wider read retains seven critical facts but admits only three required nodes under the
160-node cap, with 211 node omissions. Naive wider selection is rejected.

The original failed citation harness and corrected raw 306/313 result remain available.
Six raw object-equality failures are explained by parser dictionary prototypes; serialized
vectors match without another measurement run. The dense-case 200-function expectation
missed the existing 100-symbol parser cap and remains unqualified. No oracle is rewritten.
All 73 measured projections are read-only; 1,557 original span occurrences reopen exactly.
Scope changes, corruption, partial availability, restart/history and eviction behave as specified.

Strict full checks passed 447 tests/builds; the subsequent comparison regression passes
with the three focused checks and strict LoreDock types (448 total tests). No UI/product,
model, corporate-source or user-demo change. Support-aware admission needs a fresh prospective
contract that separates ambiguity resolution from displayed graph slots.
