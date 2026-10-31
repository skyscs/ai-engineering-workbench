# Task 044 — Complete synthetic code-fact inventory feasibility

Status: contract scoped before implementation and measurement.
Follows merged PR #47 (`803ba3c`) after both exact-head CI events succeeded.

Implement only the offline experiment in the
[fixed protocol](../fixtures/loredock-code-inventory/DESIGN.md). Freeze parser/dependency
hashes and the prior corpus fingerprint first. Use one new full volume fixture and one
initial default production index; no resume, retry or refresh. On publication, record
the default projections and perform two fixed bounded passes over all indexed code-file
candidates using current parsers and complete original evidence validation.

Keep every omitted/failed/unattempted file explicit. Verify source/Git/range/hash provenance,
fact determinism, exact-symbol probes and agreement with default projection symbols.
Record same-source handler syntax availability separately from any runtime/binding claim.
Measure parser, source-validation and Git overhead separately, with evaluator-only RSS.

Use a small owned shape and meaningful bounds/provenance checks in ordinary CI. The full
experiment stays explicit. Preserve all earlier reports; do not tune parsers or change
production schemas, limits, prompts or graph semantics in this task. No corporate code
or model request. Let measured costs/coverage determine the next persistent-analysis slice,
including authorization/purge, versioning, interruption, reuse and retention contracts.

Run required checks, review, publish the PR and merge only after push/pull-request CI pass
for the exact head. Continue the authorized sequence immediately after merge.
