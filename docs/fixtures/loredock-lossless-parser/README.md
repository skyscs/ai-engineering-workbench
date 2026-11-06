# First lossless parser transport comparison

This ordinary compatibility record belongs to
[Task 139](../../../tasks/139-loredock-lossless-parser-transport.md) and
[ADR 0063](../../decisions/0063-loredock-lossless-parser-wire.md). The adapter remains
unwired; no model, corporate source, consumed-family replay or resource qualification
is involved. Input, frame, operation, graph and inventory ceilings remain unchanged.

`records.json` pins three complete trees (479 entries) and closed validation logs.
`first` contains 474 files: candidate source/emission/runtime identity, the external
owner, all 254 extracted original Task 138 entries, fresh catalog copies, actual facts,
graphs, per-owner terminal state and complete process output. The other two trees retain
the first recursive-tuple type error and the later widened test-literal type error.
Each tree has an independent compressed file inventory and SHA-256 archive digest.

The prospective decision and comparison plan precede implementation at `0b8b582`.
The first observed candidate is `bdb8f6ea83275922b9bf28e6f154a6d743567b99`; its full
implementation bytes and exact Node binary digest are retained. The first candidate
and the failed Task 138 observation are never rerun or overwritten.

All three cases preserve exact original fact JSON, UTF-16 ranges and complete direct
graph JSON. Dense operations shrink their encoded reply from 736,909 to 143,742 bytes;
the long owner shrinks from 846,464 to 29,747 bytes. The ordinary reply is 1,514 bytes.
All fit the original 524,288-byte bound. Recorded encoded lengths use the actual v2
encoder with fixed-width correlation fields; they are not a separately sampled wire trace.
Existing graph omissions and original support remain exact.

Each owner processes two requests and joins actual exit without retained ownership.
The complete child exits 0 after 828.747 ms, without timeout. Kernel child high-water RSS
is 212,972 KiB, with 0.867 user and 0.140 system CPU seconds. These are mixed-workload
diagnostics, not a comparison of production startup, simultaneous heap or performance.
The three repaired cases do not prove universal transport fit or close resource gates.

Twenty-three source-worker/codec tests and six built-worker tests pass on Node 22.23.2
and standalone 22.13.0. The complete pinned-runtime check passes 1,107 tests, ten
typechecks and all builds. It includes strict malformed-reference, prototype-key,
Unicode, exact inner/envelope-byte-boundary, deadline and actual-exit tests. Full
application minimum-Node support remains unproven because Linux 22.13 lacks SQLite FTS5.

Both complete accepted Task 138 CI logs are retained: 1,094 tests per event at `3cd3044`,
followed by merge `6cb2ce5`. Task 139 still requires final-head CI review before merge.
Only the unwired protocol, owner and worker modules change. Production call sites,
the direct parser, old saved formats, native fingerprint and defaults stay exact.
Task 140 resumes production adoption after this concrete compatibility repair is accepted.
