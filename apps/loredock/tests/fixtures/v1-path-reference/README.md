# Preserved connected paths v1 control

Task 101 commit `25f372d` saved the exact `code-paths.ts` from Task 100 head
`0c9aa12cb27ceec444c62c9c95d2cfce25ec2216` before production edits. The manifest
records original source, deterministic TypeScript emission, explicit relative import
relocation and the ten-module runtime dependency closure. The compiler is the
Task 100 [reference compiler](../integration-reference/compile.mjs).

`production-v1-paths.test.ts` verifies every emitted dependency hash. Only
`code-paths-resolve.ts` may have changed source bytes: its internal readonly type
narrowing must still emit exactly the original runtime. No production service imports
this archive, and no historical resource family is re-executed.

Behavior comparisons supply the same current analysis identity to both readers.
They check complete serialized v1 output, all SQL executions, original/fact reads,
work checkpoints, root pages, selected and isolated paths, gaps, corruption refusal
and absence of writes/Git calls. The reference and production reader have separate
module ownership guards; comparisons are sequential, while production concurrency
uses the actual service regression suite.

The manifest also preserves the pre-change **source test runtime** fingerprint
inputs and Node version. A separate stopped-state transition test explicitly supplies
that historical fingerprint to the original analysis implementation, verifies refusal
by the new implementation, performs explicit reanalysis and reopens with the old
identity. This is not a byte-for-byte replay of an old installed application's build.
Original evidence and the unchanged offline receipt control survive the transition;
offline receipt history is not a newly introduced production API.
