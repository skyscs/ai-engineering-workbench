# Complete ordinary lifetime bounds

The driver now records monotonic shutdown time from the stop request through actual
process close, whether the daemon had already exited, and each warm flow's duration
through saved history and observed runtime closure. The earlier HTTP-only elapsed value
remains separate. Source indexing also records one enclosing interval from the build
request through compatible automatic-analysis completion: analysis can start before the
driver receives its index-ready poll, so the later analysis-only poll interval is not
its complete lifetime.

The [independent assessor](../../../scripts/loredock-prepared-flow/lifetime-assess.mjs)
checks listen, index, preparation, whole controlled flow and shutdown limits. It uses
conservative enclosing intervals for automatic analysis and contained operation budgets.
An enclosing interval within a limit proves its contained durations are within that
limit. An enclosing interval above the limit is insufficient evidence about each
contained operation and remains incomplete; it is not reported as a measured individual
violation. Missing legacy boundaries and already-exited daemons cannot supply the new
measurements. Diagnostic elapsed time and per-budget instrumented wall time are never
used as resource measurements.

## Closure and containment review

This argument applies to the unchanged application and these normal sequential controls:

- [Question preparation](../../../apps/loredock/src/question-preparation.ts) constructs
  its budget after the real preparation request. Publishing Ready and closing that budget
  have no intervening await. A served Ready/review response therefore follows budget close.
- [Prepared execution](../../../apps/loredock/src/prepared-answer.ts) closes each of its
  three validation budgets in `finally`; runtime close occurs after all three phases.
  The driver's enclosing timer starts before Find and ends after both saved history and
  the controlled runtime's close observation.
- [Witness admission and reads](../../../apps/loredock/src/answer-witness-store.ts)
  close their owned budgets synchronously before their caller returns. The enclosing
  warm interval includes actual admission, terminal polling, saved-answer and list reads.
- [OperationBudget.close()](../../../apps/loredock/src/operation-budget.ts) records the
  endpoint without checking the deadline. Successful application status alone therefore
  cannot establish the five-second measured-duration gate.

One separate diagnostic replay of the first warm flow checks exact prompt/schema and
stored-witness parity, ten actual budgets with one close each, and no late, unscoped or
unclosed activity. This supports the source containment review for this known path;
instrumented times still provide no resource credit. Final executable/case provenance
must bind these boundaries before any reserved-family run. Other fault and history paths
do not acquire coverage from these three normal warm repetitions.

## Actual ordinary run

The [fixed entry](../../../scripts/loredock-prepared-flow/lifetime-bounds-development.mjs)
uses four ordinary synthetic sources and twelve files, one production cold flow, three
fixed controlled warm flows and one separate diagnostic replay. There are four controlled
responses, zero real models and zero reserved-family candidate reads.

| Observation | Measured |
| --- | --- |
| Cold listen | 340.495338 ms |
| Index | 1,027.274448 ms |
| Index through automatic analysis | 1,033.540004 ms |
| Cold preparation through review | 290.406368 ms |
| Warm complete scopes, including observed runtime close | 1,400.703523 / 1,367.517591 / 1,365.923308 ms |
| Cold / warm shutdown | 13.508858 / 13.362207 ms |
| Diagnostic actual aggregate work | 2,570,082 units across ten budgets |

All sixteen lifetime checks pass for this subset. The overall run still exits 1 because
raw daemon timer gaps are 317.842111 and 286.088359 ms against 100 ms. Those failures
remain recorded; the external owner reports no errors or surviving descendants.
No application limit or output was changed to obtain these timing observations.

## Retention and validation

[records.json](records.json) binds the raw run, source trees, complete catalog copies,
first/corrected test sources, independent retention helper and logs. Four copied catalogs
pass integrity and foreign-key checks; four clean Git identities and all 60 HTTP responses
are verified (57 exact bodies, three redacted sessions). The diagnostic request and stored
context/witness match the first warm flow exactly. All 191 raw entries remain unchanged.

Four new lifetime controls cover inclusive bounds, insufficient upper bounds, missing
legacy evidence, closure/parity and contradictory order. Three existing daemon controls
also pass. The first test incorrectly counted four missing checks: one absent duration
correctly leaves two separate limits unmeasured, yielding five. Its source/log remain;
only that test expectation changed, with no application rerun or assessor change.
Installation, builds and the original application/input seal pass. Both full final-head
CI events remain required before merge.

This does not complete all operation/work coverage, the ordered R01-R15 matrix or the
final executable/environment/output seal. Existing browser, list-work, source-usefulness
and timer failures remain failed. No parser/schema/default or user-demo change occurs;
whole resource qualification and model eligibility remain closed.

The preceding HTTP checkpoint is accepted through
[PR #155](https://github.com/skyscs/ai-engineering-workbench/pull/155): push 42057430191
and pull_request 42057782652 pass 1,004 tests at exact head
`d664b0ce09dc775f4d1438b43d4286eb1d29ce5e`; merge
`39713a906369f224f831817d64e17b892f65b584` has the identical tree. Both successful CI
results were verified before merge. The first local count check raced the still-running
PR-log download; complete log counts were verified after merge. Both full logs and this
ordering issue are retained here. Future log-count checks must await download completion.
