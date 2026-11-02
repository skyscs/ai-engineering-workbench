# ADR 0050 — Preserve connected-path provenance before adding consumers

## Status

Design accepted for the next offline task by Task 070, 2026-11-02. No production
consumer, database or model change is implemented here.

## Decision

Keep the connected browser separate from existing answer/candidate/review adapters.
Qualify a bounded immutable path receipt offline before designing persistent consumers.
The receipt preserves the exact projection, all original support, scope dependencies,
parser/adapter identity and limitations. It is recorded static context, not a complete
system model or a runtime verification. See the [consumer contract](../loredock/CONNECTED_PATH_CONSUMERS.md).

Historical readability must not depend on disposable inventories. Current applicability
is a separate derivation/qualification and never an implicit rewrite of saved content.
Revocation, policy changes, missing/corrupt originals and unsupported formats remain
explicit boundaries. A server-issued receipt hash does not authorize external imports.

Do not use two default browser paths as a question-relevance/routing policy. Keep source
retrieval and primary candidates unchanged in the first context-admission comparison.
New answers require versioned bounded context, complete issued original support, pinned
publication validation and fresh semantic qualification. New engineer notes require a
new target namespace and completeness-aware witnesses; legacy notes never migrate by ID
or label. Autonomous routing/Workbench still depends on L5 acceptance.

## Alternatives rejected

- Replace `codeFlows` globally: changes in-flight validation, review targets and old
  adapter assumptions while hiding asynchronous inventory availability.
- Store only inventory/generation IDs: ordinary fact eviction makes history unreadable.
- Save a graph without originals/dependencies: loses complete support and can bypass
  scope revocation, including sources that constrain unseen alternatives.
- Feed the browser response to the model: exceeds existing context bounds and mistakes
  display selection for question relevance.
- Reapply notes on equal labels/cited lines: alternatives or completeness can change
  without changing those lines; aggregate coverage cannot prove semantic equivalence.

## Consequences

The immediate successor is a fresh model-free receipt/lifecycle experiment with frozen
inputs, oracles, limits and first-run evidence. It writes only owned experiment artifacts.
Production storage, question selection, answer semantics, review reapplication and routing
remain separate reviewable tasks. No old failed gate or exhausted model budget is reopened.
