# Lossless parser result transport

This document records the historical prerequisite. Current production adoption is
described in [Owned production parser](OWNED_PRODUCTION_PARSER.md). The original
observations and acceptance limits below are unchanged.

Task 139 repairs the two concrete transport failures retained by
[Task 138](PRODUCTION_FILE_PARSER.md). [ADR 0063](../decisions/0063-loredock-lossless-parser-wire.md)
was committed at `0b8b582` before implementation. Protocol v2 shares repeated strings
through a strict table and reconstructs ordered facts directly in the parent. Input,
request/response and operation bounds remain unchanged. The adapter is still unwired;
production imports, direct extraction, native fingerprint, schemas and defaults stay exact.

## First candidate result

The first ordinary candidate is `bdb8f6ea83275922b9bf28e6f154a6d743567b99`. It opens
fresh copies of the three stopped Task 138 catalogs, reads the exact archived text and
compares returned facts, original ranges and complete graphs with the original direct
outputs. The Task 138 archive and all 254 copied original entries remain unchanged.

| Case | Old reply bytes | V2 encoded reply bytes | Original fact bytes | Graph bytes | Comparison |
| --- | ---: | ---: | ---: | ---: | --- |
| Ordinary | 1,847 | 1,514 | 1,574 | 8,090 | Exact |
| Dense operations | 736,909 | 143,742 | 736,636 | 156,559 | Exact |
| Long owner | 846,464 | 29,747 | 846,191 | 3,270 | Exact |

The complete child exits 0 after 828.747 ms, without timeout. Each of three generations
handles one fact request and one graph request, then joins actual exit. No worker
ownership or cleanup failure remains. No model call occurs. Encoded reply lengths are
calculated using the actual v2 encoder and fixed-width correlation fields; they are not
an independently sampled transport trace.

The kernel child high-water RSS diagnostic is 212,972 KiB, with 0.867 user and 0.140
system CPU seconds. These mixed compatibility controls and the earlier control have
different workloads; their timing or RSS difference is not a performance improvement
claim. No complete startup, event-loop, aggregate-heap or production resource result is
established by this record. Earlier startup, near-limit heap and browser failures remain.

## Strictness and verification

Encoding counts compact JSON bytes incrementally before retaining additional table
entries or structure. The complete envelope is separately bounded before transfer.
Decoding rejects unknown fields/tags, invalid/noncanonical references, duplicate strings
or keys, unused entries, unsupported scalars and excess nesting. It checks the caller's
deadline during reconstruction and retains the owner's absolute checks before and after
validation. Original fact shape, symbol ownership and UTF-16 ranges still require their
independent validator. Old v1 wire replies cannot masquerade as v2 data.

Tests include exact inner/envelope byte boundaries, Unicode and lone surrogates,
optional fields, ordered dictionaries and legitimate prototype-sensitive keys, malformed
frames, delayed cancellation and actual worker exit. Twenty-three source-worker/codec
tests and six built-worker tests pass on pinned 22.23.2 and standalone minimum 22.13.0.
The first two typechecks expose recursive-tuple and test-literal typing errors; both
failures and original inputs are retained. No behavioral expectation is regenerated.
Full application checks use pinned Node because official Linux 22.13 lacks SQLite FTS5.
The complete local check passes 1,107 tests (712 LoreDock, 260 script and 135 other
package tests), ten typechecks and all builds. No product code changes follow that run.

The [portable original facts](../../apps/loredock/tests/fixtures/parser-transport-reference/README.md)
are copied from the first failed archive with exact hashes. The
[complete evidence](../fixtures/loredock-lossless-parser/README.md) retains the candidate,
original copies, catalogs, logs and accepted predecessor CI. These cases repair observed
incompatibilities; they do not prove that every possible admitted source fits. Any new
counterexample must remain an explicit failed gate, without truncation or a larger limit.

After complete checks and merge, [Task 140](../../tasks/140-loredock-production-parser-adoption.md)
returns to production ownership, contention, asynchronous initialization and native/legacy
integration. No experimental product capability is enabled by this transport change.
