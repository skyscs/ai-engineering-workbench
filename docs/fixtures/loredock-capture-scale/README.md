# Task 075 — Shared capture budget: scale gate rejected

The first frozen run rejects production promotion. The complete 9,980-file first capture
passes, but repeated large captures exceed the 64 MiB heap-growth bound. Later history and
two small variants exceed the 384 MiB process RSS bound. The candidate, inputs and observer
remain unchanged; there is no matrix rerun or threshold adjustment.

Scope `021f840`, input/oracle/protocol freeze `efc1e92`, measured candidate/observer
`6232fee3a3b81abf956e27bc7e277b7ef2a867e9`. These are agent-authored synthetic checks,
not independent product, semantic or private-pilot acceptance. All sources are owned fixtures;
there are no model calls, corporate sources or changes to the user demo.

## What the first observations establish

All three sizes prepare twenty repositories inside their fixed source shares. The inventories
contain 480/2,480/9,980 total files and 457/2,457/9,957 parsed code files, including the same
21 meaningful facts. The remaining 23 paths contain original documentation/routes/contracts.
Constant-only filler has explicit parser gaps; it is not counted as complete supported syntax.
Relevant import and Java binding domains still admit the expected paths.

The first capture at each size passes the complete typed useful-path/original-support checks:
two paths ending at document writes, ten original passages and all twenty source dependencies.
Neither path selection nor displayed citations narrow the authorization scope.

| Total paths | Source/index preparation | Analysis | First capture | Shared work | Projection / receipt bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 480 | 7.70 s | 0.78 s | 163.05 ms | 89,501 | 28,100 / 43,220 |
| 2,480 | 43.64 s | 3.99 s | 665.30 ms | 149,605 | 28,152 / 43,272 |
| 9,980 | 255.21 s | 31.87 s | 3,271.01 ms | 374,607 | 28,153 / 43,273 |

Preparation includes repository construction and indexing, not only the indexer's own work.
It is outside the capture interval and is not a claim about real-project ingestion speed.

At the two smaller sizes, repeated/selected/isolated-root capture, paging, aggregate-only
exhaustion and subsequent recovery, eviction and restart history all pass. The large first
capture accounts for 290,113 path units plus 84,494 receipt units. The saved independent charge
histograms match every reported phase and total exactly; no completed subtotal is added twice.

## Failed resource gate and limits of interpretation

Four large-case records fail on sampled heap growth:

| Operation | Sampled heap growth | Bound |
| --- | ---: | ---: |
| Repeated capture | 79.290 MiB | 64 MiB |
| Selected-root capture | 64.106 MiB | 64 MiB |
| Isolated-root capture | 67.799 MiB | 64 MiB |
| Recovery after aggregate-only refusal | 67.211 MiB | 64 MiB |

The aggregate-only operation itself returns the expected `CAPTURE_WORK_LIMIT` before a new
publication. Its enclosing case fails on the subsequent recovery's resource check, before the
final recovery-identity assertion. Successful refusal is not a successful whole test case.

After two replacement analyses and restart, the large history read starts at 406.422 MiB RSS.
It returns a recorded result but fails the 384 MiB bound. Long-support and branch-pressure
variants then reach 407.191 and 407.316 MiB RSS. Later operations return below that bound.
The single process includes preparation and prior operations: these observations establish
resource failures, not a proven memory leak or attribution to one subsystem. No forced GC,
process reset, threshold increase or selective rerun is used to reinterpret them.

Resource checks run after raw journaling but before subsequent semantic assertions. Those
later assertions in failed cases remain **unexecuted**, not passed. Retained receipt readback
can expose their content without restoring the failed cases. Timing, interval and byte bounds
do not compensate for a failed memory gate. Five-millisecond sampling plus a final sample is
not a peak-memory guarantee; synchronous I/O still has only cooperative deadline checks.

## Integrity, evidence and next step

The first run completes **68 cases: 61 pass and seven fail**, with **4,515 counted
assertions**, 105 operation observations and exit 1. All 27 stage/fault cases pass, covering
shared work exhaustion, the original deadline and cancellation at four nested path stages
and five receipt stages, followed by recovery. All four publication and six small history
cases pass. The 37 normalized operation failures are expected refusals, separate from the
seven failed resource records.

Across the 68 successful operation returns, maximum outer time is 3,271.006 ms and sampled
interval 74.400 ms. Maximum shared work is 374,607 units; projection/receipt/original text
maxima are 30,422/83,832/39,888 bytes, with at most twelve original passages and twenty
dependencies. Seven returns fail memory checks; successful return is not a qualified pass.

Post-run readback verifies every raw frame, frozen input/baseline/candidate bytes, reported
phase sums, projection/generation hashes and original span hashes without executing the
candidate. Large repeat bytes match the first receipt, the selected-root receipt has one
write-ending path and the isolated receipt has a singleton path with no edges. Long-support/branch raw receipts
retain two write-ending paths. These observations do not execute the skipped assertions
or change the rejected gate.

The first supplementary readback incorrectly expected zero isolated flows and stopped with
an assertion error. The saved response actually contains one singleton flow, one symbol and
zero edges, consistent with the frozen oracle's node/edge checks. The draft description and
supplementary check were corrected against those bytes; neither the matrix nor its oracle
was rerun or edited. The [first readback output](readback-first.log) and
[final readback](readback-final.log) remain available.

The offline budget uses one original deadline and aggregate counter, keeps local limits and
existing scope/metadata/manifest fences, and gives historical reads zero nested path work.
Cancellation after linking removes only a newly created target; an identical old target stays
intact. Final catalog/file publication remains a synchronous guarded local handoff, not a
crash-atomic transaction across resources. Production adapters and all earlier experiments
remain unchanged.

Retained artifacts include [raw result](result.json), [execution identity](identity.json),
[readback summary](summary.json), first [stdout](execution.stdout), [stderr](execution.stderr)
and [exit status](execution.exit). [Raw archive](raw.jsonl.gz) preserves exact UTF-8 content,
path, byte count and SHA-256 in every JSONL frame. There are 165 frames (2,784,940 uncompressed content bytes). Gzip SHA-256:
`c80ed24b4ceedb201f0564280da2b63558205704f5e646efe9d16a35503519ad`.

Full strict checks, 499 tests and builds pass. All six new independent regressions passed on
their first execution; their [unit log](budget-unit-first.log.gz), [integration log](focused-first.log.gz)
and [complete check log](check.log.gz) are retained without altering original bytes. These
ordinary checks do not execute or accept the frozen resource matrix.

Next: separately scope memory diagnosis from retained evidence and source ownership/lifetimes,
then use fresh prospective diagnostics to distinguish retained payloads, transient validation
allocations, SQLite statement churn and preparation/process effects. Preserve full evidence,
ambiguity/completeness checks and all resource bounds. Any changed candidate needs a new
qualification before production integration; question relevance, routing and semantic gates
remain separate.
