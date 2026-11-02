# Connected flow admission qualification

Task 063, 2026-11-02. Scope `c9c02f7`; fresh input/policy `8cd1cee`; pre-observation
binding-budget clarification and measured implementation `121033a`. Post-measurement
metadata review `b2e0208` groups index-excluded files by source and adds a regression;
it does not change frozen inputs or rerun observations. Production base is `a4d4a7d`.

## Result

The fixed connected-admission candidate passes **306/306 checks across twenty cases**.
All 76 projection observations and 1,841 original span reopen occurrences are retained.
Every measured projection has zero counted Git calls, store write statements and changed
SQLite rows outside the separately recorded lifecycle hooks. This is mechanical
qualification on known synthetic sources, not semantic/private-project acceptance.

The key change is separating supported binding resolution from displayed nodes. All retained
facts participate before display selection. Alternative implementations cannot disappear
from uniqueness checks because their nodes do not fit. Missing, index-excluded or
parser-truncated code makes its source incomplete and blocks positive unique import/handler/
consumer bindings. Selected paths are admitted atomically with their complete support.

| Constructed shape | Production required nodes | Rejected naive wider input | Connected candidate |
| --- | --- | --- | --- |
| Five-file parcel baseline | 7/7 | 7/7 | 7/7 |
| 221 files with short-path distractions | 0/7 | 5/7 | 7/7 |
| Two additional files, eighty functions each | 4/7 | 0/7 | 7/7 |

In each of these three cases, the candidate displays the same thirteen-node/twelve-edge
union of two write-ending paths. The worker-start symbol and its performs edge are outside
those paths and explicitly counted as unselected. In the distracted case, 217 resolution
nodes are not displayed. All original support remains intact, including types/imports,
record shapes, JSON contract and topic declarations. HTTP, event delivery and subscriber
dispatch retain candidate status and unresolved runtime authority/deployment/collection
qualifications. No source execution or model call occurs.

The other cases intentionally qualify limits rather than seven-node completeness:

- Alternatives outside displayed paths remain ambiguous; no arbitrary calls/implements
  edge is issued. Parser-truncated alternatives leave one retained match but still prevent
  a false uniqueness assertion. Reduced-budget missing units have the same protection.
- Contradictory literal topic and environment cases retain HTTP candidates but have no
  event-delivery/dispatch connection. Their shorter paths do not claim successful delivery.
- Four competing roots select A/B deterministically and disclose two omitted roots.
  A twenty-five-function chain discloses the twenty-node depth bound; the independent
  Dojo path still reaches the write. Neither result claims full root/branch coverage.
- Lower fact/time limits return no graph. A one-node display allowance omits both whole
  paths instead of publishing fragments. A zero comparison allowance creates no invented
  cross-source connection and retains its explicit omission count.
- Registration, revocation, policy and inventory eviction after a consumed file discard
  all pending source data. Damaged originals fail visibly. Two revisions survive restart
  with stable historical identities; evicted facts become unavailable while authorized
  original citations remain readable.

## Evidence and timings

The [complete compressed receipt](result.json.gz) contains generated revisions, implementation
hashes, all input facts/ranges, full resolution/display vectors, complete alternatives,
original reopen identities, first/repeated readings, lifecycle failures and metrics.
The [summary](summary.json) records its decompressed SHA-256, measurements and case outcomes.
The [prospective contract](../../../fixtures/loredock-connected-admission/DESIGN.md) and
[frozen generated-input hashes](../../../fixtures/loredock-connected-admission/baseline.json)
precede observations. No failed Task 062 input, oracle, receipt or gate is rewritten.

First/repeated connected projection takes 58.37/52.83 ms for the 221-file shape and
6.28/6.01 ms for the multiple-dense-file shape. The small connected display is 21,711 bytes;
the distracted display is 21,721 bytes, under the unchanged 512 KiB cap. Full diagnostic
receipts are separate from that display response and are intentionally larger.
All same-snapshot semantic vectors repeat exactly; measurement timing/RSS fields are excluded.

These are one-machine observations during concurrent checks. RSS samples at ten milliseconds
and endpoints can miss synchronous peaks; child memory and physical disk I/O are not measured.
Source-ID order can affect the unchanged production control in fresh catalogs; repeats use
fixed saved identities. The candidate's root ordering uses role/source name/path/symbol key
before its final source-ID tie-break. No production latency or full-volume guarantee follows.

## Verification and remaining boundary

Strict full checks, 451 tests and production builds pass for the measured implementation.
The later excluded-source grouping regression passes four focused checks and strict LoreDock
types, bringing the suite to 452 tests. It replaces per-path excluded metadata with at most
twenty source counters; aggregate SQL still scans relevant saved metadata. A policy-excluded
file test verifies that source uniqueness remains incomplete. No browser rerun is needed:
application code, APIs/UI, answer/review consumers and persisted schema are unchanged.
Builds run in a separate worktree, preserving the existing demo process, data and assets.
Exact-head CI is required before merge.

The temporary resolution universe has explicit fact/node/edge/reference bounds, separate
from the 160-node, 240-edge, two-outline display. The five-second read/resolve deadline is
cooperative, not an OS isolation or hard scheduling guarantee; synchronous matching can
block until it completes. Qualification covers at most 221 files here, not the 600-file
prototype bound or the production inventory's 10,000-file maximum.

Any syntax gap conservatively blocks same-source uniqueness. This can omit valid links in
real projects with unrelated unsupported syntax. Root selection also omits entry points and
nonselected branches. The retained inventory is disposable, while saved answers/reviews are
not. Consequently this experiment does **not** authorize replacing the existing graph or
silently feeding the candidate into answers, related-source suggestions or correction replay.

The next bounded step is an integration contract: stable projection provenance binding the
index, inventory fingerprint/manifest and policy; explicit missing/incomplete availability;
access to omitted roots without another setup form; source/index/policy late-response fences;
and preservation of current answer/correction/history consumers. Define performance and
larger-universe qualification before expanding the prototype's bounds. Keep existing failed
semantic gates and private-pilot requirements separate.

## Reproduction

Use the pinned Node/pnpm and an owned checkout. Build it separately if the primary checkout
serves a live demo, then choose a new output directory:

```sh
pnpm build
node scripts/loredock-connected-probe.mjs /absolute/new-connected-results
```

The probe verifies frozen hashes and refuses to overwrite a receipt. It creates only fresh
owned repositories/catalogs and removes them after the recorded run; output receipts remain.
Future incompatible source changes must not be accommodated by relabeling the frozen hashes.
The `b2e0208` metadata review is separately identified; the archived measurement remains at
`121033a`. Decompress `result.json.gz` to inspect every original observation without rerunning
any indexing or projection. No credentials or model runtime are needed.
