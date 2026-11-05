# Owned file-parser adapter: retained development evidence

This is the first **ordinary diagnostic**, committed prospectively and executed once
at `5036ad57dbe39cd9dd66de7b44ba624ec11510e8`, before the later deadline-guard correction.
It is not a measurement of the final corrected owner, production startup or resource
qualification. The application remains unchanged and does not call this adapter.
No catalog, corporate source, controlled model invocation or real model call is used.
See the [adapter contract/result](../../loredock/FILE_PARSER_ADAPTER.md),
[design](../../decisions/0062-loredock-owned-file-parser.md) and [records](records.json).

The [first lifetime](parser-first.tar.gz) includes all eight input documents, exact
fact outputs, raw parent/worker samples, lifecycle events, owner stdout/stderr/exit,
244 source/emitted/runtime input files and the exact installed compiler. Runtime binary
paths and SHA-256 identities are recorded; executables remain in the local toolchain
and are not redistributed in this archive. The observed Node version is 22.23.2.
The archive contains all 262 original entries; independent review confirms they remain
unchanged. Per-file [inventory](parser-first.inventory.json.gz) records sizes/hashes.

The observed main process imports the adapter, starts one built parser, parses each
document once, idles for fifty milliseconds and joins thread exit. It returns five
symbols, three HTTP operations and four explicit gaps. Exact serialization and original
UTF-16-derived ranges match the existing direct parsers for all eight documents.
The illustrative `kafka.send` calls are not recognized events; a separate subsequent
regression verifies a supported literal `EventPublisher` profile and syntax bounds.

The external owner exits 0 in 322.283 ms with no survivors; its observed process lifetime
is 239.027 ms. Requested worker termination exits the thread with code 1, while the
adapter records `PARSER_STOPPED`, no worker error and no incomplete cleanup.

| Diagnostic measurement | First value |
| --- | ---: |
| Parent samples | 25 |
| Worker sample requests / successful heap results | 14 / 12 |
| Rejected worker heap samples / pending sample ticks | 2 / 8 |
| Parent observed heap maximum | 6,357,104 bytes |
| Worker observed heap maximum | 24,686,144 bytes |
| Sum of observed isolate maxima | 31,043,248 bytes |
| Process sampled RSS / high-water RSS | 133,906,432 / 144,556,032 bytes |
| Main raw interval maximum | 10.966 ms |
| Creation to first successful worker sample completion | 21.979 ms |
| Longest external statistics request completion | 74.704 ms |

Heap samples are asynchronous and do not establish simultaneous or continuous peaks.
Startup/busy sampling gaps remain visible; these results cannot certify the 64-MiB
whole-daemon heap ceiling. Whole-process CPU is 177,851 user / 38,681 system microseconds;
worker CPU is retained separately and is not added to the process total. No GC, heap
tuning, instrumentation subtraction, old-family replay or resource-limit change occurred.

The first candidate's full local check passes 1,059 tests, strict types and builds.
Additional positive-event/syntax-limit and absolute-deadline tests bring the final
focused suite to fourteen; all fourteen source and both built tests pass on pinned
Node 22.23.2 and minimum Node 22.13.0. Final types and build also pass.
Minimum Node was downloaded from its official versioned distribution and checked
against its published SHA-256 list; its identity and checksum list are in review inputs.
All 139 old workspace modules remain exact; five added modules are unreachable from
the old production import closure. Product parser/fingerprint/schema/defaults are unchanged.

First failures are retained with their original inputs and complete logs:

- [Typecheck inputs](typecheck-first-inputs.tar.gz): ready-binding literal widening,
  fixed before first runtime tests.
- [Source-loading inputs](source-loading-first-inputs.tar.gz): minimum Node rejects a
  direct `.ts` Worker entry with `ERR_UNKNOWN_FILE_EXTENSION`, while built tests pass.
  A fixed native ESM bootstrap registers the installed loader with `tsconfig: false`;
  corrected source tests pass, including an invalid configuration in the caller's cwd.
- The initial static audit expected 139 files in LoreDock's directory alone; that folder
  has 86 old modules. The corrected audit uses the accepted 139-module workspace manifest.
  This was an audit-scope error, not changed product bytes.
- [Late-deadline inputs](deadline-first-inputs.tar.gz): the first targeted regression
  catches a successful reply accepted before a delayed deadline timer gets its turn.
  The corrected owner checks time after identity hashing and before/after decoding and
  validation. [Final inputs](deadline-final-inputs.tar.gz) retain the exact source/emitted
  delta, final tests and check records. The original resource lifetime remains unchanged;
  it is not rerun or promoted to evidence for corrected-owner performance.

[Review inputs](review-inputs.tar.gz) retain the external owner, independent assessment,
retention inventory, minimum-runtime identity, pre-deadline test source and predecessor CI review.
Complete test/build/diagnostic logs and both accepted Task 135 CI logs are compressed
separately and indexed by raw/archive hashes in `records.json`. The archive writer's
initial empty in-progress log snapshot is labeled; its completed output is also retained.
No first observation was overwritten or rerun. Browser RSS, production startup and
near-limit heap remain unresolved; asynchronous consumers are the next bounded task.
