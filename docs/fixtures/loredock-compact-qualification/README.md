# Complete compact-payload qualification evidence

Task 089's fresh observatory family is frozen at `81d926f`; the clean measured
entry point is `5ba54e8`, using compact implementation `68081c2`. PR #92 passed both
exact-head CI events and merged as identical-tree `2d99d83` before execution.

## Development verification

`development-validation.json` identifies the retained pinned logs. The first three
actual-process tests pass. Full checks then pass 550 tests, followed by 551 after
final review adds malformed-worker-result handling. Strict typechecks/builds pass.
Six process cases cover both complete lifecycles, independent resource rejection,
exit 7/missing preparation, cleanup failure with a valid initial copy, watchdog
termination and malformed stopped-worker JSON. No development attempt failed.
The frozen family is never imported by ordinary tests.

## One frozen execution

Twenty sources contain 9,880 files / 9,857 code files / 606,669 UTF-8 bytes / 21 facts.
Both children exit zero and close normally. The outer probe exits **1** after
409.952 seconds because five original resource gates fail. The preparer lifecycle
takes 325.194 seconds; the separately launched reader takes 84.468 seconds. No
profile, snapshot, manual GC, retry, larger bound or old-family execution occurs.

`frozen-validation.json` identifies all 39 raw metadata/report/receipt/process files
under `frozen-first/`, plus outer stdout/stderr/exit and derived readback. Each gzip
reproduces the original byte count/hash. Generated repositories and stopped/live-
then-closed databases remain at the recorded owned local output path. Both child
arms begin from the exact recorded initial-data hashes. `readback.json` copies
the original observations, lifecycle endpoints, summaries and parity results.

| Required result | Pass / required |
| --- | ---: |
| Child lifecycles | 2 / 2 |
| Artifact, shape and original-source support | 16 / 16 each |
| Applicable useful paths | 14 / 14 |
| Evicted history | 2 / 2 |
| Raw repeats within each arm | 6 / 6 |
| Exact typed paths, original spans and full source scope | 16 / 16 |
| Independent no-write/work/output/hook observations | 16 / 16 |
| Exact bytes across arms | 7 / 7 |
| Original resource gates | **11 / 16** |

Every default/selected chain reaches the supported candidate MongoDB write with
ten original spans. The isolated path retains its unresolved import and five
originals. All twenty sources remain dependencies. History performs no nested
path/fact/snapshot reads. No failed resource gate suppresses other dimensions.

| Operation | Preparer RSS MiB | Reopened RSS MiB | Preparer heap growth MiB | Reopened heap growth MiB |
| --- | ---: | ---: | ---: | ---: |
| first | 250.559 | 241.395 | 45.660 | 59.416 |
| repeat-1 | 320.652 | 290.594 | 47.168 | 43.286 |
| repeat-2 | 370.105 | 288.121 | 47.655 | 13.193 |
| repeat-3 | **399.895** | 292.117 | 32.761 | 15.785 |
| selected | **418.465** | 290.590 | 62.927 | 47.176 |
| page-4 | **402.945** | 339.539 | 56.520 | 36.556 |
| isolated | **418.730** | 319.457 | 58.353 | 10.818 |
| history | **433.902** | 357.125 | 2.182 | 2.327 |

Only RSS exceeds its 384 MiB limit. Every sampled heap growth stays below 64 MiB,
every capture/page takes under 3,310 ms, and all sampled intervals stay under 70 ms.
Both history reads take under 5 ms. Work/output/no-write gates pass independently.
The preparer passes 3/8 resource operations; the reopened arm passes 8/8. Overall
qualification **fails**, so neither streaming nor compaction is promoted.

The preparer's first-operation baseline is RSS 215.758 MiB / heap-used 43.013 MiB;
the reopened baseline is 149.332 / 34.251 MiB. By history, the preparer starts with
433.902 MiB RSS but only 42.525 MiB heap-used. These are process-lifecycle observations,
not a division of RSS into native/SQLite ownership. The fresh arm's complete pass
does not waive the required long-lived arm. Different older corpora and absent
matched baseline control prohibit a causal percentage memory-improvement claim.

## Next bounded action

Keep the failed result and investigate **request-local reuse of prepared read
statements** on independent tiny inputs. The unchanged store prepares on every
`one`/`all` call. `preparation-readback.json` verifies the original Task 079 archive
and copies 137,650 preparations across 28 SQL identities in its first large read;
it does not rerun or rescore that family. Task 080's allocation profile and Task
087's terminal observations support a transient-allocation hypothesis, while the
actual source of residual RSS remains unknown.

The pinned [Node SQLite contract](https://nodejs.org/download/release/v22.23.2/docs/api/sqlite.html#class-statementsync)
supports repeated execution of a prepared statement with new bound values. A future
candidate should retain a finite number of statements for one read only, execute
every query again with current bindings, preserve raw row shapes and all validation/
authorization/fence checks, and release scope references in `finally`. It must
bound count/SQL text, handle exceptions/reentrancy/close explicitly, and keep direct
iterators, writes, cross-request caching and forced collection outside that scope.
First prove fresh-value/byte/work/refusal equivalence; only then consider a separate
fresh complete qualification. This decision is not proof of SQLite retention, a
native-memory estimate, permission to reuse query results, or a resource pass.

The full source/fork/diff/link/hash review verifies unchanged measured code, five
frozen input files, all 406 baseline bytes and every retained archive/derived hash.
No production source, user demo, corporate code or model call is involved.
