# Task 136 — Implement an unwired owned file-parser adapter

Status: scoped after Task 135; begin after both exact-head CI events and identical-tree merge.

## Objective and boundaries

Implement the smallest testable owned worker-thread adapter selected in
[ADR 0062](../docs/decisions/0062-loredock-owned-file-parser.md), using the existing
Java/TypeScript/JavaScript/Vue extraction unchanged. Follow the
[source audit and adoption gates](../docs/loredock/COMPILER_ISOLATION.md).

This task does not connect the adapter to any production caller, change parser
semantics/fingerprints, asynchronous catalog APIs, SQL schema, defaults, model policy
or resource ceilings. No production startup improvement is claimed. Do not replay
consumed qualification families or launch corporate repositories/real models.

## Implementation and acceptance

1. Add a strict versioned wire codec and fixed installed worker entry. Bound source
   text at 32,768 UTF-8 bytes, full request at 256 KiB and full response at 512 KiB.
   Use exact-size transferable buffers; validate bytes before decoding and complete
   shapes/correlation/digest/identity/fact ranges before use. No AST, filesystem roots,
   credentials, catalog handles, executable input or logging of source contents.
2. Add an explicit asynchronous owner with one thread, one active request and zero
   queued requests. Constructor is inert. Start/ready handshake and every request use
   caller deadlines/signals. Busy rejects before retaining input; no automatic retry,
   respawn, synchronous fallback or result cache. Capture bounded failure/exit metadata.
3. Abort/deadline/protocol failure/crash/stop invalidates the generation, rejects new
   work and joins actual worker exit. Stop is idempotent. Keep ownership until exit;
   report incomplete cleanup instead of declaring a leaked worker gone. Test exactly
   once settlement and late/duplicate replies, including exit after a completed result.
4. Preserve current parser modules byte-for-byte. Compare exact serialized facts and
   original ranges against direct extraction for representative supported and unsupported
   syntax, Unicode offsets, header and event cases. The adapter identity must include
   installed entry/codec/owner/parser/compiler bytes and runtime; it is separate from
   the unchanged production inventory fingerprint until a later integration task.
5. Exercise real built workers and a declared source-development path. Select loading
   from installed code, not arbitrary source/options. Ensure `tsx`/test preloads do not
   recursively create workers; pin and record effective exec arguments. Validate minimum
   supported runtime behavior without silently depending on newer diagnostic APIs.
6. Add meaningful lifecycle/protocol integration tests with controlled workers for slow
   startup/parse, malformed/oversized frames, unexpected errors and exits. Fault injection
   remains internal/test-only and cannot make a source choose an entrypoint. Inspect
   remaining worker handles after cleanup, not just promise rejection.
7. Declare and retain a small first ordinary diagnostic observation before execution:
   adapter import/start/parse/stop, actual useful facts, main-loop/RSS, worker heap request
   and completion coverage, and CPU on pinned Node 22.23.2. No production daemon or model
   is needed here. Missing startup/busy heap coverage is an explicit limitation, not a
   successful resource result. Preserve first outputs and failures without rewriting them.
8. Verify production import reachability is unchanged and parser/frozen artifacts are
   exact. Run strict types, focused adapter tests, required regression tests and builds.
   Review complete diff and both exact-head CI logs before merge. Record the narrow next
   legacy-async task only after evidence identifies remaining integration constraints.

Full empty/useful/near-limit **production** controls belong after adoption, as declared
in the design. Adapter success does not qualify startup, aggregate heap, browser memory
or the prepared-question flow and does not justify a limit or observer waiver.
