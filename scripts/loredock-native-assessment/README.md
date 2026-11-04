# Independent native result assessment

Task 108 supplies an offline functional boundary for native v2 projections and
catalog-bound receipts. The assessor imports no application codec, path resolver,
catalog, analysis service or producer. It reads only stopped caller-owned artifacts
and caller-supplied expected sources and pins. It does not authorize current source
access or evaluate whether recorded links describe current execution.

`assessSeries({ root, rows, metadata, corpus, oracle, size })` requires the fixed
sequence `first`, three repeats, `selected`, `page-4`, `isolated`, `history`. Each row
has a name and output artifact reference; captures also have a receipt reference.
References have exactly `file`, `bytes` and `sha256`. Output files contain the exact
JSON result, with no wrapper or service-provided arbitrary file path. A receipt is
the exact native file. History follows inventory eviction and restart in the fixture.

The owned artifact reader refuses traversal, symlink directories/files, non-files,
oversized inputs, growth/truncation and observed file metadata changes. It allocates
only the declared length plus one byte. This is not a concurrent hostile-directory
import API. Canonical JSON checks reject invalid UTF-8, BOM, duplicate keys, lossy
Unicode, excessive depth and unknown structured fields. Projection, graph, edge,
flow and receipt identities are recomputed without changing schema versions. Root
page four is separately validated with a null graph; receipts require offset zero.
The literal-topic and header rules, endpoint kinds, flow continuity, complete support
membership, same-file original ranges and dependency vectors have explicit checks.

The unchanged historical `content.mjs` helpers compare original text, full-file SHA-256,
Git blob IDs and source pins with independently expected source files, and apply the
fixture's required nodes, terminal kind, omissions and literal topic. Their pure
legacy codec/hash imports do not invoke a decoder or application service. The new
native decoder does not use the production codec as an oracle. This is separate
implementation and authored expected data, not independent human review.

Every operation reports artifact integrity, shape, source support, usefulness, exact
history and raw repeats separately. Malformed capture output cannot erase an intact
receipt or prevent an otherwise possible historical comparison. Unsupported receipt
bytes remain available for equality comparison but cannot pass shape. Missing or
duplicate inputs keep all planned denominators. `compareSeries(left, right)` requires
seven raw comparisons and carries either input's failures forward. Equality means
only byte equality; it cannot establish validity or authorization.

The new development fixture describes permit grants across Vue, Java, Kafka and Mongo,
with a fourth README-only dependency absent from displayed code. Expected sources and
required nodes are authored before outputs. A second case changes `onMessage` to
`onGranted`; its explicit unresolved-consumer gap passes the incomplete oracle and
fails the complete-flow oracle. Each case exercises default/selected/isolated capture,
page navigation, duplicates and exact history after eviction/restart. These small
cases are functional tests; the comparison helper alone proves no cross-process run.

Run source regressions from `apps/loredock` with Node 22:

```sh
node --import tsx --test tests/native-assessment.test.ts
```

After the normal build, the compiled smoke takes one fresh absolute output directory:

```sh
node scripts/loredock-native-assessment-built-smoke.mjs /tmp/native-assessment-new-run
```

It refuses to overwrite an existing directory and retains raw outputs, expected inputs
and assessments for both cases, including rejection by the complete oracle. No model,
corporate source, product consumer or frozen resource family is used. Resource/lifecycle
qualification requires the next native worker/coordinator and a separately frozen
fresh family: sixteen complete operations, seven cross-process comparisons and all
unchanged numerical gates. `resources: not-evaluated` is deliberate here.
