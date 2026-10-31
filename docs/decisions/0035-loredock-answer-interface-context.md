# ADR 0035 — Source-backed interface comparisons in answer context

Status: accepted for Task 032 implementation, 2026-10-31.

## Context

Task 031 exposes literal HTTP header differences in the map, but answer generation does
not consume that analysis. Task 030's extra unsupported propagation claim remains a
failed semantic result. Repeatedly tuning its observed answers would not supply an
independent qualification. This slice implements a bounded context capability and uses
zero real-model calls; it does not rescore any historical output.

## Decision

Add optional `AnswerContext.interfaces`, versioned `answer-interfaces-v1`, with explicit
static-analysis/unverified provenance and both adapter identities. Only `http-target`
candidates with a header comparison and **every supporting evidence ID already in the
retrieved source spans** are eligible. Do not admit a one-sided clue, expand retrieval,
replace original text, or treat a derived relationship as another source citation.

Use stable graph order, at most six complete comparisons and 8 KiB of their UTF-8 JSON.
Expose matching, omitted, incomplete-support and unrelated counts, graph/declaration
omissions and bounded-coverage limitations. This reuses the graph's existing document,
text, syntax, comparison, node and output limits. Unknowns and matches retain candidate
status; neither matching names nor a missing literal mapping proves runtime values,
deployment, middleware/proxy rewriting, conversion or identity enforcement.

Extract the existing pure prompt renderer to `answer-prompt.ts` and advance to prompt
**v9**, with the new block labeled separately from original spans and engineer review.
The answer schema still permits only original span IDs. Explain that derived labels and
IDs have no independent citation authority, and that missing analysis does not prove
absence. Retain retrieval v7 because ranking, selection and source budgets are unchanged.
The separately versioned block participates in the existing complete-context hash.

Use the same renderer to enforce the existing **96 KiB complete prompt cap** in preview.
Omit whole comparisons from the tail until the prompt fits; never discard source spans
or engineer notes to make room. If even the base context is too large, reject before
runtime setup and ask for a narrower question/scope. Application prompt bytes do not
measure provider traffic, CLI overhead, tokens or cost.

Before publication, validate original spans as before, then recompute the eligible
comparisons and exact budget selection. Reject changed/rehashed comparisons, versions,
adapter provenance, endpoint identity or evidence ownership. The complete reviewed block
is stored with the immutable answer input; it is not regenerated when reading history.
Existing answer dependencies already cover every authorized index source, including all
comparison support. Source revocation/policy changes therefore fence and purge the new
block without another table or schema migration. Review-revision fences stay intact.

The UI shows **Interface comparisons in this context** in both preview and saved answer,
separately from source passages and engineer notes. It opens for missing mappings and
offers the original source buttons. Older contexts omit the optional block and receive
an explanatory label; do not backfill their JSON or claim new knowledge was supplied.

## Qualification and historical evaluation

An independent dispatch/site mismatch was added before implementation and failed against
the old prompt. New tests cover complete-support admission, all three states, count/UTF-8/
complete-prompt bounds, rehashed tampering, derived citation rejection, restart/replay and
revocation. Existing legacy answer and boundary tests remain in place. Browser checks
use a fake runtime, synthetic sources and original citations; no real model is invoked.
See [evidence](../fixtures/loredock-answer-interfaces/README.md).

The frozen Task 030 v8 contract cannot dispatch with v9 production services. A dedicated
test checks both version drift and the original frozen file hashes before runtime
preparation. The old runner's checkpoint/failure tests retain an explicitly injected
fixture protocol label to exercise orchestration only; they do not qualify production
as v8 or produce new semantic scores. Its runner, contract, raw outputs and review remain
unchanged. Historical offline audits continue to use their retained originals.

Next, freeze a new independent prospective design covering name correspondence, missing
wiring, dynamic inputs and earlier completeness/conflict risks. Any real-model run needs
its own fixed implementation/input contract and budget. Neither transport checks nor
unchanged retrieval recall establish improved answer correctness or L5 readiness.
