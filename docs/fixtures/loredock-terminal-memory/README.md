# Terminal memory diagnostic evidence

Task 087 first verifies the complete lifecycle boundary with independent tiny
fixtures, before authoring or observing the fresh large family. These development
attempts are not resource qualification and do not replace any prior score.

## First integration failure

`development-validation.json` identifies all retained files and compressed logs.
The `first-integration/` tree contains both complete raw heap snapshots, metadata,
worker/parent reports, every raw operation/receipt, both parser outputs, stdout,
stderr and process exits. Gzip decompression reproduces each original byte length
and SHA-256. Databases, generated Git repositories and duplicate receipt files
remain local at the recorded original path; they are not needed for offline review.

All eight operations and both heap exports completed. The second offline parser
exited zero and wrote its summary, but the parent rejected a `/proc` sample whose
state was `R` and whose memory section was absent. Task 086 had incorrectly assumed
that absent RSS implied a zombie state. The first attempt remains failed.

Linux [v7.0 proc status implementation](https://github.com/torvalds/linux/blob/v7.0/fs/proc/array.c)
emits the memory section only when `get_task_mm` succeeds; state and memory presence
are not one atomic observation. An exit race is the interpretation of the saved
status and clean parser exit, not a claim about memory ownership. Before the new
freeze, the observer was corrected to record missing samples without fabricated
zeros, stop after child exit, and fail continued unavailability at 100 ms.
Pure regressions cover missing/recovered/malformed samples; actual child and
complete-application regressions verify the process boundary.

The second tiny full-process run passed. Two full checks passed 538 tests, strict
typechecks and builds. The second full check includes exact ordered path, span and
scope checks and deliberate saved-input expectation mismatches. The original failed
result and both graphs remain unchanged.

## Frozen first diagnostic

Input/protocol freeze: `5fc0900`. Measured clean head: `2a1da00`. The single owned
run completed in 330.310 seconds on pinned Node/V8; the worker and two separate
parsers exited zero. The outer probe exited **1**, correctly preserving four failed
operation resource gates. It was not retried. `frozen-validation.json` identifies
all 33 retained raw files, both complete graphs, reports/metadata/receipts, parser
summaries, stdout/stderr/exits and the outer invocation. `frozen-first/` preserves
original bytes with gzip compression. Stopped databases and generated repositories
remain at the recorded local output path. No old family was rerun.

All eight artifact/shape/source checks, seven applicable usefulness checks, three
raw repeat comparisons, evicted history and eight exact complete-path/span/scope
checks pass. All source dependencies are retained; the default and selected paths
reach MongoDB through the supported candidate Kafka chain and reopen ten originals.
The isolated path preserves its unresolved import and five originals.

| Operation | Wall ms | Max sampled interval ms | Peak RSS MiB | Heap growth MiB | Original resource gate |
| --- | ---: | ---: | ---: | ---: | --- |
| first | 3364.624 | 76.285 | 262.367 | 51.425 | pass |
| repeat-1 | 3357.029 | 72.644 | 335.840 | 54.010 | pass |
| repeat-2 | 3304.277 | 80.741 | 358.680 | 19.735 | pass |
| repeat-3 | 3269.005 | 68.295 | 365.813 | **64.104** | fail: heap >64 |
| selected | 3323.751 | 73.009 | **396.813** | 39.917 | fail: RSS >384 |
| page-4 | 3241.418 | 71.331 | **395.059** | 36.614 | fail: RSS >384 |
| isolated | 3309.218 | 75.563 | **395.148** | 18.393 | fail: RSS >384 |
| history | 4.605 | 4.601 | 359.688 | 2.241 | pass |

`readback.json` copies exact observations, limits, process details and group counts.
The independent assessor short-circuits its resource dimension on a failed resource
value. Therefore `observation-readback.json` additionally verifies the saved
no-write/work/output/disabled-hook checks for **all eight** rows, including failed
ones; it does not replace the original failed result or create new resource scores.
History performs no nested path/fact/snapshot reads. Application limits are unchanged.

Both terminal exports and bounded parsers pass. The first graph is 19,761,615 bytes,
203,656 nodes and 847,072 edges; the second is 18,507,694 bytes, 191,941 nodes and
810,407 edges. Both raw hashes are in the manifest and readback.

| Frozen selector | After history | After close/release |
| --- | ---: | ---: |
| File-fact schema objects | 2 | 2 |
| CodePaths | 1 | 0 |
| StreamingCodeAnalysis | 1 | 0 |
| Catalog | 1 | 0 |
| CatalogStore | 1 | 0 |
| SourceGit | 1 | 0 |
| DatabaseSync | 3 | 1 |
| StatementSync | 1 | 1 |

Every displayed path remains `runtime-edges-unclassified`. The service paths in
the first graph include the intentional `state` context and its properties. Their
zero matches after the owning stack returns support that specific release boundary.
They are not a proof that every application/native allocation has been released.

`properties-readback.json` inspects only the already selected graph nodes, outside
the worker, with a 30-second watchdog and 384 MiB V8 old-space limit. Both schema
objects are reached through V8 allocation-site/feedback structures: one has identity
slots containing `system / Hole`; the other has only the schema field. Neither has
`facts` or `ranges`. This is consistent with runtime object templates, not thousands
of retained per-file fact payloads. After release, the remaining DatabaseSync and
StatementSync matches are in `fast_template_instantiations_cache` and have no
`javascript_to_native` edge; the two pre-release database instances have that edge.
These structural observations do not measure native database bytes or prove leaks.

The first export changes heap-used from 120,087,952 to 37,365,344 bytes and RSS from
377,159,680 to 250,359,808 bytes. The second leaves heap-used at 36,589,656 bytes.
Collection/export is intrusive, and the first snapshot perturbs the second. These
values cannot estimate ordinary shutdown savings or waive earlier resource failures.

## Decision and review

No unexpected retained application owner was identified by the frozen selectors.
The evidence supports investigating transient request ownership, not adding a
long-lived cache or forced collection. The next bounded candidate is **request-local
compaction of already validated payload entries**: retain facts/ranges/evidence and
all domain/gap/fence inputs, while dropping duplicate identity fields after recording
the consumed hash. First prove exact semantic equivalence on independent tiny and
adversarial cases; then separately freeze a fresh uninstrumented full lifecycle
qualification. Memory improvement is a hypothesis, not a result of this diagnostic.

Full source/diff/link/hash review preserves all frozen input and measured modules.
One formatting finding remains in frozen `run.mjs:107`: a whitespace-only line.
It has no runtime effect; changing it would invalidate the recorded baseline hash.
The first integration failure and all four large resource failures remain visible.
No production code, user data, models or corporate sources were used or changed.
