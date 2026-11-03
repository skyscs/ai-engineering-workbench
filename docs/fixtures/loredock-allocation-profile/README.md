# Complete-capture allocation profile

Task 080's first and only frozen execution completed on 2026-11-03 with exit 0.
Both owned child processes exit 0. Complete receipt integrity and profile structure
pass; this diagnostic supplies **no resource-acceptance result**. Earlier failed
gates and all measured families remain exhausted.

| Identity | Value |
| --- | --- |
| Scope | `d58d2f9` |
| Original input/protocol freeze | `c34cece` |
| Prospective V8 protocol correction | `59ef02b` |
| Measured candidate | `cd064273e5bce99d6a1237c970b8ac6fa4e7791f` |
| Baseline | PR #83, merge `3c294434a3eb189c92a324ebc88cb2c656795deb` |
| Runtime | Node 22.23.2, V8 12.4.254.21-node.56 |
| Owned device-checkout corpus | 20 sources, 9,940 files, 9,917 code files, 509,091 UTF-8 bytes |
| Model requests | 0 |

The preparer indexes and analyzes the new corpus, closes owners and copies the
stopped catalog. A fresh reader verifies hashes, source headers and the manifest,
then profiles one complete first capture. All 21 facts, ten supported originals,
typed paths, twenty-source scope and publication fences pass independent validation.
The capture charges 373,831 total units and returns 28,284 projection bytes and
43,477 receipt bytes. No Git calls, catalog writes or legacy mutations occur.
Profiled capture time is 3,519.184 ms; profiling changes allocation/collection, so
neither that time nor memory endpoints substitute for uninstrumented qualification.

## Allocation evidence and one selected candidate

The profile contains 517 nodes and 15,053 samples with complete sample references:
zero missing-node samples or unknown weights. Direct tree-node weights total
505,983,568 bytes; sample weights separately total 506,641,312 bytes. These weighted
estimates need not agree. Both include allocations later collected and backend
collection/export effects; they do not measure retained memory or native RSS.

`allocation-summary.json` ranks disjoint node weights by frame and nearest
application caller. The full raw tree remains available. `stack-attribution.json`
records the exact nodes and ancestor frames supporting this bounded choice:

| Inspectable stack subset | Sampled direct-node weight |
| --- | ---: |
| All nodes below a `CodeAnalysis.snapshot` frame | 63,830,832 bytes (60.874 MiB) |
| Its three `CatalogStore.all` nodes, IDs 23/409/502 | 39,868,568 bytes (38.022 MiB) |

The second row is a subset of the first; do not sum them. The three array-producing
calls belong to initial path validation, final path validation and receipt
publication. Source inspection confirms that each materializes every bounded unit
header, then builds temporary manifest objects/JSON and filtered arrays while
retaining those headers. SQL wrappers, payload validation and async work are other
substantial costs. Async stacks can omit ancestry; this is not an exhaustive causal
partition or proof that snapshot work is the largest cost.

Select **streaming snapshot validation and manifest hashing** as the one next
candidate. Iterate every bounded header in order, validate the same checkpoint,
status, byte/count and authorization rules, hash the identical JSON byte sequence
incrementally, and retain only the required ordered parsed-file IDs. Keep all three
snapshot calls and final fences. Do not add a result cache, skip empty files, relax
limits or change SQL/payload/path semantics as additional optimizations.

This targets a concrete avoidable live array and serialization copy. It does not
promise a particular heap reduction, fix history RSS, establish a leak or justify
production promotion. Implement and regress the candidate separately; then use a
new uninstrumented family with unchanged complete first/repeat/selected/page/history
and long-lived/reopened requirements. Do not rerun this profile or the old matrices.

## Retention and validation

`identity.json`, `result.json` and execution stdout/stderr/exit preserve original
bytes. `raw.jsonl.gz` contains 15 frames and 852,315 raw content bytes, with relative
paths, lengths, SHA-256 and exact UTF-8 content. It includes both worker reports,
metadata, child exits, the raw heap profile, capture and receipt. Archive SHA-256:
`f40447a391729043832ce47ee8bc9d51d3cf21d38f36809fde8728276fc75ae2`.
Owned catalogs/sources remain retained locally. Readback verifies all artifact,
input and baseline hashes, the measured harness and immutable source-header values.

Full strict checks, 515 tests and builds pass. The first full check failed on an
independent tiny profile with missing V8 node references; its raw failure remains
in [development evidence](../loredock-allocation-profile-development/README.md).
The [prospective protocol revision](../../../fixtures/loredock-allocation-profile/PROTOCOL_REVISION_2.md)
declared backend collection/export and unknown-weight accounting before the frozen
corpus was observed. Original inputs were not edited. First/final development logs
and hashes remain available; passing checks do not erase that failure.

No application runtime/schema/API/UI change, corporate source access, model call,
demo operation or semantic/private-pilot acceptance occurred. See
[Task 080](../../../tasks/080-loredock-allocation-profile.md) and the
[memory diagnosis contract](../../loredock/CAPTURE_MEMORY_DIAGNOSIS.md).
