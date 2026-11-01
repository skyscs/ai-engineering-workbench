# Retained-history design boundary

Task 056, 2026-11-01; the read-only diagnostic is implemented by Task 057. This design
does not introduce a history-removal feature. Schema 9 reduces one text copy; raw
originals, issued citations and build history remain independently retained.

## Findings

An index is more than a disposable cache. Existing consumers need both its identity
and, in several cases, its original payload. `published` means a build was published;
it does not mean it is the current pointer. Stale, failed, cancelled, fenced, withdrawn
or absent from the first UI page does not mean unreferenced or safe to remove.

| Dependency | Stored relationship and current reader | Consequence for retention |
| --- | --- | --- |
| Current project | `project.publishedBuildId`; [catalog](../../apps/loredock/src/catalog.ts) default reads | Retain the complete current authorized scope and its issued originals. This pointer is not an SQL foreign key, so FK checks alone miss it. |
| Unfinished indexing | `builds.status`, pinned `build_sources`, files and `baselineBuildId`; [catalog](../../apps/loredock/src/catalog.ts), [checkpoint validation](../../apps/loredock/src/checkpoint.ts) | Preparing/running/pause-requested/paused/interrupted work needs its recorded inputs and completed checkpoints. A restart does not release them. |
| Refresh and change comparison | `builds.baselineBuildId`; [change projection](../../apps/loredock/src/index-changes.ts) | Historical inventory metadata supplies added/removed/changed classifications; details expose old evidence IDs. Dropping payload can break original reads even if metadata remains. |
| Extraction reuse | `files.reusedFromFileId`; [catalog reuse](../../apps/loredock/src/catalog.ts), [store](../../apps/loredock/src/store.ts) | Each new file owns copied bytes, but lineage points backward and affects recorded metrics. Do not null the lineage merely to bypass a foreign key. Future reuse validates the fixed baseline, not arbitrary older copies. |
| Saved answers and attempts | `answer_attempts.buildId`, frozen context/result JSON and `answer_sources`; [answers](../../apps/loredock/src/answers.ts) | Context contains span IDs and review references outside SQL foreign keys. Preserve original reopening and immutable input hashes. Failed attempts may still contain context/provenance; the last-twenty UI list is not a retention limit. |
| Engineer history | `corrections.buildId`, `previousId`, target evidence IDs and source/flow dependencies; [corrections](../../apps/loredock/src/corrections.ts) | Original targets reopen every supporting span. Versions and withdrawals are history; immutability triggers reject deletion and unauthorized content changes. Source purge is the existing narrow exception, not a cleanup API. |
| Reapplied corrections | `correction_reapplications.sourceCorrectionId`, checksums and ancestor traversal; [reconciliation](../../apps/loredock/src/reconciliation.ts) | A newer note retains an older note's provenance and scope. Discovery follows up to twenty ancestors; its bound does not authorize deleting older history or silently skipping a withdrawal. |
| Code inventories | `code_analyses.buildId`, `code_analysis_files.fileId`, payload evidence; [code service](../../apps/loredock/src/code-analysis.ts) | Originals are revalidated before use. The service keeps the latest published inventory plus its new attempt; this disposal policy does not bound raw build history. Running/paused/interrupted code work remains distinguishable. |
| Search statistics | Both FTS tables contain passages across builds; [literal search](../../apps/loredock/src/catalog.ts), [question retrieval](../../apps/loredock/src/answer-context.ts) | Even documents outside the queried build affect ranking statistics. Removing unreferenced history can alter current query order and selected context. |
| Request replay | Unique build/answer/correction request IDs and immutable inputs; [store](../../apps/loredock/src/store.ts), [answers](../../apps/loredock/src/answers.ts) | Deleting a failed/cancelled record can allow the same request to start new work instead of replaying its receipt. Metadata retention needs a separate design even when payload is disposable. |

`answer_sources`, correction source dependencies and code source dependencies also
connect authorization to retained derivatives. Registry/policy fencing is independent
of physical retention: a fence alone does not purge every original. Existing source
revocation deliberately clears affected content; using it to shrink history would also
remove the source from current work. Backups and exported copies stay outside local purge.

## Why an age threshold or FK-only collector is insufficient

For a simple unchanged sequence `C → B → A`, where arrows are recorded baselines and C
is current, a strict dependency-preserving whole-build collector retains all three.
Reuse lineage and note reapplication add further edges. Deleting A breaks B's comparison
or ancestry even if A has no saved answer. Keeping just a build tombstone cannot satisfy
existing evidence/target reads; keeping original bytes while dropping FTS postings still
changes retrieval. This is a dependency example, not a measured workload.

