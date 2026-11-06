# Task 150 — Review the proposed resource boundary and choose a bounded implementation

Status: review, prospective adoption and local checks complete; exact-head CI pending.
Task 149 is accepted through PR #182, head `e88d751`, identical-tree merge `799c7a3`,
with both full CI logs passing 1,169 tests, ten typechecks and ten final builds.
[ADR 0068](../docs/decisions/0068-loredock-observable-resource-contract.md) adopts the
separate v2 contract after resolving delegation, accounting-mode, event-field and terminal
read-order ambiguities. [Task 151](151-loredock-memory-receipt-assessor.md) implements
offline assessment only. No executor qualification, resource experiment, host configuration
change, model call or retroactive acceptance occurs.
Local review verifies 818 document links, all 35 preserved numeric predicates, six
evidence/normative file hashes and both retained CI logs. The original draft, production,
frozen inputs/API and normal checkout are unchanged.

1. Review `loredock-observable-resources/2-draft1` against the original resource objective
   and all v1 numeric/nonnumeric requirements. Explicitly decide whether charged-memory
   envelopes, diagnostic-only heap/RSS, cache limitations and the outside attestor are
   acceptable. Retaining a number does not preserve its old metric semantics.
2. Check that the proposed hierarchy/executor can be scoped without weakening default
   security or installing a new privileged host service. Use read-only primary source
   and existing environment capability evidence; do not create cgroups, start containers,
   read unrelated host profiles, alter policy or infer delegation from Docker availability.
3. Record an explicit decision: adopt a bounded prospective contract for implementation,
   revise named issues, or reject the proposal. Separate design adoption from executor
   qualification, application performance, semantic acceptance and independent human review.
   Resolve every ambiguity that could turn missing evidence into a pass before adoption.
4. If the design is accepted, scope the smallest next task: a pure offline assessor and
   independent transcript tests, with no live resource run. Any executor feasibility probe
   needs its own fixed prerequisites/bounds later. If no feasible secure execution path can
   be justified, preserve `UNAVAILABLE` and scope useful independent functional work; do
   not restart undirected environment experiments or repeat design-only tasks without a
   concrete unresolved question.
5. Retain Task 149 accepted CI evidence, update roadmap/status, validate source links and
   frozen inputs, review the complete diff and both full exact-head CI logs before merge.
   Keep the user's normal checkout and all previously consumed families untouched.
