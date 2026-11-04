# Connected-path fact representation audit

Status: Task 095 source/count review, 2026-11-04. No optimization is implemented
or promoted here. Task 094's frozen resource qualification remains failed.

## Evidence and limits

The [retained qualification](../fixtures/loredock-worker-qualification/README.md)
passes complete content and history but rejects reopened isolated-path RSS at
398.03515625 MiB against 384. The operation occurs before replacement analyses.
The first replacement endpoint also exceeds 384, while the second/history finish
below it. These are observations of intervals/endpoints, not allocation ownership.

The [independent tiny audit](../fixtures/loredock-path-representation/README.md)
uses three sources, 38 files / 32 code files / 4,458 bytes. Its first invocation
exits zero. Default, repeat, selected, page and isolated reads each validate all
32 code files and match the ordinary reader's complete bytes and stable work/read
counts. Every operation makes zero Git calls or catalog writes. The wrapper's own
path counter is explicitly excluded because the comparison injects a separate
reader; all other read/work counters remain equal.

Eight files supply 21 supported facts and no parser gaps. The other 24 supply no
symbols/operations/calls/records, but retain 24 gaps, 24 original references and
144 empty containers across fact/range structures. Each of these 24 files has the
same exact serialized `{facts,ranges}` shape: 183 bytes, SHA-256
`f41714803303beb017052dee7e5cd25baa2199eac162ad15bd4c941f8bc46d68`.
Their aggregate serialized facts/ranges/evidence are 2,304 / 1,608 / 4,624 bytes;
the complete compact payload total is 9,304 bytes. These sums overlap by design
and are **not heap sizes**, unique retained-byte measurements or RSS attribution.

Existing diagnostic hooks show 32 compact entries and 32 consumed identities still
present at final publication, for all five selections. The resolver retains 35
evidence references and builds 15 nodes / 13 edges before display selection. The
default displays eleven nodes/ten edges and ten originals; selected displays ten/
nine/ten; isolated displays one/zero/five. Smaller display does not narrow the
validated file domain. Observed report instrumentation allocates and cannot qualify
timings, memory or larger-input resources.

## Source ownership and consumers

- [`CodeAnalysis.file`](../../apps/loredock/src/code-analysis.ts) validates the stored
  unit, input identity, payload/checkpoint hash, original bytes/evidence, ranges and
  parser gaps before returning facts. The audit counts only after that validation.
  A file with no supported facts remains a real original and cannot be skipped.
- The [compact reader](../../scripts/loredock-compact-payloads/paths.mjs) owns the
  entry/consumed arrays during a request. It keeps each file's facts, ranges and
  evidence; metadata separately retains file/source/unit identities. Coverage,
  consumed hashes and the final metadata/inventory fences depend on all files.
- [`bindingDomains`](../../apps/loredock/src/code-paths-metadata.ts) constructs a
  file-to-payload map retained by its import-domain closure. It uses each file's
  presence and `facts.gaps` for per-source summaries and target completeness.
  Dropping fact-free entries can incorrectly remove an incomplete import or Java
  domain. Its metadata source maps and saved tree validation remain necessary.
- The [resolver](../../scripts/loredock-capture-scale/resolve.mjs) counts examined
  documents/bytes, copies every original reference into its evidence map and counts
  every adapter gap before creating symbol/operation records. It reads facts and
  ranges without mutating them; symbol/operation indexes can retain documents.
  The complete evidence object also survives into resolution/admission. No evidence
  pruning is selected: proving it unnecessary is a separate change.
- Admission and root paging reference that resolution; final publication rechecks
  complete metadata and inventory, with existing work/fence checks. Removing reads,
  domains, gaps, references or charges is not justified by a small final display.

The source explains where references are held. It does not isolate the relative
cost of metadata trees, SQLite, transient JSON validation, evidence maps, garbage
collection or allocator behavior in Task 094's failed sample.

## One next candidate

Test **one request-local immutable canonical fact/range pair for an exact repeated
fact-free shape**. After the existing full per-file validation, eligible files have
empty symbols/operations/calls/records and empty range lists. Record only the first
eligible pair whose complete serialized form fits **4 KiB**. A later exactly equal
serialization may reuse that immutable pair. Different shapes, unsupported fields
or oversized forms retain their original representation; there is no growing map,
hash-only equality, cross-request cache or shared original/evidence identity.

Keep every entry, per-file evidence array, metadata record, consumed identity, gap,
domain, read, work charge and final fence. Copy/freeze the one canonical pair without
mutating the validated payload returned by `analysis.file`. Preserve order and all
values; the only proposed change is duplicate object ownership after validation.
Its state belongs to one request and is released on success/error/cancel/stop.

Before any resource run, prove exact receipt/page/history bytes, work/read/no-write
counters and current originals on independent inputs. Include equal/different/empty/
ordered gap lists, extra fields and size fallback, fact-free imported targets,
ambiguous Java domains, corrupted originals/payloads/ranges, source/policy fences,
overlap/cancel/stop and immutable non-escaping ownership. Then require a separately
fresh frozen full resource qualification. This bounded candidate is a hypothesis;
neither serialized counts nor the prior failed RSS gate promises a sufficient saving.
