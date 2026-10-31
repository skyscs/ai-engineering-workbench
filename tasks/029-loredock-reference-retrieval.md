# Task 029 — Bounded literal-reference expansion and candidate admission

Status: implemented and locally verified, 2026-10-31. Follows Task 028 / merged PR #32.

## Scope and acceptance

1. Preserve the frozen twenty-source corpus/oracle, prospective cases and all previous
   results. Before tuning, add an independent quoted handler-reference example with a
   single-word type name and identifier distractors. It must not require a repository
   name or answer hint in the question.
2. Improve generic identifier expansion within the same six seed passages / 64 KiB
   inspected-text bound and twelve expansion terms. Consider query affinity, source
   opportunity and quoted qualified member references. No fixture names, oracle input,
   source execution, semantic relation claims or additional model calls.
3. Preserve direct lexical candidate opportunity when admitting expansion results.
   Keep 120 candidate reads, thirty spans / 64 KiB text / 96 KiB prompt, metadata-first
   byte checks, named-source sampling, zero-hit orientation and stable source ordering.
4. Version the changed retrieval contract; preserve old context/result bytes, replay,
   review/source/policy fences, schema, prompt v8 and runtime settings. Avoid UI changes
   or new user configuration unless evidence demonstrates a need.
5. Measure the original twenty-source questions, all twenty-four prospective wordings,
   and the original three-source oracle. Target complete recorded-reference recall
   without regressions; disclose equivalent evidence and never label recall as semantic
   answer acceptance. Recheck fresh-identity stability and bounded reads.
6. Add meaningful tests for qualified references, distractor/source fairness, bounded
   candidate admission, long identifier/byte bounds and affected history boundaries.
   Run full checks and the existing answer/preview browser regressions. Model budget: zero.
7. Publish before/after artifacts, bounds/tradeoffs and status. Review the diff and merge
   the PR only after both checks pass for its exact head under standing authorization.

Task 027's semantic gate and independent/private-pilot requirements remain open. Future
real-model evaluation is a separate bounded task; this retrieval change cannot inherit
the earlier answer scores or claim unseen/independent evaluation of Task 028's wordings.

## Outcome

Retrieval v7 reaches 24/24 prospective reference sets, 20/20 original expanded and 20/20
original pilot cases within the existing caps. Two fresh twenty-source generations retain
identical selected locators and no-hit orientation. The independent quoted-handler test
failed on v6 before tuning. Two admission variants regressed; the final two-direct/one-
expanded rule preserves direct-query opportunity and passes all three recall suites.

Full `pnpm check`: 314 tests, strict typechecks and builds pass. Existing Chrome answer
and expanded-preview regressions exercise fake runtimes only. No model/runtime changes,
new settings or source mutations. Prompt v8 and all historical outputs remain unchanged;
the expanded semantic gate is still failed. See
[ADR 0032](../docs/decisions/0032-loredock-literal-reference-retrieval.md) and
[complete measurements and development comparisons](../docs/fixtures/loredock-reference-retrieval/README.md).
