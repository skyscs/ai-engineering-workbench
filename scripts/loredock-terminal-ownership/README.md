# Bounded terminal heap observation helpers

Task 086 implements the [terminal ownership decision](../../docs/loredock/MEMORY_OWNERSHIP_DECISION.md)
on tiny independent fixtures only. These are Linux/Node 22.23.2 diagnostic helpers,
not a product endpoint, qualification result or new resource corpus. No application
or exhausted experiment module changes.

`runOwnedChild` runs an absolute trusted internal script in a new owned output
directory. It records stdout/stderr, arguments, limits, runtime identity, sampled
RSS and exit/error/stop details before returning. The environment contains only a
fixed system PATH and C locale; Node options and user configuration are not inherited.
The owned process group receives TERM, then KILL after one second if needed.
Cancellation, watchdog, observer, child and descriptor-cleanup errors fail the result.

The launcher requires `/usr/bin/prlimit` and `/proc` on Linux. A hard `RLIMIT_FSIZE`
applies before Node starts, including native heap snapshot writes and child logs.
RSS is supervised by the parent every 10 ms; it is a sampled stop condition, not
an instantaneous kernel memory guarantee. The watchdog remains independent of the
blocked worker. Partial files and failing exits remain in the owned directory;
there is no retry, reset or automatic limit increase.

Task 087's actual application integration exposed a process-exit race: Linux can
omit the memory section while the separately sampled state still says `R`.
The observer now records missing samples explicitly, stops sampling after exit,
and rejects a continuing missing-RSS interval at 100 ms. It never substitutes zero
or requires a zombie state. Malformed present measurements still fail. The
[first failure](../../docs/fixtures/loredock-terminal-memory/README.md) is retained;
this correction precedes the new resource-family freeze.

`createTerminalExporter(root, limits)` verifies pinned Node/V8 versions and the
installed finite file limit. Its returned function accepts `after-history`, then
`after-release`, exactly once each. It refuses existing target files, writes native
V8 snapshots, records pre/post memory and export time, and hashes the saved file.
The caller must run both stages outside application operations and release service
references/owning stacks before the second stage in a subsequent event-loop turn.
The parent must require both observations; a clean child exit alone is insufficient.

`readSnapshot` confines references to those two regular owned files, refuses
symlinks and verifies declared byte length/hash with a bounded read. The pure
`summarizeSnapshot` parses outside the observed worker. It accepts only the pinned
default V8 metadata, validates every node/edge/string/location reference and unique
node identity before traversal, and rejects allocation-trace shapes. Selectors name
an object constructor and up to four exact string-valued own properties; no source
code or predicate callback is executed.

The readout reports full matching counts and shallow sizes, with bounded examples
and inspectable node/edge indices. One breadth-first traversal excludes weak edges.
Property/element/context-only paths are labeled `explicit-strong-edges`; paths
containing runtime edges or native/hidden nodes are `runtime-edges-unclassified`.
The latter cannot establish a strong retainer: conditional runtime relationships
need raw-graph review. Missing non-weak paths and path-length limits are explicit,
not evidence that an object is absent. Selectors can overlap, and shallow sizes are
neither retained subtree sizes nor native process memory. Node IDs are local to
each graph. No output labels an object as a leak.

## Fixed diagnostic ceilings

Internal callers may only reduce these bounds. A subsequent frozen diagnostic
must record its exact settings before observation.

| Dimension | Ceiling |
| --- | ---: |
| Each child file and each parsed snapshot | 128 MiB |
| Nodes / edges / strings | 1,000,000 / 4,000,000 / 1,000,000 |
| Selectors / displayed matches per selector / path steps | 8 / 8 / 64 |
| Serialized summary | 256 KiB |
| Whole owned child watchdog, including later preparation | 900 seconds |
| Parent-sampled child RSS stop condition | 1 GiB |

These bounds contain an intrusive diagnostic. Application capture limits remain
5,000 ms, 1,000,000 work units, 150 ms sampled interval, 384 MiB RSS, 64 MiB heap
growth and the existing output caps. Neither the larger diagnostic process ceiling
nor post-collection endpoints supply application acceptance.

The pinned backend collects garbage during snapshot generation; export blocks and
allocates additional memory. This behavior was verified in Task 085 against pinned
[Node documentation](https://nodejs.org/download/release/v22.23.2/docs/api/v8.html#v8writeheapsnapshotfilenameoptions)
and [V8 source](https://github.com/nodejs/node/blob/v22.23.2/deps/v8/src/profiler/heap-snapshot-generator.cc#L2780-L2793).
No manual GC flags, live source services or per-object registry are added by these
helpers. The first snapshot perturbs the state used by the second; their difference
cannot estimate ordinary shutdown savings.

## Independent verification

```sh
node --test scripts/tests/loredock-terminal-ownership.test.mjs
```

The actual child holds a marked synthetic object for the first snapshot and drops
its owner before the next event-loop turn. Counts are one, then zero. Independent
graph cases distinguish strong/weak/runtime/native paths and reject malformed
schemas, identities, indices, encoding and bounds. Process cases exercise exit 7,
cleanup failure, cancellation, timeout, sampled-RSS refusal and a real hard file
limit. File cases refuse traversal, symlinks, size and hash mismatches.

The first failure and schema preflight are [retained](../../docs/fixtures/loredock-terminal-ownership/README.md).
No fresh near-limit family has been authored or executed. The next task must freeze
one compatible complete-path input/protocol and baseline before the targeted run;
all previous families remain exhausted and streaming remains unqualified.
