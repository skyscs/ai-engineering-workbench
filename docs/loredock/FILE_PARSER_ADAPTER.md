# Unwired file-parser adapter

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
An independent cleanup bound of two seconds reports failure without releasing a live
thread's ownership. `snapshot()` distinguishes `stopping`/owned from actual closed exit.

Only a fixed installed entry is selected. Built execution has empty `execArgv`; source
development explicitly imports the installed `tsx` loader. Both use an empty worker
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
helper, unchanged parser dependencies, compiler and Node version. Streams hash one
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

Implementation and focused verification are in progress. First source-worker tests pass
all nine initial cases; an initial typecheck caught literal widening in the ready binding,
which was corrected without changing parser behavior. The first log and source inputs
are retained. Final counts, built/minimum-runtime checks and diagnostic results will be
recorded after execution; no resource gate is passed here.
