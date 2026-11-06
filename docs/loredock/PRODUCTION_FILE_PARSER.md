# Production file-parser adoption

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
