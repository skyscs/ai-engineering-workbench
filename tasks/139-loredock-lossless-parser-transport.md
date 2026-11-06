# Task 139 — Encode parser results without repeated strings

Status: implemented and locally verified; first ordinary comparison and 1,107 regression
tests pass. Exact-head CI acceptance pending. The adapter remains unwired.

## Objective

Repair the concrete [transport incompatibility](../docs/loredock/PRODUCTION_FILE_PARSER.md)
before production adoption. The unwired adapter must transmit exact successful facts
for the retained 20,328-byte and 9,878-byte source files within the existing 512-KiB
reply bound. Do not increase source, frame, graph, inventory, prompt, work or time limits;
truncate facts; use a direct fallback; or change parser extraction/legacy semantics.

## Required work

1. Read the complete first observation without rerunning it. Commit a prospective
   wire-format decision and ordinary comparison plan before implementation. Review
   lossless repeated-string factoring, including owner keys and other property values;
   justify the chosen structure and its bounded decoding/retention costs.
2. Version the internal protocol explicitly. Decode only exact supported shapes,
   bounded arrays/strings and valid references; reject unknown tags/keys, invalid
   indices, malformed nesting, unexpected duplicates and prototype-sensitive merges.
   Preserve ordered facts, optional-field absence, Unicode ranges and legitimate
   dictionary keys. Reconstructed `CodeFacts` must serialize exactly as the direct
   parser's original facts and pass existing strict fact/range validation.
3. Keep one owner, one active request, zero queue, generation/input/identity correlation,
   absolute deadlines, cancellation, terminal failures and actual-exit joining. Encoding
   and decoding consume the same existing operation deadline. Do not materialize an
   unbounded expanded JSON string merely to validate a compact frame. No compression
   library, remote dependency, worker pool, automatic restart or source execution.
4. Test exact round trips across supported JS/TS/Vue/Java, Unicode, headers, event
   topics, malformed syntax and large repeated strings. Cover malicious references,
   malformed frames, output limits and delayed cancellation. Compare retained first
   facts/graphs through fresh catalog copies and a new ordinary candidate observation;
   keep the failed original observation unchanged. A targeted repair is not proof that
   every possible admitted source fits; retain any newly found counterexample.
5. Verify source and emitted adapter paths on pinned Node and standalone minimum Node.
   Full application tests use 22.23.2 because the 22.13 Linux build lacks SQLite FTS5.
   Preserve current production source, eager imports, native fingerprint and defaults:
   this adapter remains unwired. Run relevant tests, strict types and complete builds.
6. Retain first failures and exact implementation/runtime inputs. Review complete diff
   and both exact-head CI logs before merge. No startup, aggregate heap or browser
   resource qualification follows from smaller wire bytes. Continue production adoption
   only after the concrete compatibility gate is repaired without changing old outputs.

Production integration remains [Task 140](140-loredock-production-parser-adoption.md).
No corporate source, real model calls or consumed-family replay is authorized here.

## Result

[ADR 0063](../docs/decisions/0063-loredock-lossless-parser-wire.md) precedes implementation.
The first [candidate result](../docs/loredock/LOSSLESS_PARSER_TRANSPORT.md) preserves all
three original fact/range/graph outputs. The two failing replies shrink from 736,909 and
846,464 bytes to 143,742 and 29,747 bytes under the unchanged 524,288-byte bound.
All three owners join actual exit. Exact byte-boundary, malformed-input and source/built
worker tests pass on pinned and standalone minimum Node; original failures are retained.
No startup, aggregate memory, production adoption or universal input-fit claim is made.

Task 138 is accepted through PR 171 at merge `6cb2ce53939932e4aaf705a4afb95cb1f570172d`,
after both complete exact-head CI logs pass 1,094 tests at `3cd3044`.
