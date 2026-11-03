# Fresh memory attribution: complete controls, resource failures retained

Task 079's single frozen run completed on 2026-11-03 with exit 1. All 48/48
operations pass integrity and all four cross-arm comparisons are byte-identical.
Only 39/48 operations meet resource limits. All six workers exit 0; the coordinator
independently rejects nine memory observations. No optimization or production
promotion is selected, and Tasks 075/077 remain rejected and exhausted.

| Identity | Value |
| --- | --- |
| Scope | `e8848a0` |
| New input/protocol freeze | `3663114` |
| Measured candidate/coordinator | `23215ac8fe1092a44a0ae2036f9a804f7ad9622a` |
| Repaired runner merge | PR #82, `ab44345c28e2a15d0897526b1eb5645b4654b2de` |
| Exact reviewed runner head | `9c20301df5301c706e6d5569adf2cd6e2379a4df` |
| Runner CI | Push 41622014967; pull request 41622043041; both successful |
| Runtime | Node 22.23.2; hardware, arguments and baseline/input hashes in `identity.json` |
| Inputs | Twenty owned library-loan sources; 560/9,960 total files; 537/9,937 code files |
| Model requests | 0 |

Preparation uses identical stopped catalog copies, then all arms execute the same
eight operations. Every original/hash/range, typed path, source dependency, repeat
receipt, isolated singleton, offset-four page and evicted-history check passes.
No operation is blocked; history performs zero nested path/fact/snapshot work.
The small 560-file catalog passes all 24 resource observations.

## Large-catalog observations

| Arm | First baseline RSS, MiB | First heap growth, MiB | First time, ms | History RSS, MiB | Resource passes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Same process after preparation | 228.660 | 71.805 | 3,372.510 | 401.664 | 5/8 |
| Fresh reopened process | 165.055 | 68.332 | 3,382.953 | 399.539 | 5/8 |
| Fresh process without phase/query hooks | 164.957 | 67.954 | 3,490.086 | 406.535 | 5/8 |

The unchanged heap-growth limit is 64 MiB and process RSS limit is 384 MiB.
All three first captures exceed heap growth. Same/reopened isolated captures reach
65.108/65.607 MiB; control repeat-3 reaches 66.196 MiB. All three histories exceed
RSS after their replacement analyses, although their own heap growth is about
2.2 MiB. Maximum observed time is 3,490.086 ms and sampled interval 75.468 ms,
inside their unchanged 5,000/150 ms bounds. Complete violation records remain in
`result.json` and `summary.json`; failures are not replaced by successful repeats.

Preparation/indexing takes 209.04 s and initial analysis 32.18 s for the large
same-process arm. Each arm's two replacement analyses take about 30–33 s each;
their memory/timing is separately recorded and excluded from read intervals.

## What the controls establish

The first-capture heap failure survives a fresh process and removal of phase/query
hooks. Neither preparation residency nor those hooks alone explain it. Initial
RSS differs across lifecycles, but this single paired sample does not estimate
instrumentation overhead statistically or prove an allocation leak. History
inherits high residency after new analyses; its low local heap growth does not
waive its failed process RSS gate.

The large instrumented first captures retain 9,937 validated payloads/consumed
identities, 9,960 metadata rows and 9,940 resolution evidence references for 21
meaningful facts, 15 resolution nodes and ten admitted originals. Each prepares
137,650 SQL statements. These are ownership/call counts, not allocated-object bytes.

Same-process first-capture heap-used phase samples rise from 33.990 MiB at entry
to 50.720 after the initial snapshot, 79.546 after facts, 91.413 before final path
validation, 97.716 after it and 105.782 after receipt publication. Fresh-process
samples have a different collection pattern. The source audit also finds complete
header arrays and manifest JSON copies in three snapshot checks per capture.
Both retained payload/domain structures and transient validation/SQL/async work
remain plausible costs. Phase endpoints cannot apportion their allocations or
establish which change would resolve both heap growth and history RSS.

The next bounded task is **targeted allocation profiling**, with separately declared
new inputs and profiler settings. Profile complete capture allocation stacks to
distinguish validated payload/domain retention from snapshot/SQL/async churn;
profile data must never supply resource-acceptance samples. Choose one subsequent
optimization only after that attribution, then qualify it uninstrumented on fresh
inputs. Do not repeat this broad diagnostic or increase its limits.

## Retained artifacts and verification

`identity.json`, `result.json` and execution stdout/stderr/exit are the original
first-run bytes. `raw.jsonl.gz` holds 110 frames with 2,244,975 raw content bytes;
each frame retains its relative path, byte length, SHA-256 and exact UTF-8 content.
It includes all worker reports, raw returns/receipts, metadata and child exits.
Archive SHA-256: `bef99496d78c3b77bd5967aeac702840ebdaa95ba47a84539195ded0632721f8`.
Owned source/catalog directories remain locally retained separately. Readback
verifies frozen inputs, imported code, every artifact hash, source-header values,
charge totals and query counters without another candidate execution.

Full strict checks, 509 tests and builds pass. Independent tiny regressions cover
the coordinator's separation of failed resources from successful integrity/parity,
explicit child exit 7 and watchdog termination without retry. First focused/full
logs are retained. Post-run packaging initially used the wrong checkout path and
failed before creating artifacts; the external packager path was corrected and
that failure recorded in `archive-path-correction.log.gz`. Measurement bytes and
outcomes were not changed or rerun. `summary.json` describes readback and log hashes.

No corporate sources, model calls, production runtime/schema/API/UI changes, demo
operations or semantic/private-pilot acceptance occurred. See
[Task 079](../../../tasks/079-loredock-memory-attribution.md), the
[frozen protocol](../../../fixtures/loredock-memory-attribution/README.md) and
[diagnostic contract](../../loredock/CAPTURE_MEMORY_DIAGNOSIS.md).
