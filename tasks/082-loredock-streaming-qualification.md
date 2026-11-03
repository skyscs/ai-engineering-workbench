# Task 082 — Uninstrumented streaming snapshot qualification

Status: qualification rejected, 2026-11-03; first-run budget exhausted.

## Scope

Task 081 functionally verifies one opt-in candidate: streaming complete snapshot
headers and manifest hash input with identical results and refusal boundaries.
Start from reviewed head `38a4ac9`. Verify PR #85's exact-head push/pull-request CI
and identical merge tree before the first qualification execution. Production and
all old measured implementations, inputs, results and failures remain unchanged.

Freeze one new owned twenty-source family at a small and near-10,000-file size,
including exact source/byte hashes, typed useful paths and complete support oracle,
before parsing or observing those inputs. Freeze two sequential lifecycles per
size: same process after preparation and a fresh reader of an identical stopped
catalog copy. Both use the unchanged Task 081 candidate and omit profiler/phase/
query/owner instrumentation. Keep ordinary counters, aggregate charge sums and the
unchanged 5-ms outer resource sampler.

Each lifecycle executes default capture, three repeats, selected and isolated
captures, offset-four root paging and history after two replacement analyses evict
the original inventory. Preparation/replacement analyses remain outside read
intervals, but their process residency is not reset or subtracted. Preserve all
original/scope/manifest/work/publication checks and exact cross-process bytes.

Retain the 5,000-ms operation, 1,000,000-work-unit, 150-ms sampled interval, 384-MiB
process RSS and 64-MiB heap-growth limits plus all output limits. No raised caps,
forced GC, idle-until-memory-drops, looped tuning or selective reruns. Verify an
independent tiny full-process regression before committing the measured candidate.
Preserve raw returns/errors before checking resources and integrity separately;
every timeout, missing operation, child/cleanup error and resource failure remains.

## Completion and decision

Execute the frozen qualification once after clean committed checks and no concurrent
heavy work. Retain original results, raw artifacts, identities, logs and exits.
All planned useful/integrity/resource/lifecycle conditions must pass to permit a
separate production integration review. Even success is not semantic/private-pilot
acceptance. Failure leaves the candidate unqualified and requires a separately
scoped evidence-based next decision; never repair the observed family retroactively.

Run strict checks/builds and review both exact-head CI events before merge. Continue
the authorized task sequence after preserving the result. No production feature
change, corporate sources, model calls, old-family reruns or demo operations.

## Preparation checkpoint

Scope `20febd7`; input/protocol freeze `c723cab`. Pure generation records twenty
sources at 580/9,980 files, 557/9,957 code files and 30,557/480,776 UTF-8 bytes.
The constructed 21-fact oracle precedes parser/application observation. The
declared run contains four processes and 32 operations without profiling or
phase/query/owner hooks. No frozen corpus has been prepared or measured yet.

PR #85 merged as `c223c8657b84079fa394b647c6ad7e3ba7105e85` after exact head
`38a4ac9e3423e30cdcf57ba716d3ddc339650b4a` passed push 41631462293 and pull-request
41631494808 CI (519 tests). Its merge tree equals the reviewed head and is included
here. Main is clean and synchronized without a rebuild or demo operation.

The independent two-process regression passes on its first run: all sixteen
operations preserve integrity and lifecycle parity while a deliberately impossible
parent-only time gate fails every resource observation. Both workers exit 0 and
report disabled instrumentation. Exit 7 and watchdog regressions preserve errors
and block the reader without retry. Focused typechecking and the first full check
pass: 521 tests, strict checks and builds on pinned Node 22.23.2. Frozen input,
candidate/baseline hashes, the runner diff and documentation references were
reviewed before this measured candidate checkpoint.

An initial external scaffolding assertion matched `observer.mjs` in an import path
while checking for observer calls, and stopped before writing runner files. The
guard was narrowed to actual observer calls. This tooling error did not execute
the candidate or frozen inputs; no result or protocol was changed.

## First outcome

Measured head `4bccec8668ea32873f6eea48bd5e94e71be35b96` completes all 32 operations
with four successful children, but the coordinator exits 1: 8 integrity passes,
30 resource passes and zero qualified parity comparisons. The authored fixture
expects a complete path through `onIssued`, outside the documented `onMessage`
consumer profile. Twenty useful captures stop at event publication; four dependent
history checks fail because the evaluator has not retained the first receipt for
dependent checks after useful-path refusal.

Independent memory failures also remain: large same-process isolated heap growth
66.666 MiB and history RSS 397.477 MiB exceed 64/384 MiB. No promotion follows from
passing small/fresh-process resources or truncated paths. Separate saved-artifact
readback confirms raw byte parity, original support and matching history without
changing any first score. All evidence and checks are in the
[result record](../docs/fixtures/loredock-streaming-qualification/README.md).

Next: separately repair fixture compatibility review and evaluator independence,
then make an evidence-based decision on remaining same-process allocation/residency.
No broadened consumer rule, old-family rerun or adjusted resource bound is implied.
