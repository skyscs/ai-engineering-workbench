# Prospective qualification amendment: Java package names

2026-11-01, after the first small-shape harness smoke and before any full-size Task 048
generation or query. The initial frozen design/cases/baseline in `13c907e` remain unchanged.

Case s05 correctly expects four source/file owners for `accept`, but three expected symbol
labels omit the package present in the unchanged Java originals. The parser's qualified
name includes that package. The smoke returns all four correct owners and original ranges,
yet the original exact-set comparison passes only 16/18 query occurrences. This is an
oracle naming error, not a product defect, timing miss or missing source.

The prospective amendment adds exactly these literal names:

| Source / original | Original expected name | Correct qualified name |
| --- | --- | --- |
| inventory-worker / src/StockProjection.java | StockProjection.accept | synthetic.stock.StockProjection.accept |
| shipping-worker / src/Shipments.java | Shipments.accept | synthetic.shipping.Shipments.accept |
| notification-worker / src/Notify.java | Notify.accept | synthetic.notifications.Notify.accept |

The separate machine-readable correction and its hash are committed before the full run.
Queries, source files, expected owners, all other names, limits, attempt budget and timing
target are unchanged. The harness retains both original and amended exact-set assessments
in the single full measurement. The original frozen gate remains failed if s05 returns
the qualified names; the amended result is labeled separately, not a replacement score.
No package stripping or fuzzy comparison is introduced into the product or evaluator.

The first smoke is retained as `pre-amendment-smoke.json` in the later verification report.
The corrected smoke may validate the amended harness before measurement. Neither is a
full-volume attempt. No full-volume generation, production tuning or model call preceded
this amendment. Independent semantic acceptance remains outside both assessments.
