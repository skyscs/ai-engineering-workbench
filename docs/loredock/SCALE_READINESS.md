# Twenty-repository capacity readiness

Date: 2026-10-31. Task 024 follows merged PR #27. This is a code audit and a
reproducible synthetic boundary probe, not twenty-source ingestion or L5 acceptance.

## Current constraints

| Area | Observed implementation | Consequence for the next slice |
| --- | --- | --- |
| Registration | `CatalogStore.addSource` uses `defaults.sources = 3`. The UI offers one absolute local path per submission. | Raising a constructor override cannot bypass the store limit. One explicit source-cap contract and a bulk path preview are needed. |
| Inventory | `Catalog.run` inventories each source sequentially into one 10,000-path budget. Extraction consumes a shared 50 MiB budget in stored row order. | Early large repositories can consume the budget before later README/context files. Snapshot/inventory coverage and fair context admission must be tested separately. |
| Git reads | `SourceGit` has bounded per-command output/time and disables fetch, hooks and optional locks. | Increasing project limits must preserve bounded reads and ordinary checkout state. A large-tree read failure stays a visible source gap. |
| Overview | `projectOrientation` explicitly rejects more than three recorded active sources; nine documents, 96 KiB input and 128 KiB output are separate limits. | Merely raising registration would break Project overview. Give every selected source a context card or visible gap and reserve README attempts across all sources. |
| Declaration/code maps | Each considers up to 100 documents / 256 KiB with source-balanced candidate selection; separate node/edge/comparison bounds and two flow outlines remain. | These projections can be honest partial views at larger scope; listing sources cannot imply complete relationships. Measure omissions and prevent accidental name-based ownership. |
| Question context | Thirty spans / 64 KiB; lexical candidates 120; root README reserve three; zero-hit fallback eighteen spans total. | An orientation sample cannot cover twenty repositories even once. Wider question retrieval needs a separate measured change; do not silently enlarge model payloads with registration. |
| Review input | Ten notes / 16 KiB, selected by source overlap; global review revision invalidation. | Retain explicit omissions and scope dependency unions. More sources do not turn notes into source facts. |
| Refresh/history | Fixed-baseline reuse; source-balanced change details; 10,000-file comparison cap; twenty versions shown in UI. Stored generations are retained. | Validate imbalanced updates and retained bytes. A UI history limit is not retention or a project storage quota. |

Code references: [store](../../apps/loredock/src/store.ts),
[catalog](../../apps/loredock/src/catalog.ts), [Git reads](../../apps/loredock/src/git.ts),
[orientation](../../apps/loredock/src/orientation.ts),
[declarations](../../apps/loredock/src/system-map.ts), [flows](../../apps/loredock/src/code-flows.ts),
[answer retrieval](../../apps/loredock/src/answer-context.ts),
[review context](../../apps/loredock/src/answer-review.ts),
[changes](../../apps/loredock/src/index-changes.ts).

## Measured baseline

The new [heterogeneous fixture](../../fixtures/loredock-scale/README.md) has twenty
distinct source roles, 79 text files, sixty excluded canaries and twenty independent
questions. The original three repository commits and their oracle are preserved.
Tests verify all original evidence/hash locators, source-tree/oracle separation and
deterministic regeneration. This is a deliberately small topology, not a stress workload.

The [production probe](../../fixtures/loredock-scale/readiness-result.json) registers
the original three sources and receives `SOURCE_LIMIT` for `checkout-bff`, the fourth.
The remaining sixteen are unattempted. The admitted sources still index their original
eighteen text files. No product guard is bypassed and no model is called. Generation,
registration and three-source index durations are separate diagnostic measurements on
one local machine; twenty-source latency/storage and semantic quality are `null` or
explicitly not evaluated. A capacity rejection is an observed blocker, not a passing
twenty-source product demonstration.

## Next bounded implementation

Implement **bulk local-source onboarding and fair baseline orientation** before widening
semantic retrieval or returning to Workbench:

1. A pasted explicit list of absolute local paths produces a bounded preview: canonical
   identities, duplicates, existing sources and per-path errors. No disk/organization scan,
   remote cloning or model configuration. Confirm the reviewed valid set once; revalidate
   identity and source-set revision, preserve atomic registration and exact replay.
2. Support up to twenty active sources consistently in storage, API and UI. Existing
   three-source databases retain their history and authorization rules. Source registration
   remains separate from indexing; users see what will be indexed before it starts.
3. Reserve baseline documentation/inventory opportunity across all selected sources under
   explicit project and per-source bounds. A large first repository must not silently
   starve later source cards. Preserve unsupported/failed/truncated states and exact evidence.
4. Update overview bounds together with registration. Every source needs a sourced card
   or an explicit gap; deeper map/flow and answer limits remain visibly partial.
5. Verify initial import, duplicates/invalid paths, changed identities, concurrent previews,
   interruption/resume, revocation, refresh, historical evidence and mobile navigation with
   the twenty-source corpus and separate imbalance/long-document load cases. Record time,
   Git reads, extracted/retained bytes and omissions. Do not claim L5 from these checks.

Following slices can then measure wider retrieval, unsupported framework conventions,
real-model review behavior and retention. The original knowledge-ready gate, independent
quality review and eligible private pilot still precede the Workbench bridge. This order
advances system-wide source coverage without declaring the existing parser/model complete.
