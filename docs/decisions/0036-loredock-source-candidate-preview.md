# ADR 0036 — Model-free source candidate preview

Status: accepted for the bounded preview; automatic routing and L5 acceptance remain open.
Date: 2026-10-31.

## Context

Task 035's keyword and answer-context owner unions recover all 22 required repository
occurrences but average 14.7 candidates and exceed every useful scenario bound. Original
answer context should remain broad: narrowing it to a heuristic shortlist could remove
evidence needed for a supported answer. The owner selected continued synthetic-only work
and autonomous iteration after verified merges.

## Decision

Add an independent, read-only `POST /api/candidates/preview` endpoint and a **Where should
I look?** panel available in the default model-free application. Only a question and
optional published build ID are accepted; callers cannot supply evidence, expected
repositories, ranking hints or model configuration.

Retrieve the existing bounded answer context unchanged, then rank its original text/path
matches by source. The [frozen design](../../fixtures/loredock-candidates/DESIGN.md) records
the general policy and eight adversarial cases before implementation. `source-candidates-v1`
uses distinct term weights, a 60% relative score threshold, six suggestions and three
supporting passages per source. Display names are not ranking evidence; duplicate names
keep separate original source identities. Other matches and ties at the cap stay visible.

The response is `source-candidate-preview-v1`, capped at 128 KiB, and includes source,
policy, registry, build and input/preview hashes. It preserves original citation IDs,
paths/ranges, saved revisions, coverage/gaps and separate unverified engineer notes.
Scores are lexical diagnostics, never probabilities. The UI explains matched terms
through original passages without exposing a numeric confidence claim.

No distinctive match produces an unresolved state. A nonempty result is a proposed
reading order requiring review, including negative source mentions; it is not a decision
that an implementation exists, a cause is established or a repository should be edited.
Generic coverage messages do not implement case-specific missing-repository abstention.
No preview is persisted as an approved investigation scope and no Workbench task is started.

Use the existing exact Host/Origin, session and CSRF boundary. Authorized historical
builds remain explicit snapshots; changed policies reject reads and revoked sources
are excluded before deriving suggestions. UI responses and evidence are fenced after
question, source, policy, index or review changes. No database migration, external service,
source execution, model invocation or new package dependency is introduced.

## Verification and limits

The frozen adversarial cases and ownership/frequency/API tests pass. The twenty-source
diagnostic produces 1–4 suggestions and meets all ten candidate-count bounds, but retains
only 18/22 critical repository occurrences: six of ten scenarios meet both necessary
scope conditions. The four missing primary candidates remain in **Other matches**.
Original answer selections and both Task 035 baseline summaries are unchanged.

The separate candidate browser smoke verifies original citations, keyboard focus,
escaped labels, 390 px layout, other matches, historical scope and delayed question,
review, revocation and policy responses. The existing bulk/orientation browser regression
also passes. Full check: 345 tests, strict types and builds; no real model calls.

This does not approve automatic routing or supersede the failed answer evaluations.
Next, investigate bounded relationship support for additional candidate context, with
new inputs/rules frozen before evaluation. Keep lexical suggestions separate from
supported relationships and retain unresolved/omitted evidence rather than tuning
case-specific repository lists.
