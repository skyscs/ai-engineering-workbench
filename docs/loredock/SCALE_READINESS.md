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

## Task 026 retrieval outcome

[Expanded retrieval qualification](../fixtures/loredock-scale-retrieval/README.md)
records 19/20 complete required-evidence sets before the change and 20/20 afterward.
Zero-hit context represents twenty sources rather than eighteen on this small corpus.
Stable saved-source ordering removes fresh-UUID selection variation. Explicit repository
names add bounded first-span samples, while lexical cross-source evidence remains eligible.
Final text/prompt limits are unchanged; [ADR 0030](../decisions/0030-loredock-scale-retrieval.md)
records the sampling bounds and unresolved limitations. This retrieval-only slice
did not evaluate actual answer support, uncertainty or engineer-review behavior.

## Task 027 semantic outcome

[Expanded answer evaluation](../fixtures/loredock-scale-answer-quality/README.md)
preserves two complete 24-attempt runs through the qualified personal connection.
Prompt v8 improves the agent assessment from 17/20 to 18/20 and review cases from
3/4 to 4/4. The final run has no material unsupported claim found by the agent,
but s04 and s14 omit required context/limitations, so the overall gate remains failed.
All 1,352 issued span occurrences match freshly regenerated original source bytes;
this provenance audit does not resolve the semantic omissions. Restart, immutable
review history and source-revocation boundaries pass for both runs.

Answer completeness is the next bounded investigation. Keep independent review,
framework coverage, retention and the eligible private pilot ahead of the bridge;
neither the numeric score nor a successful engineering merge establishes readiness.

## Task 028 completeness diagnosis

[Question/rubric alignment](ANSWER_COMPLETENESS.md) separates direct answers, necessary
qualifications and optional background without rescoring Task 027. Twenty-four prospective
wordings are frozen before retrieval measurement; twelve development and ten of twelve
reserved wordings obtain their complete recorded evidence basis on two fresh indexes.
The shared stock JSON contract and reservation method body are omitted in h02/h04 as
identifier expansion competes with remaining lexical candidates. The h02 code record
supplies equivalent message fields; chosen-reference recall is not semantic correctness.
All selections are stable and existing context caps hold. No new model calls or product
changes. Next: bounded literal-reference expansion/admission, then a separately budgeted
answer evaluation; the reserved set is inspected for retrieval and is not blind.

## Task 029 retrieval outcome

[Literal-reference retrieval v7](../fixtures/loredock-reference-retrieval/README.md)
supplies the recorded evidence basis for all 24 prospective questions and preserves
20/20 original expanded and 20/20 three-source pilot recall. Two fresh twenty-source
generations select identical original locators; zero-hit orientation still represents
twenty sources. Query/source-aware expansion includes bounded quoted member owners;
two direct candidate turns per expansion reduce displacement by derived hints. Limits,
prompt v8, schema and runtime are unchanged. Maximum observed expanded/prospective input:
30 spans / 8,775 text bytes / 32,338 prompt bytes. This is a zero-model engineering
qualification on inspected synthetic questions. Prospective model evaluation, independent
review, framework coverage, retention and an eligible private pilot remain ahead of L5.

## Task 030 prospective answer outcome

[One fixed-input run](../fixtures/loredock-prospective-answers/README.md) completes all 24
attempts. Agent review passes 11/12 development and 12/12 reserved cases; all 62 required
propositions pass, but an extra d10 claim incorrectly connects different tenant-header
names without a mapping. The prospective gate fails. All 122 claims and 185 citation
references are reviewed; 699 input-span occurrences match regenerated original bytes.
History/replay/revocation pass; the 24-attempt budget is exhausted without a rerun.
Tasks 031–032 subsequently expose bounded literal header/binding compatibility in the
map and answer contexts, preserving unknown runtime wiring and security enforcement.
This does not establish L5; independent
review, broader framework coverage, retention and the eligible private pilot remain open.

## Task 032 context integration outcome

Prompt v9 receives at most six derived comparisons / 8 KiB JSON, with every supporting
span already retrieved. Source selection fingerprints remain unchanged for all 24
prospective and 20 expanded questions; the pilot preserves all 20 reference sets.
Reference recall stays 24/24, 20/20 and 20/20. Maximum observed prospective/expanded
prompt size is 35,958 bytes, below the unchanged 96 KiB cap; maximum source text remains
8,775 bytes. Context transport/provenance/history and browser acceptance use fake
runtimes only. These are engineering checks, not new model correctness measurements.
See [evidence](../fixtures/loredock-answer-interfaces/README.md). Freeze a new prospective
qualification design before considering a separately budgeted real-model run.
