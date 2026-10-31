# Task 038 — Qualify structural-subject candidate links

Status: implemented and locally verified; proposal remains offline.
Follows merged PR #41 (`f3f10c5`). The owner authorized continuing the sequence using
synthetic inputs, with no corporate code or renewed model dispatch.

Implement only an offline qualification of the proposed admission policy in
[the frozen design](../fixtures/loredock-link-precision/DESIGN.md). Keep production
Task 037 v1 and every retained context, lexical, relationship and answer report unchanged.

The evaluator must reconstruct all bounded candidate relationships from authorized
projections and prove that applying production v1 yields the actual v1 output. Compare
the proposal against the same observed ten incidents in two fresh generations, validating
original Git provenance. Report lost and gained sources, counts, critical recall,
unchanged context/lexical selections and the lack of automatic routing decisions.
Test the sixteen fresh normalized subject cases separately; do not call them blind or
end-to-end semantic acceptance. Preserve every failure without adjusting the frozen rule.

Run full checks, update the current status and roadmap with the outcome and the smallest
justified next task, and merge after both exact-head CI runs pass. No application/API/UI,
parser, database, prompt or runtime behavior changes belong to this qualification.

## Outcome

Frozen in `6e1f177`. All sixteen subject mechanics examples pass. The proposal reduces
observed union sizes to 1–4, meets all ten size bounds and eight combined scope conditions,
but loses ir02's order-worker and retains the ir06 inventory-api omission. Recall falls
from 21/22 to 20/22. Both generations agree; 200 original occurrences and all retained
context/lexical/v1 selections are verified. Full checks pass with 351 tests.

Production v1 is retained. Next: freeze and implement the bounded literal AMD object
export profile for `dojo/request`, with binding/ambiguity guards and adapter versioning.
See [qualification evidence](../docs/fixtures/loredock-link-precision/README.md).
