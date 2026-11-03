# Streaming snapshot qualification: rejected

Task 082's first frozen execution completed on 2026-11-03 with exit 1. All four
children exit 0 and all 32 operations execute. The original coordinator records
**8/32 integrity passes, 30/32 resource passes and 0/2 qualified parity comparisons**.
The streaming candidate remains unqualified. This family is exhausted; neither
its inputs nor its oracle/candidate may be repaired and rerun retrospectively.

| Identity | Value |
| --- | --- |
| Scope | `20febd7` |
| Input/protocol freeze | `c723cab` |
| Measured harness/candidate head | `4bccec8668ea32873f6eea48bd5e94e71be35b96` |
| Streaming implementation | `94ccbdf` |
| Verified Task 081 merge | PR #85, `c223c8657b84079fa394b647c6ad7e3ba7105e85` |
| Exact reviewed head and CI | `38a4ac9`; push 41631462293 and pull request 41631494808 successful |
| Runtime | Node 22.23.2, V8 12.4.254.21-node.56 |
| Owned sources | Twenty laboratory-kit repositories; 580/9,980 files and 557/9,957 code files |
| Model requests | 0 |

## Fixture compatibility failure

The qualification author changed the consumer method to `onIssued` while requiring
a complete write-ending path. The preserved resolver explicitly indexes only
`onMessage` consumers; that restriction was already stated in the
[topic evidence contract](../../loredock/EVENT_TOPIC_EVIDENCE.md). This is an invalid
useful-path precondition in the authored resource fixture, not evidence that the
streaming snapshot change regressed consumer discovery. The source parser still
records all 21 facts, and the reader honestly reports `unresolved-consumer-method`.

Default/repeated/selected paths stop at `event-publish` and retain seven originals
instead of the required ten. Five useful capture checks fail in each lifecycle,
twenty in total. Paging and isolated capture pass in all four lifecycles. The
coordinator stores a first receipt for dependent checks only after its useful-path
assertions pass, so all four history validations subsequently raise an undefined-
reference error and both qualified parity comparisons lack the first value. Those
original evaluation failures and scores remain unchanged.

Separate post-run [artifact readback](artifact-readback.json) inspects saved bytes
without executing a candidate or relaxing the oracle. It confirms exact raw bytes
for seven capture/page outcomes across each size's processes, source text/hash/
range support for all 24 returned receipts, and matching saved history in all four
lifecycles with no nested read/write work. These observations explain the dependent
evaluation failures; they do **not** turn truncated paths into useful complete
paths, replace the original scores or qualify the candidate.

## Independent memory failures

| Size / lifecycle | First heap growth, MiB | Maximum heap growth, MiB | History RSS, MiB | Resource passes |
| --- | ---: | ---: | ---: | ---: |
| 580 files / same process | 15.533 | 15.533 | 199.484 | 8/8 |
| 580 files / fresh reader | 3.554 | 12.407 | 193.793 | 8/8 |
| 9,980 files / same process | 48.580 | **66.666** | **397.477** | 6/8 |
| 9,980 files / fresh reader | 58.898 | 58.898 | 297.574 | 8/8 |

The large same-process isolated capture exceeds the unchanged 64-MiB heap-growth
limit. History exceeds the unchanged 384-MiB process RSS limit after replacement
analyses, despite only 1.830 MiB of local heap growth and zero nested path/fact/
snapshot work. Reopening cannot waive either failure. All other recorded resources
pass; maximum wall time is 3,290.119 ms and sampled interval 76.605 ms.

Large indexing/preparation takes 210.19 s and initial analysis 31.43 s; replacement
analyses take 30.10–33.67 s. They remain outside read intervals, while their process
residency remains included in history RSS. No profiler, phase/query/owner observer,
heap flag, forced GC or process reset between operations is used.

Do not compare these truncated-path measurements with earlier complete paths as a
causal performance improvement. Snapshot streaming alone has not passed even this
recorded resource workload, and useful complete-capture qualification is missing.

## Next boundary and retention

First repair the qualification preparation/evaluation process separately: review
new useful paths against the documented adapter preconditions before freezing a
resource family, and assess raw receipt/history/parity independently of useful-path
success. Preserve both failed useful assertions and memory observations. Do not
broaden Java consumer matching merely to fit this observed oracle. Remaining
same-process allocation/residency needs an evidence-based next decision before
another qualification; no production integration is authorized by this result.

`identity.json`, `result.json` and execution stdout/stderr/exit preserve first bytes.
`raw.jsonl.gz` contains 74 frames and 1,072,327 raw content bytes with exact text,
relative paths, lengths and SHA-256. Archive SHA-256:
`9efc4200b720b6b885fa41220b0ebc201b461c4d7d8c83797530fdb01eb518b5`.
Owned catalogs and sources remain retained locally. Readback verifies frozen inputs,
unchanged measured harness/candidate/dependencies, all artifact hashes, source
header values and disabled instrumentation. No operation is missing or blocked.

Full strict checks, 521 tests and builds pass. Both independent process regressions
and focused typechecking pass on their first runs; logs and hashes are retained.
An external scaffolding assertion initially matched the observer module filename
before writing runner files; narrowing that tooling guard preceded all execution.
No measured input, runtime result or protocol changed. See
[Task 082](../../../tasks/082-loredock-streaming-qualification.md).

Production behavior, historical failed gates, semantic/private-pilot acceptance,
corporate source boundaries and the user's demo remain unchanged.
