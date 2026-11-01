# Offline durable-fact flow comparison

Task 062, 2026-11-01. Scope `b368729`, frozen inputs/oracle `759cb04`, initial prototype
`ca93fb7`, citation-harness correction and measured implementation `786fb82`. Production
base is `7e8c921`. No product code, selection, endpoint, schema, model call or corporate input
changed. The running user demo's process, data and compiled assets remain untouched.

## Decision

Do not promote the naive wider-input graph. In the 365-file case, saved facts retain all
seven critical source facts, but the graph admits only three of the required nodes.
Its 160-node cap produces 211 node-limit omissions. More retained facts alone do not make
a complete system graph, and the two emitted outlines do not restore the required chain.

Saved-fact parity is useful: all six main variants preserve exact selected files, ordered
graph semantics and serialized facts/ranges/original references. The partial syntax case
also preserves graph parity. Graph IDs and schema/adapter/input hashes are explicitly
experimental; normalization removes only those generated identities and provenance fields.
Original evidence IDs, fields, order, gaps, limits and omissions remain part of comparison.
Every same-snapshot repeat is identical apart from timings/RSS; history survives restart.
This establishes bounded mechanical equivalence, not semantic or private-pilot acceptance.

| Variant | Code files read: control / wider | Critical nodes: control / wider | Wider nodes / edges | Finding |
| --- | --- | --- | --- | --- |
| Small baseline | 5 / 5 | 7 / 7 | 14 / 13 | Two partial outlines reach the document write with candidate/unresolved wiring intact. |
| Long-path support | 100 / 365 | 0 / 3 | 160 / 3 | Full facts retain 7/7 critical facts; graph admission loses four required nodes. Reject wider promotion. |
| Dense file | 6 / 6 | 7 / 7 | 114 / 13 | Parser retains only 100 of 200 functions and reports `typescript-symbol-limit`; the assumed graph saturation is not exercised. |
| Ambiguous targets | 7 / 7 | 7 / 7 | 16 / 11 | Both local import alternatives and Java handlers remain in facts; no arbitrary calls/implements edge. |
| Contradictory literal topic | 5 / 5 | 7 / 7 | 14 / 10 | Unsupported import stays unresolved; event delivery is absent; HTTP matches remain candidates. |
| Different environments | 5 / 5 | 7 / 7 | 14 / 10 | Unbound environment/topic delivery is absent; HTTP matches remain candidates. |

F06 separately checks absent, unpublished, reduced-budget, syntax-gap and timed-out reads.
Missing parity payloads prevent a parity result; wider partial results disclose retained,
unattempted, gap and unvisited counts. F07 damages checkpoint, payload, original bytes,
parser identity and limits in separate fresh catalogs; every read fails without a graph.
F08 changes registration, revocation, policy or inventory retention after a consumed file;
consumed facts, source identifiers and graphs are discarded. F09 reads two revisions, repeats,
restarts and evicts the older inventory: old facts become unavailable while authorized
original evidence and the independent legacy projection remain readable.

## Receipts and failed assumptions

The [complete measured receipt](measured-result.json.gz) contains all 21 cases, 73 projection
observations, full file/fact/range/graph vectors, support locators, metrics and implementation
hashes. Its decompressed JSON SHA-256 is recorded in the [serialized review](review.json).
All 73 projections perform zero counted Git calls, store write statements or changed SQLite
rows; deliberate lifecycle hooks are counted separately, including two Git calls for new
source registration. Original reopening validates 1,557 span occurrences including repeats,
with exact source/build/revision/content/span/Git-blob correspondence to frozen source bytes.
No original is silently substituted after a failed fence.

The raw result records **306/313 passed checks**, with all seven failed checks preserved:

- Six live-object fact comparisons distinguish the parser's null-prototype `records`
  dictionary from the ordinary object reconstructed by JSON. Stored values, ranges and
  references are identical in all six serialized vectors. The separate review reads the
  existing receipt and verifies this without rerunning measurements. The comparison helper
  now explicitly uses the persisted JSON contract, with a regression check that still
  rejects changed record field types.
- The frozen dense-file assumption expected 200 retained functions. The existing parser
  cap is 100, with an explicit gap. This remains a failed oracle assumption, not a passing
  dense-graph qualification. A future test must freeze multiple dense files before execution;
  this input/oracle is not rewritten to match the observation.

An earlier citation-harness failure is separately retained with its
[explanation](HARNESS_CORRECTION.md) and [complete receipt](first-harness-failure.json).
It incorrectly expected full original fields on compact graph references. The corrected
run uses fresh data and a new output directory. No parser, selection, assembler or source
oracle was tuned. The later serialized review is interpretation of retained bytes, not a
third measurement run. Neither failure history is replaced by a clean-looking aggregate.

## Timings and verification

For the 365-file shape, first/repeated production projection takes 21.64/20.37 ms;
saved parity takes 36.45/55.68 ms and wider reading/assembly takes 107.60/179.47 ms.
The first wider read spends 87.27 ms in validated inventory/file reads and 4.60 ms in graph
assembly. Wider output is 95,394 bytes under 512 KiB. Saved-fact validation still reopens
originals; this run does not show a speed improvement from avoiding parsing.

These are observations on one process/machine during concurrent checks, with no forced GC
or cache isolation. RSS is sampled every 10 ms and at endpoints; synchronous peaks and child
memory can be missed. Input/payload sizes are logical bytes, not physical disk I/O. Control
vector verification and original reopening are timed separately. Different newly assigned
source IDs can affect the production round order; repeats use the same saved identities.

Strict checks, 447 tests and production builds passed after the citation correction.
A subsequent comparison-helper regression brings the test count to 448; its three focused
checks and strict LoreDock types pass. The serialized-review assertions pass. No browser
rerun is needed for this offline-only change. Builds use a separate worktree, preserving
the old demo assets. Exact-head CI must pass before merge.

## Reproduction

Read the [prospective input contract](../../../fixtures/loredock-durable-flows/DESIGN.md)
and [Task 061 design](../../loredock/DURABLE_FLOW_DESIGN.md). With the pinned Node/pnpm,
build an owned checkout, then use a new output directory:

```sh
pnpm build
node scripts/loredock-durable-flow-probe.mjs /absolute/new-result-directory
```

The script refuses to overwrite a receipt and checks frozen source/input hashes. With the
current JSON comparison fix, the dense-file 200-symbol assumption still fails deliberately;
a nonzero result must not be interpreted as a passing experiment. Future source changes
can make the pinned experiment incompatible. Do not refresh its hashes merely to rerun it.
No model runtime, normal source checkout or user catalog is used.

Review the retained measurements without rerunning any projection:

```sh
node scripts/loredock-durable-flow-review.mjs docs/fixtures/loredock-durable-flows/measured-result.json.gz
```

The next selection contract should distinguish the universe used to resolve ambiguity from
the nodes admitted for display, prioritize complete supporting relationships, and expose
omitted branches. Freeze fresh multiple-dense-file and competing-root counterexamples
before implementation. Keep current answer/correction/history behavior separate; no
production switch, budget increase or Workbench routing acceptance follows from parity.
