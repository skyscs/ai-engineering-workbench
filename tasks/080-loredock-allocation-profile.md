# Task 080 — Targeted complete-capture allocation profile

Status: in progress, 2026-11-03.

## Baseline and scope

Task 079 completed its paired controls with 48/48 integrity passes, four exact
process comparisons and nine resource failures. Preparation/phase hooks alone do
not explain first-capture heap growth; counts cannot distinguish payload/domain,
snapshot, SQL and async allocations. All old code, inputs and results remain frozen.
Start from Task 079's reviewed result head `336dd85`; verify PR #83's exact-head
push/pull-request CI and merge before collecting a profile.

Prepare one new owned twenty-source near-limit corpus and freeze exact counts,
hashes, expected useful paths and profiler protocol before implementation. After
preparation closes all owners, start one fresh reader on a verified stopped copy.
Collect one local V8 sampling allocation profile around one complete first capture,
including original validation and publication. Capture preparation/module loading
and profile serialization are outside the sampling interval. No broad three-arm
matrix, repeats, history profiling or resource qualification is included here.

Use the existing unchanged capture/path/receipt implementation and limits. An
internal inspector session must not open a network debugger or explicitly request
collection. The pre-observation revision below declares backend collection at export.
Declare interval, collected-object policy, raw profile/summary bounds, watchdogs,
phase scope and interpretation limits before observation. Validate support with
independent tiny regressions, including failure/cleanup paths. Retain the first raw
profile, errors, result, source/hash checks, process arguments and stdout/stderr/exit.
An incomplete/refused capture or profiler failure remains explicit; never rerun it
or raise a bound to complete the profile.

## Acceptance and decision

Verify the complete first receipt's typed paths, original support and source scope
independently of profiling. Validate profile structure and sampled stack ownership;
attribute by inspectable stack locations, retaining unattributed/internal samples.
Do not interpret samples as exact retained-object bytes, native RSS attribution,
a leak proof or resource acceptance. Existing resource failures remain binding.

Select at most one bounded next candidate if allocation stacks and source ownership
support it. Preserve all integrity/completeness/work/publication fences; a later
candidate still needs independent regressions and a fresh uninstrumented resource
qualification covering complete capture and history lifecycles.

No production changes, corporate data, model calls, user-demo operations or old
matrix reruns. Complete strict/relevant tests/builds and both exact-head CI events
before merge, then continue the already authorized task sequence.

## Preparation checkpoint

Scope `d58d2f9`; input/protocol freeze `c34cece`. Pure generation confirms twenty
sources, 9,940 files, 9,917 code files and 509,091 UTF-8 bytes. The 21-fact useful
path/original oracle was authored before parsing or candidate observation. The
protocol declares one fresh capture, 32-KiB V8 sampling with both collected-object
flags, explicit profile/summary bounds and no resource-acceptance claim.

PR #83 merged as `3c294434a3eb189c92a324ebc88cb2c656795deb` after exact head
`336dd85bbf86297a69293fe8f9a9deef0af44a77` passed push 41624889057 and pull-request
41624946975 CI (509 tests). The merge tree equals the reviewed head and is included
here. The primary checkout is clean, with no rebuild or demo operation.

Independent inspector sampling/cleanup/summary tests and the complete two-process
locker regression passed on their first runs. The integration preserves profile
data, source-supported receipt bytes, child errors and watchdog exits. Focused
typechecking and full checks precede the candidate commit and its single profile.
No frozen input has been parsed or observed yet.

## Pre-observation protocol correction

The first full check failed on the tiny independent regression: four returned
allocation samples referenced a node absent from V8's exported tree. Its receipt
remained correct. Pinned runtime source also shows that inspector sampling forces
collection when retrieving a profile, contrary to the original protocol assumption.
No frozen device input has been prepared, parsed or measured.

[Revision 2](../fixtures/loredock-allocation-profile/PROTOCOL_REVISION_2.md) prospectively
declares backend collection/export overhead and explicit unmapped-sample accounting.
The original freeze remains unchanged. Structural failures and all bounds remain;
unknown weights cannot be assigned to an application hotspot or used for acceptance.
Raw failure/profile/exit bytes and the first failed full check are retained under
`docs/fixtures/loredock-allocation-profile-development/`. The amended protocol must
be committed before implementing its handling and before the single frozen profile.

Revision `59ef02b` was committed before the amended handling. The revised summary
reports unmapped counts/weights and partial reference status without inventing nodes;
the original failing profile reads back as four unknown samples weighing 147,416
reported bytes. The sampled allocation unit tests and fresh-process integration now
pass. The first failure remains preserved. Final `pnpm check` passed all 515 tests,
strict typechecks and builds on pinned Node 22.23.2. No frozen device data has been
generated through application services or measured. This checkpoint precedes the
committed candidate and its one permitted profile execution.
