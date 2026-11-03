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
internal inspector session must not open a network debugger or force collection.
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
