# Task 028 — Question-aligned completeness diagnosis and prospective cases

Status: implemented and locally verified; ready for PR/CI review. Follows Task 027 /
merged PR #31. Task 027's semantic gate remains failed.

## Scope and acceptance

1. Diagnose the retained v7/v8 omissions from exact saved inputs and cited originals.
   Separate missing retrieval, omitted requested content, necessary scope/uncertainty,
   optional background and unsupported claims. Review all twenty original questions
   for alignment, not only failed cases. Preserve historical files, scores and gates.
2. Define a prospective evaluator-only benchmark before measuring it: twelve intents,
   each with a development wording and a reserved wording, for twenty-four questions.
   Include narrow/contextual pairs for topic, route, projection and cursor behavior,
   plus production, identity, contract/publisher and migration controls. Record required
   propositions, necessary qualifications, optional context, forbidden assertions and
   original evidence for each intent. No automatic semantic scoring by keyword.
3. Pin the complete benchmark and original corpus hashes before the first retrieval
   measurement. Run the unchanged production retriever twice on fresh twenty-source
   fixtures, passing only question strings. Measure required-evidence alternatives,
   positions, omissions, stable locators and existing span/text/prompt limits. Retain
   misses; do not rewrite questions or product retrieval to manufacture a passing set.
4. Add offline tests for baseline/oracle separation, evidence resolution, semantic
   obligation boundaries and correct detection of missing/wrong evidence. Neither tests
   nor diagnostics may prepare a runtime or call a model. Real-model budget: zero.
5. Publish a readable rubric and diagnostic report with an actionable next task. The
   reserved questions are unseen by the answering model, but have been inspected for
   retrieval and were authored by the same agent after seeing earlier failures; they
   are not an independent blind corpus. Preserve that limitation in later evaluations.
6. Keep prompt v8, schema v3, retrieval v6, product behavior and the failed expanded
   semantic gate unchanged. Review/typecheck/test/build, create a PR and merge only
   after both CI runs pass for its exact head under standing authorization.

This task establishes a reviewable diagnostic foundation. It does not relabel Task 027
as passing, authorize another model run or establish private-pilot/L5 readiness. Any
subsequent model experiment requires a separate bounded task with frozen criteria,
budget and complete retained outputs, using the already selected personal connection.

## Outcome

All twenty original questions have an explicit alignment review. The frozen new
contract has twelve development and twelve reserved wordings over unchanged sources.
Both fresh-index measurements recover all recorded references for 22/24 questions;
h02 misses the shared StockReserved JSON contract and h04 misses Reservations.java.
The h02 handler record supplies equivalent message fields, so this reference miss is
not automatic semantic failure. Candidate-order diagnostics identify common-identifier
expansion and later lexical admission as the next bounded implementation target.

Full `pnpm check`: 310 tests, strict typechecks and builds. No model calls, runtime
configuration or product changes. All selected locators and requirement measurements
are stable across fresh source identities. Historical raw/semantic results remain
byte-identical. See the [alignment review](../docs/loredock/ANSWER_COMPLETENESS.md),
[rubric](../fixtures/loredock-completeness/RUBRIC.md) and
[recorded measurements](../docs/fixtures/loredock-completeness/README.md).
