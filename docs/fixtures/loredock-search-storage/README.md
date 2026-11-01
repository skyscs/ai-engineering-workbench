# External-content literal search feasibility

Task 053, 2026-11-01. Original contract: `84c05cb`, source/product pins: `c45affe`,
prospective support-order clarification: `4b9d1c5`. The single fixed measurement used
committed implementation `5b6489d107169b2616db44c6b7a570459161012a`, Node 22.23.2 and
SQLite 3.51.3. Production sources and schema 8 remain unchanged.

The [summary](summary.json) passes the frozen mechanical/storage gate. The
[complete compressed raw result](raw-result.json.gz) retains every query result, score,
context, identity mapping, lifecycle check and compiled implementation hash. Uncompressed
JSON SHA-256: `9aafdc93685fb0c46ff0db78fb140a678be4298945492dba29395147cc3ba757`.
The exclusive local attempt receipt remains in `.loredock-evaluations/`.

## Fixed comparison

One owned twenty-source fixture adds five synthetic code files per repository, for 179
eligible files. Two unchanged indexes and one 121-file code inventory are prepared before
copying the stopped catalog, so both variants start with identical source/citation IDs,
originals, a real engineer correction and a synthetic saved-answer row/context. The answer
row tests retention only; no model generated it or ran during this experiment.

The candidate replaces only literal search's stored text with an FTS5 external-content
view over original spans. An explicit integer-primary-key mapping preserves FTS rowids
through VACUUM. The experiment-only adapter changes literal insertion inside the existing
file transaction. Normal read, refresh and revocation code is reused. Question search,
raw bytes, original spans, code facts, application APIs and default storage are unchanged.

| Stage | Query pairs | Baseline allocated bytes | Candidate allocated bytes |
| --- | ---: | ---: | ---: |
| Converted and equally compacted | 28 | 4,526,080 | 3,719,168 |
| Reopened | 28 | 4,526,080 | 3,719,168 |
| Independently refreshed | 42 | 6,512,640 | 5,328,896 |
| Portal source revoked | 42 | 6,512,640 | 5,328,896 |
| Compacted and reopened | 42 | 5,935,104 | 4,812,800 |

All **182/182** ordered search/rank/snippet/context comparisons agree. Existing generations
are exact. New independently generated IDs are compared through generation, source, path,
revision, range and content identity; unranked interface-support sets are sorted by that
identity. Ranked results and context spans retain order. Original evidence and every copied
code payload agree; every non-literal-search table agrees after conversion. Both refreshes
reuse all 179 files. Revocation removes affected mappings/evidence and purges dependent
notes/answer context. Deep FTS consistency checks and source Git revision/cleanliness checks
pass. No corporate sources, source edits or frozen full-volume/model reruns were used.

At the frozen pre-purge checkpoint, literal-search-plus-mapping allocation falls from
958,464 to 147,456 bytes (**84.6%**); total compacted allocation falls by 806,912 bytes
(**17.8%**). Mapping/index/experiment-marker overhead is included. These are measured
physical page counts, not logical payload estimates or a cap on history growth.
Diagnostic literal-query median/max times are 0.296/0.650 ms for baseline and 0.281/0.673 ms
for candidate. They are neither a speed acceptance gate nor a production latency claim.

## Verification, clarification and next decision

Strict types, all **412 tests** and builds pass. Five new integration tests cover the
prototype lifecycle, Unicode/punctuation, empty conversion, transaction rollback,
interruption/restart, corrupt-input refusal, policy fences and the complete three-source
rehearsal. The assessor detects changed snippets, dropped support, missing lifecycle checks
and equal failures on both sides. A separate Python recount of the retained raw JSON agrees
on 182/182 and both space thresholds.

The initial rehearsal reported 173/182 because a derived comparison's support UUIDs
sorted differently in independently generated indexes. The
[original failure](rehearsal-before-clarification.json) remains recorded. The
[prospective clarification](../../../fixtures/loredock-search-storage/COMPARISON.md)
changes only semantic support-set ordering before the fixed measurement. It leaves the
original design/cases, query result order, thresholds and candidate untouched. A later
focused policy test used an unsupported trailing-slash prefix; its input was corrected
to the existing supported format before the fixed measurement.

**Do not promote the prototype yet.** The candidate conversion also rebuilds FTS postings,
whereas the baseline receives VACUUM only. Thus the observed storage difference includes
any segment-packing effect of rebuilding; it does not isolate text sharing alone. The
next bounded task should compare a rebuild-only control with the external-content variant
and verify the full token/position vocabulary before choosing migration work. This protects
against adopting a schema change when simpler maintenance could provide the same benefit.
Production adoption would still need migration failure/rollback, schema-version handling,
startup/write/purge integration and maintenance/report compatibility. Independent semantic
acceptance and the Workbench bridge remain gated; the user demo is unchanged and running.

The design follows [SQLite's external-content requirements](https://www.sqlite.org/fts5.html#external_content_tables):
the FTS index and originals must remain consistent, and deletion must still have access
to the original indexed text. The experiment retains that ordering and uses the documented
deep integrity check. All prototype code is confined to experiment scripts/tests.
