# Task 077 — Memory diagnostic rejected: process controls blocked

The first frozen diagnostic exits **1**: only **16 of 48 planned operations** execute.
All sixteen pass their independent integrity checks; ten meet resource bounds and six
exceed memory bounds. Four fresh-process arms stop at an observer assertion before reads,
leaving 32 operations unexecuted and all four cross-arm comparisons unavailable. This is
not a completed attribution study or a production qualification. There is no matrix rerun.

Scope `a38f7c3`, input/oracle/protocol freeze `8234749`, measured candidate/observer
`767a112289bfa650784ad6dcc17c520fd66aa478`. All data is newly authored synthetic input;
there are no corporate sources, model requests or user-demo changes. Task 075 stays rejected.

## Observer failure

The same-process preparer keeps `build_sources` rows returned by Node SQLite in memory.
Those row objects have a null prototype. Fresh readers load the identical metadata from
JSON, producing ordinary objects. The worker's `assert.deepEqual` compares prototypes as
well as field values and rejects this representational difference during opening validation.
The independent small regression verified reopened capture bytes but did not execute this
worker-level metadata serialization boundary in a fresh process.

Stopped catalog hashes match before opening. Subsequent
[read-only source-header inspection](source-header-readback.json) confirms every source
column/value matches the serialized metadata in all six closed arm catalogs. This localizes
the assertion error but does not retroactively run the blocked reads or establish parity.
Keep the candidate and oracle unchanged; correct the comparison in a separately scoped
successor and cover the complete three-process protocol before another fresh diagnostic.

## Retained same-process observations

Both same-process arms complete first capture, three repeats, explicit root selection,
the offset-four page, isolated capture and history after inventory eviction. Resource
failures do not skip their semantic checks: useful write-ending paths, exact originals,
all twenty dependencies, stable receipt bytes and zero nested historical work all pass.
The isolated result is a singleton path with no edges. Scope/original checks remain intact.

| Total paths / code files | Source/index preparation | Initial analysis | First capture | Shared work |
| --- | ---: | ---: | ---: | ---: |
| 640 / 617 | 9.446 s | 0.957 s | 205.32 ms | 94,338 |
| 9,920 / 9,897 | 213.915 s | 32.583 s | 3,439.93 ms | 372,844 |

Preparation includes owned repository creation and indexing; it is outside operation bounds.
Replacement analyses are recorded separately. These are not ingestion-speed claims for real
projects or evidence about omitted fresh-process behavior.

The large first capture grows sampled heap by 72.851 MiB. Its third repeat reaches
396.805 MiB RSS and 69.381 MiB heap growth. Selected, page and isolated reads reach
410.641, 389.773 and 389.973 MiB RSS. History starts after replacement analysis and reaches
424.934 MiB RSS. Bounds remain 64 MiB heap growth and 384 MiB process RSS; all six failures
remain failures. Maximum observed wall time is 3,450.205 ms and sampled interval 69.823 ms.

At the large facts checkpoint the reader holds 9,897 payloads/consumed identities for 21
meaningful facts. Resolution has fifteen nodes, thirteen edges and 9,900 evidence references;
the payloads and 9,920 metadata rows remain referenced before final validation. A default
capture prepares 137,105 SQL statements. These are container/call counts, not allocated or
retained-byte measurements. They cannot distinguish payload, snapshot, statement or async
allocation costs without the missing controls. **No optimization is selected from this run.**

## Retained evidence and verification

- [Execution identity](identity.json), [unaltered coordinator result](result.json),
  [readback summary](summary.json), first [stdout](execution.stdout), [stderr](execution.stderr)
  and [exit status](execution.exit).
- [Raw archive](raw.jsonl.gz): 54 frames preserving exact UTF-8 content, relative path,
  byte length and SHA-256 for all child reports, metadata, 28 raw returns/receipts and
  per-child stdout/stderr/exit records. Total uncompressed content: 910,906 bytes. Gzip hash:
  `81b6aa7bd56ca37cdc0f5402e0b8da16f7a485b79a994192b2f5cdfadab44121`.
- [First observer regression](observer-first.log.gz) retains a development syntax error;
  [first integration regression](integration-first.log.gz) retains the incorrect expectation
  that history would not reopen original evidence. The [final observer tests](observer-final.log.gz)
  and [final integration test](integration-final.log.gz) pass after those separate fixes.
- [Complete strict checks, 503 tests and builds](check-first.log.gz) pass. Ordinary tests
  never execute the frozen matrix. Its observer failure is not hidden by green CI.

Readback verifies raw hashes, accepted charge/query sums, frozen input/candidate/dependency
bytes and source-header values without executing a candidate again. Sampling is not a peak
guarantee; synchronous calls retain cooperative limits. Production source/API/UI/schema and
all earlier frozen results remain unchanged. Next: repair and test the whole diagnostic
transport/process boundary, then scope fresh attribution inputs before choosing an optimization.
