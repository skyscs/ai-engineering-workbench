# Task 054 — Matched rebuild control and complete literal vocabulary

Status: implemented and locally verified, 2026-11-01. Design/pins: `018763a`/`d6bfcb1`.

Task 053's isolated candidate passes mechanical checks and reduces compacted total size
17.8%, but conversion also rebuilds FTS postings. Separate that effect before selecting
a production schema change. This follow-up leaves all earlier measurements intact.

## Contract

- Freeze a new independent comparison before implementation/measurement. Prepare one owned
  twenty-source fixture with five added files per source, two unchanged index generations
  and one code inventory. Clone its stopped schema-8 catalog into three identical variants:
  unchanged baseline, built-in literal FTS rebuild only, and the frozen external-content
  prototype. Leave question search, tokenizer, source content and all non-literal records
  unchanged. VACUUM every variant equally before measurement.
- Compare every literal token occurrence including document rowid, column and position;
  document-size rows, total-token/document statistics and rowid/span/content identities;
  exact non-literal table digests; and all fourteen frozen Task 053 queries on both retained
  generations. Include ordered results, ranks, snippets and full answer contexts. Repeat
  after closing/reopening all variants. No independent new generation IDs need normalization.
- Retain raw vectors, query outputs, per-object page allocation, implementation/runtime
  identity and an exclusive fixed-attempt receipt. Recompute the decision from those raw
  records. Do not perform source writes, model calls, historical evaluation reruns or
  automatic retries. CI uses separate three-source rehearsals and adversarial assessor tests.
- Require complete exact equivalence, at least 10% lower literal-search-plus-mapping
  allocation and at least 5% lower total compacted allocation relative to the rebuild-only
  control to justify migration hardening. Otherwise prefer investigating the simpler
  approach or retain the blocker. Size/latency are observations on this shape, not scale
  acceptance or a retained-history quota.

## Delivery

Keep the implementation in isolated experiment scripts/tests with no user-data argument,
production schema/API/UI change or daemon restart. Run strict checks, full tests/builds
and one committed fixed comparison; retain raw results and the decision. Review/create
the PR, merge after both exact-head CI events pass and continue according to the decision.
The user demo, manual feedback and independent semantic acceptance remain separate.

## Outcome

Committed run `ff08c04` passes 112/112 exact query comparisons and 31/31 structural,
completeness and restart checks. All 17,164 token instances and 358 document identities
agree. Rebuilding alone saves 28,672 bytes; external content saves a further 778,240 bytes
(17.4%) against that control. Per-object sizes attribute the difference to the removed
823,296-byte text copy, less mapping and experiment-marker overhead. Full raw vectors and
an independent recount are retained in the [report](../docs/fixtures/loredock-search-control/README.md).

Strict checks, 413 tests and builds pass. Production remains unchanged. The matched gate
supports a separate schema migration/write/purge hardening task, including atomic failure,
legacy row/configuration preservation and maintenance/report compatibility. No model,
corporate input, historical rerun or user-demo mutation.
