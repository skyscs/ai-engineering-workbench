# Shared search statistics and historical deletion

Task 056 mechanism probe, 2026-11-01. Scope `2b29883`; committed probe `47a3e9c`.
Node 22.23.2 / SQLite 3.51.3. [Retained raw scores/tokens and provenance](result.json).

The fixed in-memory database has two current documents: A contains two `alpha` and
eighteen `filler` tokens; B contains `alpha filler`. Ten historical documents each contain
two hundred `legacy` tokens. The query joins document metadata and explicitly filters
to the current build. Only historical documents are removed inside this disposable
database; current text hashes and all current token positions are compared exactly.

| Observation | Before | After historical removal |
| --- | --- | --- |
| FTS documents | 12 | 2 |
| Token instances | 2,022 | 22 |
| Current matching set | A, B | A, B |
| Ordered current matches, external literal FTS | A, B | B, A |
| Ordered current matches, Porter FTS | A, B | B, A |

Both integrity checks and FK validation pass. Current text and token vectors are
unchanged. The literal and Porter layouts give the same observed flip; the probe does
not run production path expansion, source balancing, budgets or answer selection, so
it does not claim an end-to-end answer change or frequency of this problem.
An independent Python recount verifies the current text hashes/token vectors and computes
both ranked score pairs from the BM25 formula and the fixed document lengths/frequencies.

The explanation is the [whole-table BM25 statistics](https://www.sqlite.org/fts5.html#the_bm25_function).
A build filter restricts returned rows but does not make those statistics build-local.
Therefore a future history collector cannot promise current ranking preservation from
reference checks alone. Saved contexts must remain immutable and retrieval changes need
separate qualification. See the [retention design](../../loredock/RETENTION_DESIGN.md).

Reproduce the mechanism with the documented Node toolchain:

```bash
node scripts/loredock-retention-ranking-probe.mjs
```

The script accepts no arguments, opens only an in-memory SQLite database and prints JSON.
Its assertions fix both expected orderings, document/token counts, unchanged current
identities and index integrity. This is not a product cleanup command, new model run,
historical benchmark rerun or permission to remove user data. The retained result stays
unchanged when checking the script separately.
