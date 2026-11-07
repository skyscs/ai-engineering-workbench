# ADR 0070 — Review the complete runtime before extending the tiny executor

Status: accepted for the bounded next implementation after Task 163 CI acceptance.
No new executor, namespace recipe, live attempt or application qualification is approved.

Task 162 is accepted through [PR #195](https://github.com/skyscs/ai-engineering-workbench/pull/195),
head `c32205ea5823ebf320cd38b4b041f417b3f15f0c`, identical-tree merge
`b6e71b2a523cd95867e6eb128e24cc6a199ba50f`. Both complete exact-head CI logs pass
1,237 Node tests, ten Python suites, ten typechecks and ten final builds. Its sole
[tiny result](../loredock/STAGED_COUNTER_PREREQUISITE_RESULT.md) remains consumed and PASS.
The [review evidence](../fixtures/loredock-complete-executor-layout/README.md) preserves
those logs, source bindings and this review's read-only observations.

## Decision

Keep the v2 contract, creation-ordered counters and all earlier results unchanged.
Stop treating the one-probe command as a prospective complete application launcher.
It has no common isolated network, populated daemon/browser/control composition or
complete descendant/collector lifetime proof. Its two unused roles do not establish
role accounting for an application.

The [complete layout review](../loredock/COMPLETE_EXECUTOR_LAYOUT.md) specifies the
required topology and evidence gaps. Neither three independent copies of the tiny
sandbox command nor a launcher inside its control-rooted cgroup namespace supplies
that topology. A different joining mechanism would require an explicit offline
implementation review and a separately sealed tiny gate. This is a stop on extending
the **unchanged recipe**, not an observed denial of all possible Linux compositions.
Do not conduct exploratory namespace/browser launches to choose a passing recipe.

The existing browser flag `--no-sandbox` was explicitly retained by
[ADR 0066](0066-loredock-independent-browser-container.md). Preserve that history and
report the absent Chromium inner sandbox. The external boundary still needs its own
proof. This review neither introduces that flag nor silently removes it, relaxes
nested-userns restrictions, installs a setuid helper or declares equivalence to a
normally sandboxed desktop Chrome. Changing the browser policy would require a new
prospective decision; no historical score changes.

Resolve a concrete, independent integration problem next: the frozen controlled
bootstrap manually constructs services and predates production's asynchronous parser
readiness and unified shutdown. It cannot stand in for the current emitted server.
[Task 164](../../tasks/164-loredock-controlled-server-parity.md) adds a narrow internal
TextRuntime injection to the existing production server owner and a **new** controlled
test launcher that uses that owner. Keep the frozen launcher and consumed families intact.
Use ordinary model-free lifecycle tests; this is functional parity, not a resource run.

## Why this order

A shared namespace launcher cannot repair a stale application bootstrap. Fixing the
small dependency seam first removes a duplicated lifecycle and gives later controlled
tests the same parser admission, listen and actual shutdown path as normal startup.
It requires no host configuration, new runtime, namespace authority, model call or
resource-contract amendment. Native executor expansion stays unqualified while useful,
bounded functional work proceeds under ADR 0068's independent-work provision.

Before any later full-runtime attempt, separately close the review's shared communication,
ancestor-control, orphan/interruption, final retention and outside-cost gates. Then pin
the resulting emitted application and controlled adapter afresh. A previous tiny PASS,
an offline assessor PASS or ordinary CI cannot substitute for those observations.
L5, answer semantics, private-project acceptance and the Workbench bridge remain separate.

## Validation

Task 163 changes documentation and retained review evidence only. No service, cgroup
counter read, namespace capability probe, application, browser or model is started.
Check all local document links, immutable contract/assessor/API hashes, source and archive
bindings and the complete diff. Review both complete exact-head CI logs before merge.
Agent review and merging do not constitute independent human semantic acceptance.