There is also a ranking dependency without an explicit reference. SQLite FTS5 BM25 uses
document and token statistics for the entire FTS table, even when an outer query filters
to one build. See the [SQLite BM25 definition](https://www.sqlite.org/fts5.html#the_bm25_function).
The [fixed in-memory probe](../fixtures/loredock-retention-ranking/README.md) preserves
current text and token positions but flips current document order in both FTS layouts
after removing ten unrelated historical documents. It demonstrates the mechanism,
not its prevalence or impact on the complete LoreDock answer selector.

Task 055 avoids this issue: it preserves every document and token while changing only
where literal text is stored. Optional compaction preserves logical rows too. A future
history-removal operation must be treated as a potential retrieval change, with explicit
context/version handling and prospective acceptance cases. Saved answer inputs must never
be silently regenerated to match a new corpus.

## Decision and alternatives

Keep all history by default. Add a read-only dependency inventory before offering
cleanup. Do not choose a number of retained builds or a time window without understanding
the engineering workflows those histories support. There is no cleanup recommendation
based solely on payload estimates or zero direct references.

| Approach | Tradeoff and prerequisite |
| --- | --- |
| Preserve history, diagnose growth | Smallest useful next slice; no new availability semantics or destructive action. Chosen next. |
| Drop only unreferenced whole builds | Conservative on explicit edges, but refresh chains can keep everything and shared FTS statistics still change. Requires more than an FK collector. |
| Retain identity tombstones and remove payload | Can reduce bytes, but every evidence, history, comparison and replay consumer needs explicit unavailable-content behavior and dependency rules. Not implemented. |
| Share immutable content across builds | Can retain historical availability while saving duplicates; requires original identity, source-scoped purge, integrity and ownership qualification. Task 055's result does not qualify raw-file/span sharing. |
| Isolate ranking statistics per generation | Could reduce cross-history ranking influence, but changes index/retrieval design and needs fresh prospective equivalence/quality evaluation. Not an incidental retention fix. |

Automatic pruning, background compaction and a hard directory quota remain out of scope.
A future destructive operation needs a concrete preview, revalidation under exclusive
ownership, atomic failure/recovery, explicit unavailable-content semantics and a user
action selecting the exact removal. This document grants no authority to delete user data.

## Read-only generation dependency inventory

Implemented advanced command: `pnpm loredock:history --data-dir /absolute/loredock-data`.
Its contract accepts existing schemas 8 and 9 with one read-only transaction,
regular-file/sidecar checks and no CatalogStore construction. Do not acquire daemon
ownership, recover work, create/migrate/checkpoint a database, invoke Git/models or parse
connection secrets. Keep the existing aggregate storage report's contract unchanged.

Return a versioned report with capture time and database schema, the total build count,
and bounded generation rows in deterministic database order. Each row contains only:

- Opaque build ID, creation time, status, publication/current flags and direct baseline ID.
- File/status counts, retained raw bytes, span bytes, literal/question document counts
  and code-payload bytes. These are overlapping logical payloads, not reclaimable disk.
- Counts of saved answer attempts, correction versions, code runs and their unfinished
  statuses; include terminal/fenced/purged rows rather than hiding their metadata.
- Incoming baseline references, incoming reused-file references and cross-build correction
  reapplication counts. Keep direct counts separate from transitive reachability.
- Explicit statements that shared FTS statistics can affect other generations and that
  the report does not establish deletion eligibility or promise preserved ranking.

Limit detail to 1,000 generations and 4 MiB of serialized JSON. Count total generations
inside the same snapshot and report truncation/omission explicitly. Aggregate SQL may
scan a large history; this is an on-demand diagnostic, not a polling endpoint. No source
paths/names, raw text, questions, correction statements, per-file payloads, runtime
configuration or provider metadata are emitted. Do not add an `eligibleForDeletion` flag,
“safe bytes” total or an automatic recommendation. Do not infer absence of dependencies
from omitted rows. Malformed/dangling known references must be reported as inconsistent,
not interpreted as unreferenced; unknown schemas fail without mutation.

Acceptance cases for implementation:

1. A three-generation refresh chain shows current pointer, direct baselines and inbound
   reuse counts correctly, without treating the oldest generation as unreferenced.
2. Historical succeeded and failed answers, withdrawn/reapplied notes and retained code
   runs remain counted; embedded citation references are covered conservatively by their
   owning build and are not advertised as fully inspected by SQL counts.
3. Source revocation reduces retained payload and fences derivatives while retaining
   history/reference counts. Policy fencing is not represented as physical deletion.
4. Pending/paused/interrupted operations remain unchanged; a closed catalog and owner
   file remain byte-identical. A live owner continues working; no recovery is triggered.
5. Unicode byte counts, empty and both supported schemas, foreign/missing/symlink paths,
   output limits, dangling references and adversarial labels preserve the stated boundary.
6. The in-memory ranking counterexample remains an explicit limit on interpretation.
   No model or historical evaluation rerun is required for this diagnostic.

This diagnostic can proceed on synthetic inputs without owner testing. It does not
advance the unresolved semantic gates or Workbench integration readiness.
