# Unwired file-parser adapter

This document records Task 136's original adapter and first observation. Task 139
updates only its result transport through [protocol v2](LOSSLESS_PARSER_TRANSPORT.md);
the original observation remains a v1 result. Task 137 separately made legacy consumers
awaitable. The production parser remains direct until Task 140.

Task 136 implements the first stage of [ADR 0062](../decisions/0062-loredock-owned-file-parser.md).
The production entry, synchronous analysis/graphs/answer consumers and existing parser
modules remain unchanged. Importing `file-parser` creates no worker and loads no compiler.
Construct an owner, explicitly await `start`, await one `parse` at a time, then await `stop`.
This internal adapter is not exposed through HTTP, environment options or user settings.

## Ownership and boundaries

One owner creates one generation and cannot restart. Busy admission retains no second
document. Every operation takes an absolute monotonic deadline, at most five minutes
ahead, and an optional AbortSignal. Caller-specific shorter deadlines remain mandatory
at future integration. Encoding, identity initialization and startup use that same time.
Check the absolute deadline after identity hashing, before reading a reply and after
decoding/validation; a delayed timer callback cannot admit an expired result.
An independent cleanup bound of two seconds reports failure without releasing a live
thread's ownership. `snapshot()` distinguishes `stopping`/owned from actual closed exit.

Only a fixed installed entry is selected. Both modes have empty `execArgv`; source
development uses a native ESM bootstrap to register the installed `tsx` loader with
configuration discovery disabled before importing the fixed TypeScript entry. Both use an empty worker
environment and private captured stdio, preventing accidental inheritance of test or
diagnostic preloads and environment credentials. Output is drained and byte-counted;
more than 4 KiB fails the generation. Source text and worker error messages are not logged;
normalized error name/code, terminal reason, thread identity and actual exit are retained.
This thread shares process privileges and is not a security sandbox.

Request content is limited to 32,768 UTF-8 bytes. Relative paths use the existing catalog's
4,096-character path rules. Complete request/response frames are limited to 256/512 KiB.
Strict UTF-8, exact wire fields, version/generation/request/input/implementation bindings,
fact shapes and original UTF-16 ranges are checked. Dedicated buffers are transferred;
no AST or source handle crosses the boundary. Protocol/worker failure ends the generation,
without fallback, automatic restart or converting infrastructure failure into syntax gaps.

The adapter has its own installed-byte identity, including owner, entry, codec, identity
helper, unchanged parser dependencies, compiler and Node version. Source mode also
binds its bootstrap and `tsx` API entry; it is not a complete seal of all loader or
transpiler dependencies. Source compatibility tests use the locked installed toolchain;
production observation uses emitted JavaScript without that loader. Streams hash one
installed file at a time and support initialization cancellation. The production analysis
fingerprint is unchanged because no production caller uses this adapter yet.

## First ordinary diagnostic plan

Commit this plan and the exact adapter/probe before the first observation. Use pinned
Node 22.23.2 without heap/GC flags, source configuration or real models. A new exclusive
output directory records a single built-adapter lifetime under an external thirty-second
owner. Do not retry into that directory, remove a first failure, or rerun consumed families.

The probe imports the actual built adapter, starts it with a five-second deadline, parses
eight declared synthetic documents once in order, waits fifty milliseconds with the
compiler owned but idle, and stops it. Documents cover useful TS/JS/Vue/Java, Unicode
offsets, malformed TS, unsupported Vue and unsupported Java escapes. Save complete inputs
and facts; independently compare exact serialization/ranges against direct parsers after
the observed process exits. No parser import in the observed main thread is permitted.

A forwarding Worker constructor observer records the one actual thread without changing
its entry, options or messages. Every ten milliseconds, retain main-loop interval, complete
process RSS/heap, and one outstanding external worker heap/CPU request per generation.
Record request and completion times, skipped outstanding requests, missing/error samples,
online/exit and operation boundaries. Keep worker CPU separate from whole-process CPU.
No heap snapshots, forced GC, heap limits or instrumentation subtraction.

These are diagnostic samples, not a simultaneous/continuous heap peak or production
startup qualification. Compute per-isolate observed maxima and their conservative sum;
startup/busy sampling holes remain explicit. The observer itself adds allocations/time.
The production parent still imports the compiler through its old paths, so an adapter
measurement cannot repair its accepted failed startup result.

Retain exact source/emitted modules, lockfile, runtime identity, first test failures,
raw inputs/facts/samples/events, owner exit/cleanup, direct comparison and complete CI
logs. Verify every preexisting production source and emitted byte is unchanged, and
that old entrypoints cannot reach the new modules. No inventory, answer or database is
created in this task. Full application/near-limit controls follow production adoption.

## Validation status

The first candidate's full local check passes 1,059 tests, strict types and all builds.
Added literal-event/syntax-limit and absolute-deadline regressions bring the final focused
source suite to fourteen passing tests on both Node 22.23.2 and minimum Node 22.13.0.
Two built-adapter tests, the final build and strict types also pass. First failures are
retained: a literal-type widening error and
the minimum runtime rejecting a direct `.ts` Worker entry despite a `tsx` preload.
The fixed native ESM bootstrap with configuration discovery disabled passes the same
minimum-runtime suite, including an invalid `tsconfig.json` in the caller's directory.

Final review also found that a reply could win over a delayed deadline timer. The first
targeted regression fails with `Missing expected rejection` before the correction.
The owner now checks absolute time at initialization and both sides of reply validation;
tests cover expiry before reception, during validation and before worker creation.
This correction changes only the owner source/emitted module from the observed candidate.
The first resource diagnostic below is retained for that earlier candidate, not relabeled
as a measurement of the final corrected owner. It has no qualification authority.

The first prospective built observation at `5036ad5` completes eight useful/unsupported
documents with exact facts and original ranges, then joins worker exit. It produces five
symbols, three HTTP operations and four declared gaps; its illustrative `kafka.send`
calls are not recognized event operations. Positive literal-event support is checked
separately by the added regression, without rerunning this first observation.

The process runs 239.027 ms inside a 322.283-ms external owner, with no failures or
survivors. Thread exit code 1 is the documented result of requested `Worker.terminate`;
the enclosing process exits 0 and the owner records `PARSER_STOPPED`, not a worker crash.
Twenty-five main samples reach RSS 133,906,432 bytes, process high-water RSS 144,556,032,
parent heap 6,357,104 and raw interval 10.966 ms. Twelve successful worker heap samples
reach 24,686,144 bytes, making the sum of observed isolate maxima **31,043,248 bytes**.

Two of fourteen worker samples reject, eight timer ticks find a request still pending,
the first successful completion is 21.979 ms after creation, and a statistics request
takes up to 74.704 ms. These gaps prevent a whole-heap qualification claim. Whole-process
CPU is 177,851 user / 38,681 system microseconds; worker CPU remains a separate retained
attribution series. No instrumentation is subtracted and no resource ceiling changes.

[Retained evidence](../fixtures/loredock-file-parser/README.md) includes the first raw
lifetime, sources/emitted inputs, independent comparison, failures and logs. All 139
preexisting workspace modules remain byte-identical; five new emitted modules remain
unreachable from old production entrypoints. Production startup/near-limit heap and
browser RSS are still unresolved. [Task 137](../../tasks/137-loredock-async-legacy-consumers.md)
migrates the legacy asynchronous seam before any production thread adoption.
