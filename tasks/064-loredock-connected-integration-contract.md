# Task 064 — Connected path integration contract

Status: design completed, 2026-11-02; scope `9bc373c` preceded analysis.

Task 063 qualifies an offline connected-path policy. Specify the smallest useful route
from that candidate to the existing application without silently replacing saved-answer,
correction/reapplication or related-source semantics. This task is design only.

## Scope

- Trace current CodeAnalysis ownership/lifecycle, protected read APIs, graph/review consumers
  and UI source/index/policy fences. Identify a simple place to browse new paths and omitted
  roots without another configuration form or implicit model use.
- Define separate versioned projection identity, root navigation, coverage/unavailable and
  historical behavior. Keep original spans as citation authority; do not persist derived
  facts as authoritative source or make saved history depend on evictable inventories.
- Address production scale before UI adoption: the experiment covers 221 files under a
  600-file prototype bound, while existing inventories admit up to 10,000 files. Specify
  prospective resource and full-universe qualification, bounded indexed matching and
  explicit failure semantics; do not merely raise constants or claim measured scale.
- Record a concrete phased implementation sequence and acceptance/rejection criteria,
  including request races, missing roots, parser gaps, backwards compatibility and integrity.
  Preserve all frozen measurements, failures, budgets and the user demo. No product code,
  schema/UI/API implementation, experiment rerun, model call or corporate source access.

## Delivery

Commit scope before analysis. Add an English integration design linked from roadmap/status,
verify local code/document references and review the complete diff. No redundant local
runtime/browser run for prose-only changes. Publish a separate PR after the preceding
qualification merges, verify both exact-head CI events, merge and synchronize source.

## Outcome

Added [the integration contract](../docs/loredock/CONNECTED_PATH_INTEGRATION.md), covering
single analysis ownership, disposable inventory/history behavior, current consumer coupling,
generation/root identity, protected bounded reads, simple root browsing and pending-original
fences. Full wire envelopes include metadata/support in the bound; offline diagnostic
vectors cannot leak into the proposed API. Read-side analysis, implicit adapter migration,
automatic retries and partial-universe uniqueness remain excluded.

The next phase freezes a fresh prospective scale/work contract before implementing an
indexed cooperative resolver. Typed backend and browser integration follow only qualified
results; broader answer/review adoption requires a separate proposal and acceptance.
Roadmap/status links updated. Source/document references and the complete diff reviewed;
application code, measurements, model budgets and owner demo remain unchanged.
