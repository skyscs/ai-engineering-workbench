# Larger exact-symbol qualification

Task 048, 2026-11-01. The original design/cases/baseline were committed in `13c907e`
after PR #51 reached main as `9b0a118`. The [frozen protocol](../../../fixtures/loredock-symbol-search/DESIGN.md)
uses one unchanged 3,679-file synthetic generation, one index, one durable analysis and
two passes of nine literal queries. No corporate source, model call or production change.

The [first small smoke](pre-amendment-smoke.json) exposed an oracle error before any
full-size generation: s05 expected three Java method names without their source packages.
The application returned all four correct source/file owners and qualified names.
The original oracle therefore passes 16/18 occurrences. It remains immutable.

The [prospective amendment](../../../fixtures/loredock-symbol-search/ERRATA.md), committed
in `6caaaa7`, corrects only those three literal expected names. Queries, owners, limits,
attempt budget and timing target remain unchanged. The evaluator records original and
amended assessments separately, and recomputes aggregate checks from raw responses.
The [amended small smoke](smoke-result.json) passes 18/18 under that separately labeled
oracle, while retaining the original 16/18 result. It checks all 121 retained files per
query and verifies eighteen original-span occurrences in seven distinct files.

The single full measurement used committed harness `1ab42d7c014d56feda9bc9079916cb37d33148ff`
after strict types, all 391 tests and production builds passed. Five new pure tests check
frozen inputs/amendment, one-attempt stage gating, raw-response reassessment and repeat
identity/coverage comparisons. The [raw result](raw-result.json) and [derived summary](summary.json)
retain both judgments. Raw SHA-256 is
`1c8c8ae3fbf47c02691903d11440dcd510c06d49afa983eeef19955f3a9ac29b`
(134,505 bytes). Both summaries were recounted from the retained raw responses.

All 3,679 eligible files / 7,389,669 bytes were indexed in 64.422 seconds, with sixty
known exclusions and no failures. Durable analysis took 4.342 seconds and retained all
3,621 candidates, 7,378,135 examined source bytes and 4,389,516 fact/provenance payload
bytes. Six files have seven syntax-gap messages; those files remain marked examined,
not fully understood. The inventory therefore publishes with partial coverage.

Every lookup scanned all 3,621 retained files with no time/output omission. All eighteen
original-span occurrences across seven files were independently checked against Git.
Expected sets pass 18/18 under the prospective amended oracle; the unchanged original
oracle remains 16/18 solely because of s05's three missing package prefixes. No other
expected source/file/symbol was missing or added. Repeat normalized results are identical.
The qualified `Orders.accept` method is outside the unchanged graph's 100-file sample.

| Query | Matches | Pass 1 (ms) | Pass 2 (ms) | Response bytes |
| --- | ---: | ---: | ---: | ---: |
| loadProbe000179 | 1 | 865.328 | 812.424 | 1,698 |
| loadProbe100179 | 1 | 829.528 | 809.223 | 1,712 |
| loadProbe190179 | 1 | 839.523 | 822.381 | 1,712 |
| Orders.accept | 1 | 819.975 | 803.770 | 1,709 |
| accept | 4 | 825.388 | 812.414 | 4,249 |
| Orders | 1 | 816.313 | 810.075 | 1,702 |
| OrderBadge | 0 | 817.962 | 810.401 | 882 |
| loadprobe190179 | 0 | 821.819 | 838.350 | 887 |
| nonexistentSyntheticSymbol048 | 0 | 813.408 | 818.160 | 901 |

Median lookup time is 818.061 ms and maximum 865.328 ms, below the separately frozen
5,500 ms local target. Sampled peak shared-process RSS is 228,364,288 bytes (about 218 MiB),
including fixture/index allocations. Source checkouts remain unchanged; answer attempts
and model requests are zero. There was one index and one durable analysis, with no refresh,
resume, retry, parser change or production tuning. The ignored exclusive
`.loredock-evaluations/task048-symbols.json` receipt remains consumed; do not delete it.

Reproduction at the measurement commit, with the documented Node/pnpm build and a fresh
output directory:

```sh
node scripts/loredock-symbol-search-qualification.mjs /tmp/loredock-symbol-smoke --smoke
node scripts/loredock-symbol-search-qualification.mjs /tmp/loredock-symbol-qualification
```

The second command is the one full attempt, not a routine test. It requires a clean
committed checkout and unchanged frozen product/input hashes. A later product revision
must use the historical measurement checkout for reproduction; ordinary CI verifies the
immutable inputs and pure protocol/comparison behavior without running the full workload.
Timing covers only the production lookup call; independent Git/original verification is
outside that interval. Sampled memory is shared evaluator RSS, not isolated query memory.
The second pass is warm-process/filesystem behavior, not a parser/query cache claim.

This mechanical known-source evaluation does not establish independent semantic acceptance,
private-project performance, runtime relationships or a production latency commitment.
The next small query improvement is support for familiar short Java class/method names
while retaining complete qualified identities and every ambiguous source match. Broader
retrieval remains separate; no production limit is widened by this measurement.
