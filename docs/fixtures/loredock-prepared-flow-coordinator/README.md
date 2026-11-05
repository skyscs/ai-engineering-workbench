# Ordinary sequence coordinator

The [coordinator](../../../scripts/loredock-prepared-flow/coordinator.mjs) records the
fifteen resource-case IDs in frozen order and consumes a shared marker before invoking
any callback. It is an ordinary development library, not the sealed qualification entry.
The caller must supply all fifteen handlers, explicit dependencies on earlier cases,
and an explicit decision about independence after failure. Later caller mutations cannot
replace the validated sequence. No retry or resume operation exists.

The marker is created exclusively, written fully and fsynced along with its parent
directory. An empty or partial existing marker blocks another output directory too.
The started journal and each case-started record are fsynced before their callbacks.
Two simultaneous attempts sharing the marker execute only one sequence. Abrupt process
exit after the first case starts leaves that consumed marker and the incomplete journal;
it does not create a success report or permit a retry.

A failed required case remains failed. Only explicitly independent later cases with
satisfied dependencies may continue. An unknown exception, invalid evidence or an unsafe
continuation stops subsequent callbacks. Outcomes include every unrun case and its
reason. Nonempty evidence lists bind regular files by byte length and SHA-256; missing
files, path escapes and symlink paths are rejected. These are checks within a trusted
owned evaluation directory, not a sandbox against concurrent hostile filesystem changes.
Callback evidence must be closed and stable before return; the final gate will need its
own complete stopped-tree retention and independent resource assessment.

The shared journal writer now uses a complete Buffer write before fsync instead of
assuming a single low-level write consumed the whole record. Report files use exclusive
creation, and the journal descriptor closes even if final report writing fails. The
durability controls cover process exit and ordered fsync operations; they do not simulate
power loss or promise that all callback-owned files survived a machine failure.

## Verification and boundaries

Eight [tests](../../../scripts/tests/loredock-flow-coordinator.test.mjs) exercise ordered
execution, pre-callback consumption, immutable handler selection, safe continuation after
a failed positive, dependency skips, exceptions, missing evidence, contradictory success,
invalid plans, reserved-family rejection, empty markers, path escapes, symlinks,
simultaneous claims and an actual child exit 7. All raw control directories remain.

The final full repository check passes 970 tests, strict typechecks and production
builds. The unchanged application/input seal verifies 190 application files, 82 emitted
workspace modules and three browser assets. Earlier six-test controls and the 968-test
full check remain recorded. The first complete implementation has a source snapshot;
the earliest incremental focused controls retain logs and outputs without an exact
source snapshot and are not presented as sealed observations.

[records.json](records.json) binds those raw control trees, evidence inventories, logs,
source snapshots and an independent journal/evidence inspection. The inspection checks
all claimed evidence bytes, event order, exactly one journal per shared claim, retained
abrupt starts, report/journal agreement and unchanged raw trees.

The preceding browser lifetime checkpoint is accepted through
[PR #139](https://github.com/skyscs/ai-engineering-workbench/pull/139): push 42011188758 and
pull_request 42011219339 pass 962 tests at exact head
`288aad65b827641cf0ee5709069aa7d2670a69e9`. Merge
`c86041dc0b9be5889479436f29d4ecb7e3aa8f2b` has an identical tree. Both full CI logs are
retained here. Its Chrome memory exceedance remains unresolved.

This library accepts only an `ordinary-` family name. Its caller supplies the shared
marker location; it is not a global registry that prevents a caller from choosing a
different marker. Arbitrary callbacks are not sandboxed or monitored for model/source
activity, so the generic report records those counters as unknown. The controls in this
checkpoint execute no model or candidate source read. Their zero counts come from the
reviewed control code, not from the coordinator's observation.

Even an all-passing callback sequence has `qualification: false` and
`modelEligibility: false`. Application, oracle, limits and source inputs are unchanged.
Actual ordered R01-R15 handlers, full resource assessment and the committed executable,
environment and output seal are still required before the reserved run. Ordinary list
work, browser RSS, startup delay and the required native-positive size failure stay
recorded; this library does not turn them into passes.
