# Task 080 — Frozen complete-capture allocation protocol

Freeze this file, `corpus.mjs`, `oracle.json` and `preflight.json` together before
implementing the profile harness. No parser or candidate has observed these new
inputs. Commit the measured harness before its single profile execution.

The owned device-checkout example has twenty sources with 497 files each:
9,940 total files, 9,917 code files and 509,091 UTF-8 bytes. Every source fits its
unchanged 500-path/2.5-MiB share. Expected meaningful facts total 21, derived from
five Vue symbols/calls, a TypeScript HTTP symbol/operation, a Java publisher and
its record, and subscriber/write methods and records. Four connected Vue actions
and one isolated import provide five roots. Default capture must contain two
write-ending paths, ten complete originals and all twenty source dependencies;
the fleet handbook remains uncited. Typed nodes, topic/environment and hashes are
specified prospectively. This is agent-authored data, not blind semantic acceptance.

## One preparation, one fresh profiled capture

Use Node 22.23.2 without `NODE_OPTIONS`, heap flags or a debugger port. Record Node,
V8, platform/hardware, arguments, input/baseline hashes and candidate commit. Require
a clean committed checkout and one exclusive owned output directory. Run no heavy
checks concurrently. Never read corporate/user catalogs or execute indexed code.

The preparer generates this corpus, indexes it and publishes one compatible code
inventory under the unchanged bounds. At most three recorded resumes of paused/
interrupted jobs are allowed; never retry a failed job. Require exact admitted file/
code/fact expectations and ready sources with zero omitted paths. Stop all services,
checkpoint/close SQLite and reject a nonempty WAL. Hash/copy only regular owned files
into an unchanged initial snapshot and a separate reader data directory. Preserve
metadata, source revisions and all initial file hashes. Never copy a live database.

After the preparer exits, launch exactly one fresh reader. Load application modules,
verify the closed-copy hashes and SQLite/JSON source values, open services and check
the inventory identity before sampling. The reader imports the generator function
but never constructs or retains the source corpus. Disable phase/query hooks; retain
ordinary source/write/fact/snapshot/original counters and shared work accounting.

Connect an internal `node:inspector` session to the current process. Do not call
`inspector.open`, enable breakpoints, log objects to the inspector console, invoke
`collectGarbage`/heap snapshots or request forced collection. Start
`HeapProfiler.startSampling` with all three fixed parameters:

```json
{
  "samplingInterval": 32768,
  "includeObjectsCollectedByMajorGC": true,
  "includeObjectsCollectedByMinorGC": true
}
```

Immediately call the unchanged complete first-capture helper with the prepared build
ID. Stop sampling after its return or exception, before serializing its result or
profile. Disconnect in cleanup. Include original reopening and final publication in
the sampled action. Exclude preparation, initial opening, corpus construction and
profile serialization. No selected/repeat/page/history operation or second sample.

The pinned [Node inspector API](https://nodejs.org/download/release/v22.23.2/docs/api/inspector.html)
provides the local session. Its [bundled V8 protocol](https://github.com/nodejs/node/blob/v22.23.2/deps/v8/include/js_protocol.pdl)
declares both collected-object flags, the sampling interval and profile tree/samples.
Those flags include allocations later reclaimed by GC. This measures sampled
allocation activity, not a retained-object census; it cannot attribute native RSS.
The installed generated TypeScript declarations omit some protocol fields, so verify
the pinned runtime with independent tiny regressions before this execution.

## Journaling, validation and interpretation

Retain the first raw profile and exact capture result/error before judging success.
Keep profiler start/stop/disconnect errors separate. A start failure prevents the
capture; an action failure still attempts stop/disconnect and preserves any partial
profile. Record process stdout/stderr/exit and cleanup failures. Missing preparation
blocks the reader. Preserve every refusal/timeout; no selective rerun or fallback.

Profile validation bounds are 32 MiB serialized JSON, 32,768 tree nodes, 262,144
samples and depth 128. Validate unique node IDs, finite nonnegative byte values,
sample references and unique ordinals. Oversized/invalid profiles fail diagnosis;
retain their original bytes rather than truncating them into a passing profile.
The backend may allocate profile data before these post-return bounds are checked.
Keep the summary within 256 KiB, with at most 100 ranked frame/owner groups plus
explicit other/internal totals. Retain the raw tree for every summary association.

Use direct node self-size weights for disjoint totals, with inspectable raw frame
URL/function/line/column and the nearest application caller when the leaf is internal.
Do not add ancestor-inclusive weights to disjoint totals. Preserve unattributed
samples and report sample weights separately from node totals rather than assuming
they are identical. Grouping describes stack attribution, not exclusive object ownership.

The coordinator independently verifies receipt hashes, complete original text/hash/
range/blob identities, exact typed useful paths, source scope and all normal no-write/
shared-work fences after the reader exits. Write/profile integrity is not a memory
gate. Existing capture work/time/output limits remain enforced inside the action.
Record wall time and before/after memory as profiled observations only; no peak,
resource pass or comparison to unprofiled acceptance samples is claimed.

The preparer watchdog is 900,000 ms, reader 120,000 ms and total 1,080,000 ms. Terminate
only the owned process group on timeout, retain its exit and never restart it. Any
incomplete capture, profile/summary/semantic/preparation/cleanup failure exits 1.
Exit 0 would mean a usable diagnostic profile only.

Inspect allocation stacks alongside Task 079's phase observations and source ownership
before selecting at most one bounded next candidate. Keep uncertainty explicit. The
profile does not diagnose replacement-analysis/history residency or prove a leak.
Any later optimization needs independent regressions and a new uninstrumented complete
capture/history qualification. All previous gates, bytes and budgets remain unchanged.
