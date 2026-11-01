# Task 054 — Matched rebuild control and complete literal vocabulary

Status: in progress, 2026-11-01.

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
