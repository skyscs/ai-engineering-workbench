# Twenty-repository capacity readiness

Date: 2026-10-31. Task 024 follows merged PR #27. This is a code audit and a
reproducible synthetic boundary probe, not twenty-source ingestion or L5 acceptance.

## Task 024 constraints (historical)

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

## Task 025 implementation contract

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

## Task 025 outcome

[Task 025](../../tasks/025-loredock-bulk-onboarding.md) implements this contract with
reviewed bulk paths, atomic replayable registration, twenty active sources and fixed
source shares. [ADR 0029](../decisions/0029-loredock-bulk-source-baseline.md) records the
bounds and tradeoffs. The [version 2 measurement](../../fixtures/loredock-scale/onboarding-result.json)
registers all twenty sources and indexes 79 text files / 16,869 bytes, excluding sixty
canaries. All twenty README contexts resolve original citations. One local measurement
records approximately 1.54 seconds initial indexing and 0.77 seconds unchanged refresh;
these tiny-corpus timings are diagnostic, not production performance targets.

Initial indexing makes 437 Git commands / 99 blob-read attempts; unchanged refresh makes
200 commands / twenty blob reads and reuses 79 files. Two generations retain 33,738 raw
bytes and 33,580 span-text bytes; the checkpointed SQLite file is 712,704 bytes including
indexes/metadata. Source files and Git repositories are separate. There is no retention
quota or garbage collection implied by these measurements. The version 1 blocker result
is retained unchanged as historical evidence.

The next bounded slice should measure retrieval recall and uncertainty on all twenty
frozen questions, including zero-hit broad orientation and cross-repository ownership.
Current thirty-span/64 KiB answer limits remain. More registered sources and original
README excerpts do not establish semantic completeness or authorize the Workbench bridge.
