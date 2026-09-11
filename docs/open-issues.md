# Open implementation issues

## AEW-001 — Safe navigation to the local UI returns HTTP 403

Priority: P2. Introduced in Task 001. Fixed in Task 011, merged through PR #12 (9e39d3c).

Previously, the global middleware at apps/daemon/src/app.ts rejected Sec-Fetch-Site: cross-site
even for a user following a link to the HTML UI. Direct navigation returned 200,
but a GET / with navigate/document/?1 fetch metadata returned INVALID_ORIGIN JSON.

Task 011 permits user-initiated top-level GET navigation to non-API UI routes
without an Origin header, preserving Host validation and all API session, Origin
and CSRF checks. Regression tests keep cross-site API requests, frames, untrusted
Origins and mutation requests blocked. See ADR 0015.

## AEW-002 — Codex silently accepts a nonexistent profile

Priority: P1 before profile-based AI Connection execution in Task 008.

Status: mitigated in the Task 008 production adapter. Missing/linked profiles fail
before exec; CLI parsing rejects malformed profiles. Local canary tests confirm
named file loading on CLI 0.154.0. Provider/account identity remains unverified.

Observed with CLI 0.153.4: --profile aew-intentionally-missing-runtime-fixture
did not fail. The synthetic investigation completed with exit code 0. Consequently,
passing a requested profile name is not evidence that the requested configuration
was actually selected, and an absent corporate profile could go unnoticed.

Follow-up: validate that an explicitly selected profile exists and is readable
using the verified CLI version's configuration format before spawning. Default
configuration is an explicit separate selection; never use it as fallback for a
missing named profile. Record requested versus verified configuration accurately.
Do not read authentication secrets to perform this preflight.

The spike now checks a readable regular `<name>.config.toml` file for the verified
CLI version, rejects absent/invalid selections before exec, and asks the CLI to
validate the selected layer through local diagnostics. A synthetic disabled MCP
entry confirmed that the named file was actually loaded. No fallback or model
request occurs in the missing-profile probe. File existence does not certify
provider/account identity or freeze an externally edited configuration.

See docs/fixtures/runtime/resumed-probes.json for the captured probe result.

## AEW-003 — Task summary displays Created for investigation states

Priority: P2. Open; identified during the v0.1 documentation review.

`apps/web/src/Tasks.tsx` renders **Context ready** only for `CONTEXT_READY` and
**Created** for every other task state. The storage projection correctly exposes
`INVESTIGATING` during a full run and `ROOT_CAUSE_READY` when a report exists, so
the summary can contradict the run/report sections after successful publication.

Reproduce: prepare a task, publish an investigation report, and read the summary
under the task description. It says **Created** while **Investigation reports**
shows the published version. During an active investigation the same label is
misleading. This is a display issue, not evidence of lost reports or reset storage.

Workaround: use the status in **Historical investigation** and the report version
selector. The [user guide](user-guide.md#run-and-review-an-investigation) documents
this behavior without promising a UI fix in the documentation change.

Follow-up: explicitly map all supported task states to their UI labels and verify
initial, prepared, investigating, published and failed/cancelled-revision states.
Keep task progress separate from report lifecycle/freshness and from run failure.

## AEW-004 — Default data directory triggers false project-configuration rejection

Priority: P1. Fixed on the configuration-boundary branch; merge acceptance pending.

With worktrees under `~/.local/share/ai-engineering-workbench`, preflight treated
an unrelated `~/.codex` as project configuration and blocked a connection explicitly
using `~/.codex-plus` before any CLI subprocess. Synthetic release fixtures under
`/tmp` did not cover this ancestor layout.

The adapter now pins project discovery to cwd and rejects `.codex` only at declared
worktree roots. Local diagnostics verified the boundary on both supported CLI
versions, including custom markers and named profiles. See
[ADR 0016](decisions/0016-worktree-configuration-boundary.md) for the retained
restrictions and reproducible regression probe. Existing failed runs remain in
history; rebuild/restart the daemon and choose **Run investigation** to retry.
