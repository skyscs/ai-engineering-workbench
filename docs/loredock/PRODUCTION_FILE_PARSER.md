# Production file-parser adoption

This document records the historical prerequisite. Current production adoption is
described in [Owned production parser](OWNED_PRODUCTION_PARSER.md). The original
observations and acceptance limits below are unchanged.

Task 138 begins from accepted Task 137 merge `48b88a9b5b7f7a70bc2a8a5491007279ad7ec57e`.
Both complete CI logs pass 1,094 tests at `bebef1567e8b9c9e4a7966e5f360e66ff23ec0f1`.
The legacy seam is awaitable, but production still uses the direct parser. No default,
schema, parser fingerprint or product behavior changes in this prospective checkpoint.

## First prerequisite: transport compatibility

[ADR 0062](../decisions/0062-loredock-owned-file-parser.md) requires rejecting adoption
if a previously successful legacy projection cannot fit the proposed bounded transport.
The 32-KiB source limit does not prove that expanded fact JSON fits a 512-KiB response:
operations repeat their owning symbol key, and many calls can share a long owner name.

The committed [plan](../../scripts/loredock-production-parser/plan.mjs) defines three
fresh ordinary synthetic files before any parser observation: a normal control, 1,100
calls under a 450-character name, and 100 calls under an 8,000-character name. Every
file also contains an ordinary useful HTTP function. Exact text hashes, runtime,
entrypoint, five-second operation deadline, sixty-second whole-child bound and cleanup
policy are fixed prospectively. Each case uses its own local Git repository and catalog.

The [driver](../../scripts/loredock-production-parser/transport.mjs) records unchanged
direct facts and graph output, then supplies the existing owned adapter through the
internal test seam. It requires exact successful graph serialization, records every
error and joins each owner's actual exit. It never changes production routing or falls
back after a thread failure. An incompatible result blocks adoption; preserve the first
attempt and review the wire contract before editing the production path.

The external owner records complete child exit, elapsed time and CPU/RSS diagnostics.
It retains exact inputs, implementation bytes, stopped catalogs, Git history and errors.
This is a compatibility check with zero model calls and no reserved-family replay.
No startup, event-loop, aggregate heap or resource qualification is claimed.

## Subsequent integration gate

Only after compatibility is established, declare production admission/contention,
asynchronous initialization/fingerprints, native checkpoint fencing, explicit reanalysis
and shutdown behavior before implementing them. Follow the complete requirements in
[Task 138](../../tasks/138-loredock-production-file-parser.md). Keep every synchronous
transaction/read boundary and the original shared work/time ceilings. The independently
confirmed Node 22.13 FTS5 gap requires an honest application runtime contract; pinned
22.23.2 remains the verified runtime.

## First result: adoption is blocked by transport compatibility

The first observation at `d84971fec360540db4266d38a65e9b9840ae1881` fails the
prospective gate. The whole child exits with code 1 after 1,171.132 ms, without a
timeout. All three parser owners report actual exit, closed state and no remaining
ownership; exit code 1 on a deliberately terminated worker is not a leaked process.
No product source, default, schema, native fingerprint or configured ceiling changes.

| Synthetic case | Source bytes | Direct fact bytes | Reply bytes | Direct graph bytes | Owned result |
| --- | ---: | ---: | ---: | ---: | --- |
| Ordinary | 182 | 1,574 | 1,847 | 8,090 | Exact graph |
| Dense operations | 20,328 | 736,636 | 736,909 | 156,559 | `PARSER_RESULT_LIMIT` |
| Long owner | 9,878 | 846,191 | 846,464 | 3,270 | `PARSER_RESULT_LIMIT` |

All direct parsers return two symbols, the expected HTTP operations and no syntax
gaps. Each direct graph retains the ordinary useful HTTP function. The dense graph
honestly omits 943 nodes at its existing limit; the long-owner graph omits one oversized
property. Those existing bounded omissions still produce valid graphs. Rejecting the
whole graph because its intermediate facts do not fit the wire would change behavior.

Both failed replies exceed the unchanged 524,288-byte transport bound. The repeated
owner strings explain a substantial avoidable cost, but these three cases alone do not
prove a general encoding bound. The [retained record](../fixtures/loredock-parser-transport/README.md)
contains exact text, direct facts/graphs, catalogs, Git history, implementation and logs.
The kernel child high-water RSS diagnostic is 240,764 KiB; this mixed direct/worker
comparison does not measure isolated production startup or qualify memory.

Production adoption is deferred. [Task 139](../../tasks/139-loredock-lossless-parser-transport.md)
must review and implement a versioned lossless encoding with strict decoding and exact
fact round trips, preserving input/response/operation bounds. The adapter stays unwired
until that prerequisite passes. [Task 140](../../tasks/140-loredock-production-parser-adoption.md)
then returns to complete native and legacy integration. No failure is relabeled as
successful partial extraction, and the first transport observation is never rerun.
