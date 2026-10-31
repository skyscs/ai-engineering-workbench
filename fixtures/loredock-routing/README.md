# Twenty-source incident-context baseline

Task 035 freezes ten new incident descriptions on the existing small
[twenty-source corpus](../loredock-scale/README.md). The original three-source routing
cases, all source bytes, prior question sets and real-model evaluations remain unchanged.
New scenarios and candidate bounds are authored before their retrieval measurement;
the underlying sources have already been inspected. This is not a blind benchmark.

`cases.mjs` is a reviewer-only contract: critical repositories, per-case candidate
bounds, reference evidence and missing-input decisions. The generator's original oracle
and this contract stay outside source roots. The evaluator passes only each incident's
description to production retrieval and the keyword baseline.

The comparison uses unchanged answer retrieval and a plain keyword OR baseline with
the same `questionTerms` tokenizer, FTS index, stable tie order, 120 candidates,
30 spans and 64 KiB. The latter has no reference expansion, named-source sampling,
README reservation or fallback. This is an explicit keyword benchmark, not the UI's
all-terms search query. Neither method is a production repository router.

For each method, distinct owners of original passages form a diagnostic candidate set.
The report keeps critical repository recall, candidate count, reference availability
and explicit decision availability separate. A full reference miss is diagnostic;
equivalent evidence needs semantic review before declaring a question unanswerable.
An expected missing-source gap is never counted as an actual product abstention.

All critical repositories plus the useful case-specific candidate bound are necessary
conditions only. Actual routing/abstention behavior and independent review are required
before a routing or L5 acceptance claim. Nothing here chooses repositories to modify,
establishes a root cause or authorizes the Workbench bridge.

Regenerate the model-free measurement after building the repository:

```sh
node scripts/loredock-incident-context.mjs
```

The evaluator creates and deletes only owned synthetic repositories and verifies
their normal checkouts remain unchanged. It runs two fresh generations with zero model
calls or answer attempts. Timings and retained bytes describe this tiny local corpus,
not production ceilings. The source/contract freeze is recorded in `baseline.json`.
