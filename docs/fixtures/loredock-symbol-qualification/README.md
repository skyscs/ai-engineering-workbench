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

Full measurement is pending the reviewed harness commit and local checks. The exclusive
ignored `.loredock-evaluations/task048-symbols.json` receipt prevents a second full attempt.
Do not delete it to rerun. A failed stage or query remains recorded; no hidden retries,
refresh, parser changes or threshold changes are permitted by this protocol.

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
