# Native receipt format

Task 105 implements a pure internal codec for `loredock-code-path-receipt/1`.
It does not create files, migrate the catalog, authorize source access or expose a
consumer. [ADR 0057](../decisions/0057-loredock-native-receipt-ownership.md) defines
the subsequent storage lifecycle; Task 106 implements it separately.

The canonical outer record contains a catalog UUID, the exact native v2 path
projection JSON, complete ordered original spans, complete ordered source
dependencies and a SHA-256 hash of the canonical content without that hash field.
Object keys in the outer JSON are sorted. The projection remains the producer's
exact JSON string, including its field order and version-dependent identities.
Unknown fields and v1/experimental versions are refused; there is no conversion.

The decoder checks nested field types and bounds, canonical bytes, the projection,
generation, graph, edge and flow hashes, complete paths and their original support.
Literal-topic witnesses must agree with their endpoints and appear in the copied
originals. Header comparison records must agree with the supported literal header
properties. Source dependencies include undisplayed scope; every source coverage
entry must match one dependency. Originals must match their references, source,
revision, build, line range and span hash. Duplicate, unused, conflicting and
overlapping original support is refused.

The codec cannot reconstruct opaque node/source/span IDs, omitted analysis inputs,
Git objects or full-file content hashes from a partial set of original spans. Those
fields are shape-checked and cross-checked where recorded support permits it. This
is structural integrity, not a signature, source authorization, a new code analysis
or proof of runtime behavior. A later capture/history service must reopen the current
scope and every original from the catalog before publishing or returning source text.

| Bound | Maximum |
| --- | --- |
| Complete receipt | 640 KiB of UTF-8 |
| Exact projection | 512 KiB of UTF-8 |
| Copied original text | 64 KiB of UTF-8 in total |
| Original spans | 30 |
| Source dependencies | 20 |
| JSON nesting depth | 40 |

Trusted test reductions cannot increase any limit. Malformed UTF-8, lossy Unicode,
nonfinite values and duplicate/noncanonical JSON are rejected. All errors have bounded
messages without copied source text. Input bytes and encoder objects are detached
from the decoded result; no caller object becomes a validation capability.

Every operation requires the actual caller-owned `OperationBudget`. Receipt bytes,
projection bytes, original text and validation entries charge its receipt phase;
bounded JSON walks also check its original deadline. The codec does not create,
replace, reset or close that budget. Native capture must share it with path work.
This logical accounting does not establish a CPU/memory measurement result.

The encoder validates a detached canonical record before returning it. The decoder
accepts bytes only through an internal function; it is not an arbitrary-file import
or an application history endpoint. Saved projection bytes can remain inspectable
after analysis eviction, but only the later service can authorize their release.

Validation uses independently authored records, rehashed nested corruptions and real
native v2 results from small owned synthetic repositories. The compiled smoke runs
the actual built producer and codec, then checks exact decoding after restart and
two inventory replacements without source/fact/path reads during decode. Historical
measured inputs remain unchanged. Complete native publication/history, independent
assessment, final resource qualification and browser migration remain outstanding.
