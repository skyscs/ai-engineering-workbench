# Native composition qualifies after bounded analysis writes

Task 114's sole reserved campsite-family run **passes all sixteen complete operations**
and **seven byte-exact cross-process comparisons**. Integrity, source support, exact
typed paths, usefulness, history, no-write/shared accounting, lifecycle and resources
all pass independently. Task 110 remains a failed, exhausted historical family.

The accepted composition is PR #117 head `4505398`, with successful push 41896978135
and pull-request 41896986992 CI, merged with an identical tree at `52ad814`. Inputs were
frozen at `67f858d`; the guarded measured head is `7fcc73d`. Pins cover 720 files and
the actual 38-module compiled runtime, including bounded analysis writes, plus Node
22.23.2/V8, the Node binary, TypeScript 5.9.3, pnpm 10.15.0 and the lockfile. The accepted
runtime and independent driver/assessor are unchanged during this qualification.

The owned corpus has twenty sources, 10,000 files, 9,977 code inputs, 490,457 bytes and
21 expected facts. Its digest is
`0e36dfe15c19eaaa25e43d125b82be61ed155e679a1b5b3586de33b04d83a24e`.
There are 9,969 marker-only code files; seventeen sources have no displayed originals
but remain full authority dependencies. Expected full paths and ranges were authored
and reviewed from supported source constructs before any parser/service execution.

The run began at 2026-11-04T19:34:34.917434Z and completed in 386.009024445 seconds,
with outer exit zero. Same-process PID 1510154 completed in 313347.789699 ms; reopened
PID 1541756 completed in 71876.295246 ms. Both workers exit zero, with complete closure
and no watchdog/spawn/worker errors. Preparation remains in the same-process lifetime;
the separate process starts from the byte-identical stopped catalog UUID/snapshot.

| Complete-operation observation | Maximum | Fixed limit |
| --- | ---: | ---: |
| Wall time | 2087.960693 ms | under 5000 ms |
| Sampled interval | 82.966502 ms | 150 ms |
| Sampled RSS | 340.2734375 MiB | 384 MiB |
| Sampled heap growth | 50.4857254 MiB | 64 MiB |
| Shared work | 552362 units | 1000000 units |

All output, original-text, span and source-count bounds pass. Each useful flow preserves
its complete ten-node/nine-edge source path, with eleven nodes/ten edges in the default
union. Useful receipts contain ten originals; isolated receipts contain five. Every
receipt retains all twenty dependencies, including undisplayed sources.

History after two inventory replacements reopens the exact saved projection, originals
and dependencies. Each arm reads ten originals, with zero Git calls, writes/changed
rows, fact/snapshot/path reads, path work or publication locks. Reopened history uses
328.6171875 MiB sampled RSS and 8.433391 ms outer wall time. This is a recorded result
with authorization revalidated; current applicability remains unchecked.

Seven command logs and 49 original artifacts are
[archived with verified hashes](../fixtures/loredock-bounded-write-final-qualification/README.md).
The initial build log is retained but its process exit was lost from resumed tool
context; the later complete `pnpm check` independently exits zero with 817 tests,
strict typechecks and all builds. There was no reserved warmup, retry, profiler,
forced GC, competing local test/build, model call, corporate source or user-demo change.

This family is exhausted. A sampled pass on marker-heavy sources does not establish
continuous/lifetime maxima, dense-code bounds, a causal allocator explanation or an
independent semantic/user acceptance result. No improvement percentage is inferred
from a different historical corpus. Private pilot, L5 and the Workbench bridge remain
separate. After exact-head CI acceptance, [Task 115](../../tasks/115-loredock-public-native-paths.md)
migrates the smallest existing public consumer: read-only connected-path endpoints and
their browser view. Saved-capture/history workflows follow separately.
