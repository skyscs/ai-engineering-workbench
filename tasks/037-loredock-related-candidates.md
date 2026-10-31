# Task 037 — Original-evidence links beside source candidates

Status: implemented and locally verified. Follows merged PR #40 (`9a9aeb9`).
The owner authorized continuing the task sequence and selected synthetic-only work.

Implement [the frozen design](../fixtures/loredock-candidate-links/DESIGN.md) as a
separate bounded candidate-preview projection. Keep lexical selection and the broader
answer context unchanged. Retain graph coverage and original support on both sides;
show uncertainty and overlapping engineer notes without turning them into facts.

Acceptance:

- Freeze design/cases first; verify their hashes in tests and diagnostics.
- Cover one-hop anchoring, reverse edges, differences, no-hit behavior, identity,
  ordering/caps, original ownership, authorization, review overlap and policy fences.
- Compare two fresh synthetic generations and unchanged retained context/lexical
  baselines. Record recall/count tradeoffs without adjusting the frozen rules.
- Run full checks and a sequential owned browser smoke, including linked citations,
  escaping, keyboard/mobile access and late-response invalidation.
- Update user guidance, architecture, security and current status; review and merge
  after both exact-head CI events pass, then continue the authorized sequence.

No corporate input, model dispatch, auto-investigation or L5 acceptance is in scope.

## Outcome

The policy and eight cases were frozen in `4b8f987`. The optional UI section preserves
primary lexical suggestions and answer context; source/relationship evidence, scope
and engineer notes stay separate. Full checks pass with 349 tests, strict types and
builds. The candidate browser smoke passes all original and added linked-source checks.

Observed union recall rises to 21/22, but incidental setting comparisons widen lists
to 1–8 sources; only four cases meet both necessary conditions. No rule tuning follows.
Both fresh generations retain identical source/link support after normalizing symmetric
declaration sides, whose raw differences remain recorded. Next: separately qualify more
precise anchoring on fresh frozen examples before changing the v1 rule.

See [retained evidence](../docs/fixtures/loredock-candidate-links/README.md).
