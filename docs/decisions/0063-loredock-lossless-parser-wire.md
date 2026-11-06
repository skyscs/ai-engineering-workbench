# ADR 0063: Lossless parser result string table

Status: accepted for the unwired adapter; production adoption remains Task 140.

## Problem and decision

[Task 138](../loredock/PRODUCTION_FILE_PARSER.md) demonstrates two successful direct
graphs whose intermediate replies exceed 512 KiB. Repeating owner and property strings
is avoidable wire overhead. Raising the response ceiling or truncating facts would
evade the compatibility gate. General compression also requires a separate expanded-byte
bound and potentially large expanded JSON allocation in the parent.

Version the internal protocol as `loredock-file-parser/2`. Keep the existing fact reply
envelope, but represent its `facts` as `{ strings, value }`. Intern every string value
and object key once, in first-use order. Use tagged arrays for structure:

| Encoded value | Meaning |
| --- | --- |
| `[0, index]` | String-table reference |
| `[1, [keyIndex, value], ...]` | Ordered own object properties |
| `[2, value, ...]` | Ordered array |
| Safe integer or boolean | Literal scalar |

The existing `CodeFacts` schema has no null/undefined data. Encoding preserves property
order, optional-field absence, Unicode strings, numeric ranges and dictionary keys.
Decoding creates ordinary own properties with `Object.defineProperty`, so legitimate
`__proto__` and `constructor` dictionary keys cannot mutate a prototype. The original
strict fact/ownership/range validation remains mandatory after reconstruction.

## Bounds and ownership

Input remains 32 KiB, request 256 KiB, response 512 KiB. Keep all existing deadlines,
one-owner/one-request/zero-queue rules, correlation and actual-exit joining. Ready/error
replies remain simple; old protocol versions are rejected explicitly. This is an internal
unwired wire migration, not a saved catalog/context/prompt format migration.

Account the exact compact JSON token bytes incrementally during encoding, including
new table strings and structural punctuation, then enforce the complete envelope bound
before transfer. Do not first stringify expanded facts to validate the wire budget.
Decoding validates exact wrapper keys, unique strings, safe indices, first-use order,
full table use, supported tags, pair shapes, duplicate keys and bounded nesting.
Maximum nesting is eight; valid facts need fewer levels. The response frame bounds
visited nodes and retained references. Reconstruct objects directly from the bounded
compact frame without an intermediate expanded JSON string.

Encoding/decoding is part of the same operation deadline. The owner's before/after
absolute checks remain in force, including when a timer cannot run yet. This structural
bound does not establish total V8 heap or event-loop acceptance. Existing resource
failures and all their numerical ceilings remain unchanged.

## Verification and limits

First implement the codec and strict malformed-input tests, retaining failures. Compare
exact serialization and original ranges across supported languages, Unicode, optional
fields and prototype-sensitive keys. Exercise real source/emitted workers and the two
retained failed inputs on pinned Node; standalone minimum-Node checks remain separate
from whole-application compatibility.

A new ordinary observation opens fresh copies of the three Task 138 stopped catalogs,
parses their exact retained text and compares raw facts and complete graph bytes to
the original direct outputs. It records compact frame bytes and closed worker ownership.
Never rerun or rewrite the first failed observation. The concrete cases must pass before
adoption; they do not prove every possible admitted source fits. Any further counterexample
remains an explicit failed gate, requiring another contract review.

Production source, eager compiler imports, native fingerprint, defaults and schemas stay
unchanged in this task. No direct fallback, automatic restart, model call or corporate
source is introduced. Complete checks and both exact-head CI logs precede merge.
