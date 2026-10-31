# ADR 0031 — Expanded answer evaluation preserves negative results

Date: 2026-10-31. Status: implemented; expanded semantic acceptance is blocked.

## Context

Task 026 established 20/20 evidence recall across twenty synthetic repositories.
Recall and valid citation IDs do not show that an answer covers required limitations
or respects engineer-review boundaries. Earlier three-source quality scores cannot
be reused for this expanded scope.

## Decision

Run an explicit, bounded evaluation through the production catalog, corrections,
answers and qualified personal CLI connection. Freeze twenty questions and four
review cases before dispatch. Save exact prompts, originals, raw output, usage and
immutable attempts. Keep expected answers outside retrieval/model inputs.

Allow at most 24 attempts per run, 120 seconds each, one active invocation, no automatic
retries, and one further complete run only after an evidenced bounded fix. Prompt v8
clarifies declaration/contract/port boundaries, complete documented limitations and
unsupported tentative reliability claims. It preserves model, reasoning effort,
runtime privileges, retrieval, schema and saved historical output.

Both complete runs and every claim assessment remain reviewable. The second run
scores 18/20 with 4/4 review cases, but the zero-missing-uncertainty gate still fails.
Do not assemble a passing set across runs or turn agent review/CI/merge into independent
semantic acceptance. Further paid iterations require a new bounded task and budget;
this task does not authorize indefinite prompt tuning.

## Consequences

Offline reconstruction verifies every issued original span against regenerated Git
bytes and checks complete assessment coverage; it does not judge semantics. Fake
runtime tests and browser regression verify withdrawal, history, replay, revocation
and failure boundaries without paid model calls. Atomic evaluator checkpoints retain
dispatched attempt identity even before a response exists.

The product remains opt-in. Expanded qualification is blocked by answer completeness;
framework coverage, retention, independent review and the private pilot remain open.
See the [complete evidence and next step](../fixtures/loredock-scale-answer-quality/README.md).
