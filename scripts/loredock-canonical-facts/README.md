# One canonical fact-free pair per path request

Task 096 follows the [representation audit](../../docs/loredock/PATH_REPRESENTATION_AUDIT.md).
The offline reader changes only construction of compact retained entries. After
the unchanged full file validation, a request may retain one immutable canonical
`{facts,ranges}` pair for an exact repeated fact-free shape. All per-file evidence,
entries, metadata, consumed identities, gaps, domains, work and fences remain.

Eligibility requires only the known fields, empty symbols/operations/calls/records,
empty range lists, the existing offset encoding and string gaps. The first eligible
serialization of at most 4 KiB is copied and frozen, including all nested containers.
Later byte-identical serializations reuse that pair. Differences, unknown fields
or larger forms retain their original references; they never replace or grow the
single slot. Gap order and all values remain exact. Input payloads are not frozen
or mutated. The bound describes serialized retained content, not native heap size;
the signature string and copied pair both remain referenced until request exit.

State is local to one `project` invocation; no callback or service member stores it.
Success, failure, cancellation and stop unwind the same request ownership. The
existing prepared path/store and inventory-worker scopes remain unchanged. No
fact-free file is skipped, no original/evidence is interned, and no cross-request
result or authorization cache is introduced.

The path fork is mechanically compared with the frozen compact reader: only its
factory name/import, request-local pair creation and entry construction differ.
Independent tiny semantics and helper identity/immutability/fallback cases precede
any separately frozen resource qualification. No memory saving or production
promotion follows merely from sharing equal objects.
