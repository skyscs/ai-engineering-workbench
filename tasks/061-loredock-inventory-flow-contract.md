# Task 061 — Durable facts and wider flow projection contract

Status: analyzed and locally verified, 2026-11-01. Scope `7cc98d9` preceded analysis.

Task 060 extends document reading. The next whole-system context gap is that durable code
analysis examines the full admitted inventory, while code-flow/candidate projections still
parse a separate bounded sample. Before changing selection or claiming wider relationships,
audit their actual contracts and define a bounded next experiment.

## Scope

- Trace production code-flow inputs, selection/output/comparison/traversal limits and IDs;
  compare them with durable fact payloads, fingerprints, range/evidence validation, history,
  source/policy fencing, retention and asynchronous reader behavior.
- Identify which transformations can reuse facts exactly, which still need original source,
  and where wider file coverage changes selection, inferred links, correction targets,
  answer inputs or UI meaning. A larger inventory alone must not imply a complete graph.
- Document a recommended narrow integration path, explicit fallback/unavailable semantics,
  migration/version considerations and tradeoffs. Do not silently replace production
  sampling, increase budgets, invent runtime wiring or weaken original validation.
- Define an independent prospective synthetic experiment: small-parity inputs, added
  long-path critical declarations, dense early-source distraction, ambiguous bindings,
  missing/partial/stale/corrupt inventories and source/policy changes. Specify observed
  metrics and rejection conditions before implementation; no tuning on frozen results.
- This task is analysis/design only. No product or experiment implementation, model call,
  corporate source access, existing fixture mutation or consumed-budget rerun. Cite exact
  local code responsibilities so the proposed next task is reviewable and implementable.

## Delivery

Commit this scope before analysis. Record the contract in an English design document,
update roadmap/status and preserve the running demo/data/assets. Verify references and
consistency against the current source; no redundant application/browser rerun is required
for prose-only changes. Review and merge a separate PR after both exact-head CI events
pass. Broader semantic/private-pilot acceptance and the Workbench bridge remain gated.

## Recorded outcome

The [design](../docs/loredock/DURABLE_FLOW_DESIGN.md) traces the separate file and graph
limits, different ordering, full-original validation, parser identity and disposable fact
lifecycle. Wider admission affects correction/reapplication targets, related-source clues
and answer publication checks, so a production switch cannot be a local loop replacement.

The next bounded slice is an offline three-mode comparison: production control, exact
saved-fact parity and a deliberately naive wider diagnostic. Nine prospective scenarios
cover support displacement, ambiguity, availability, integrity, yielded scope changes,
history and eviction. Inputs/oracles must be frozen before running; a failed wider candidate
is retained as a result, not tuned into a passing claim. No experiment or product behavior
is implemented in this documentation task. Source/reference checks pass; existing runtime
verification and frozen evaluations are retained without a redundant local rerun.
