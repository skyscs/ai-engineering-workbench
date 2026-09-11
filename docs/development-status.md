# Development status

## Post-v0.1 correction — configuration discovery boundary

Status: verified locally, merge acceptance pending. Scope: AEW-004; see
[ADR 0016](decisions/0016-worktree-configuration-boundary.md).

The default Linux data layout exposed a false preflight rejection: an unrelated
user `.codex` ancestor blocked a saved alternative configuration directory. The
adapter now pins CLI project discovery to cwd and retains `.codex` rejection at
every selected worktree root, including secondary roots and symlink entries.

Validation: `pnpm check` passed with 133 tests (17 Git, 14 adapter, 40 storage,
52 HTTP/service and 10 script tests), strict typechecks and production builds.
The synthetic boundary probe passed on Codex CLI 0.153.4 and 0.154.0 for base and
named profiles, custom markers, malformed ancestors and retained project-local
rejection. A local saved-run preflight also passed with the selected configuration;
the idle manual daemon was restarted with the build and its failed-run history
remained unchanged. These checks made zero model requests; a new investigation
remains an explicit user action. Browser UI code and database schema are unchanged.

## Current baseline

Tasks 000–011 are accepted. PR #12 merged v0.1.0 into main as `9e39d3c`.
For current usage, see the [user guide](user-guide.md); for verified scope, see
[release acceptance](release-acceptance.md). The task sections below preserve
historical implementation and verification notes; their descriptions of next steps
refer to the stage at which those notes were recorded.

## Task 001 — Bootstrap local shell

Status: accepted through the user's merge of PR #1 into main (aa56532).
The P2 navigation finding remains open; see [open issues](open-issues.md).

Implemented: pinned Node/pnpm baseline, dependency lockfile, recursive workspace
build, test/CI commands, local session and CSRF protection, exact Host/Origin
checks, JSON API fallback, strict Vite port, graceful daemon shutdown.

Verification completed so far:

- Node 22.23.2 and pnpm 10.15.0 installation; official Node archive SHA-256 checked.
- Strict typecheck across all eight packages/apps, seven passing HTTP behavior
  tests, and complete production build.
- Real production HTTP health response and headless Chrome rendering
  `Local daemon connected.` with session bootstrap.
- Second daemon exits with status 1 and an actionable occupied-port error.
- Clean source copy: frozen-lockfile installation from the package store,
  full typecheck, all seven tests and production build passed.
- Headless Chrome loaded the development UI through Vite proxy and rendered
  `Local daemon connected.` with the protected session endpoint.
- SIGTERM closed the production daemon with exit status 0.

GitHub Actions run 34364370559 passed for f7359a9. The shell's system Node 18
was not changed; verification used an isolated Node 22.23.2 toolchain. Developers
must select the pinned Node version before running project commands.

## Task 000 — Runtime feasibility

Status: accepted through the user's merge of PR #2 into main (6b9a967).

The user selected the current Codex CLI configuration, `gpt-5.6-terra`, with
reasoning effort `medium`. Do not ask for this selection again on resumption.

Confirmed: CLI 0.153.4, synthetic fixture generation, read access to both repositories
and the artifact, and denied writes (EROFS) in all three fixture directories.
The initial invocation failed at the account usage limit. After resumption, a real
investigation completed and correctly identified the cross-repository timeout-unit
regression with evidence from both repositories and the log.

Explicit cancellation and timeout probes passed with unchanged fixtures and no
remaining owned process group. Both returned CLI exit code 0, so the requested
stop reason must take precedence over the process code. Recoverable connection
error events were also observed before a successful turn.

The raw CLI accepted a nonexistent profile. The spike now checks profile-file
existence/readability and CLI parsing before exec; missing profiles cannot fall
back to the default connection. A local canary confirmed named file loading.
Unsupported-option returned the expected error. Isolated `codex login status`
confirmed missing-login detection without accessing user credentials or calling
a model; expired-token failures during exec remain synthetic test coverage.

The selected configuration has no enabled MCP servers, and the restricted feature
flags were confirmed through CLI diagnostics. Enabled MCP configurations are
rejected before exec. External notification commands are disabled per invocation.
A fresh real investigation passed after these launch changes, with unchanged
sources/Git state and no remaining owned process group.

Validation: `pnpm check` passed, including strict typechecking, seven HTTP tests,
seven runtime tests and the production build. Opt-in local negative probes passed.

See [runtime compatibility and evidence](runtime-feasibility.md) for commands,
supported restrictions and Task 008 obligations.

## Task 002 — Local storage foundation

Status: accepted through the user's merge of PR #3 into main (d8d4bf2).

Implemented: platform data-root resolution with `AEW_DATA_DIR`, private managed
directories, built-in SQLite, foreign keys, WAL, bounded busy timeout, transactional
versioned migrations with checksums and newer-schema refusal. A separate SQLite
ownership lock rejects another daemon and releases on process death.

The daemon initializes storage before listening, releases it on bind failure and
shutdown, and exposes session-protected `GET /api/storage` without local paths.
ADR 0005 records the driver choice and future file-operation recovery contract.
Node 22.23.2 remains pinned; the minimum version is now 22.13 for `node:sqlite`.

Validation: strict typecheck and production build passed; 11 SQLite/path/
process tests, 8 HTTP tests and 7 runtime tests passed. Production-to-development
restart smoke preserved migration history; same-root startup was rejected and an
occupied-port failure released storage ownership. Graceful SIGTERM exited 0.
Clean source installation from the frozen lockfile and local package store passed
the complete `pnpm check` (26 tests). Headless Chrome with a fresh profile rendered
`Local daemon connected.`. No test used the normal application data directory.

The P2 navigation issue AEW-001 remains tracked separately; no change to its
behavior is included in Task 002.

## Task 003 — Workspaces and AI connection metadata

Status: accepted through the user's merge of PR #4 into main (8134f14).

Implemented: domain validation, schema version 2, workspace/owned-connection and
model-profile persistence, protected CRUD API and browser forms. Connection/profile
ownership cannot be reassigned. A persisted boundary lock prevents launch-setting
changes and workspace deletion; Task 006 must integrate it atomically with
first-task creation. ADR 0006 resolves one connection per workspace and documents
the later repository/task deletion requirements.

The UI distinguishes configured metadata from a verified runtime. No Codex
subprocesses, credential reads or model invocations are introduced. Model IDs stay
opaque; optional settings explicitly select CLI defaults.

Validation: a clean source copy installed from the frozen lockfile and local
package store passed the complete `pnpm check`: strict typecheck, 18 storage tests,
11 HTTP tests, 7 runtime tests and the production build. Tests include rollback of
the connection after an injected workspace-insertion failure and upgrade from
schema version 1 with its migration record preserved. Real Chrome checks passed for creation,
connection/profile edits, rename, persistence through production-to-development
daemon restart, a 390px viewport and workspace deletion confirmation/cancellation.
The [browser result](fixtures/workspaces/browser-result.json) contains synthetic
fixture outcomes only. No test used the normal application data directory.

## Task 004 — Repository registry

Status: accepted through the user's merge of PR #5 into main (9dadec4).

Implemented: system Git adapter, schema version 3, protected registration/clone
APIs, repository list/detail forms, persisted clone lifecycle and restart recovery.
Canonical checkout/common git-dir identities are recorded; ownership and duplicate
checks protect workspace boundaries. Workspace deletion is blocked while repository
records exist. ADR 0007 documents process/authentication limits and managed cleanup.

Existing checkouts are inspected without modifying HEAD, index, working files or
configuration. Managed clones use staged directories without checkout, templates
or shared objects. Failures preserve redacted stderr/status. Graceful shutdown
stops owned Git processes; abrupt restart retains recorded paths for inspection.
No fetch or task-worktree behavior is introduced.

Validation: a clean source copy installed from the frozen lockfile and local
package store passed strict typecheck, all 50 tests (7 Git, 20 storage, 16 HTTP,
7 runtime) and the production build. Git 2.53.0 / Node 22.23.2 were used locally.
The transport/SSH regression confirms protocol restrictions after URL rewriting
and invocation of a configured SSH command with noninteractive options.
Chrome on the clean build passed registration, successful and failed clone,
dirty-state preservation, restart persistence, mobile layout and blocked workspace
deletion. No test used normal application data or an AI invocation.
The [browser result](fixtures/repositories/browser-result.json) uses synthetic data.

A separate [real SSH clone](fixtures/repositories/remote-clone-result.json) of
`git@github.com:skyscs/ai-engineering-workbench.git` through the new service reached
`ready` at merged main 8134f14 in an isolated data root. It used the session's
existing `ssh -F /dev/null` override; no SSH configuration or credentials were
changed. HTTPS authentication was not exercised against a real remote.

AEW-001 remains open and
unchanged. Repository removal and non-Linux process/durability support remain
outside the verified Task 004 scope.

## Task 005 — Repository synchronization

Status: accepted through the user's merge of PR #6 into main (be6cc72).

Implemented: explicit protected sync endpoint, persisted running/terminal states,
separate attempt and successful-fetch timestamps, UI action/status/diagnostics,
no-remote metadata refresh and startup interruption handling. Git validates
canonical paths, all remote refspecs and supported symbolic refs before fetch;
common git-dir locks cover linked checkouts and registrations across workspaces.
ADR 0008 records the conservative supported configuration and partial-failure rules.

Validation: a clean source copy installed from the frozen lockfile and local store
passed strict typecheck, all 59 tests (11 Git, 22 storage, 19 HTTP, 7 runtime) and
the production build. Fixtures verify dirty files/index/HEAD/FETCH_HEAD, local
branches/tags/task pins, upstream advances/prune, dangerous mappings, redirected
paths, partial remote failure, linked-checkout contention, shutdown and schema
version 3 upgrade. No normal application data or external credentials were used.

The browser scenario passed no-remote refresh, fetch/prune, a later fetch failure,
preserved last-success time and restart persistence, with no horizontal overflow
at 390px. See the [recorded browser result](fixtures/synchronization/browser-result.json).

AEW-001 remains unchanged. Tags/custom refspecs and automatic retries are outside
the supported sync policy; interrupted attempts require inspection before retry.

## Task 006 — Tasks, immutable artifacts and stage run foundation

Status: accepted through the user's merge of PR #7 into main (bf3cef4).

Implemented: schema version 5, task creation with owned repository associations,
atomic workspace boundary lock, protected API and browser task forms. Streamed
file imports use generated paths, exact byte counts/SHA-256, configurable quotas,
durable staging and recorded recovery. Downloads reject redirected paths and use
attachment disposition/nosniff. Explicit UTF-8 byte ranges preserve originals;
unsupported files and unverified images remain excluded from analysis.

Minimal internal StageRun storage persists immutable task/context/profile snapshots,
ownership, busy guards, normalized failures and lifecycle timestamps. Profile edits
preserve historical inputs; referenced profiles cannot be deleted. Startup interrupts
unfinished runs. ADR 0009 records implementation decisions and integration duties
for worktree/runtime/result tasks. There is no public AI execution endpoint yet.

Validation: a clean source copy installed from the frozen lockfile and local store
passed strict typecheck, all 73 tests (11 Git, 34 storage, 21 HTTP, 7 runtime) and
the production build. Fixtures cover schema version 4 upgrade, task/lock rollback,
cross-workspace selection, immutable snapshots, terminal transitions, duplicate
and traversal filenames, missing sources, quota violations, disconnects, injected
disk-full writes, SIGKILL during upload, staging/rename recovery and file/link
integrity. No normal application data or model invocations were used.

Chrome acceptance creates a task with two repositories, imports a log and PDF,
saves explicit text context, removes source files and downloads preserved bytes.
Production-to-development restart preserves task/artifact/context metadata and
the boundary lock. The 390px viewport has no horizontal overflow. See the
[browser result](fixtures/tasks/browser-result.json).

At acceptance, the next task was 007 — detached task worktrees and durable repository pins. Initial
repository metadata is not yet a prepared worktree. Task edit/delete, image runtime
integration and investigation execution remain deferred. AEW-001 is unchanged.

## Task 007 — Isolated task worktrees

Status: accepted through the user's merge of PR #8 into main (9e233e1).

Implemented: schema version 6, editable unresolved base refs, detached task
worktrees with immutable resolved SHAs and retained app-owned revision pins,
persisted preparation/cleanup StageRuns, protected API and readiness UI.
Only fully prepared tasks expose `CONTEXT_READY`. Investigations require ready
members and snapshot their worktree paths, pins and commits.

Synchronization and worktree operations share the same common Git directory
lock. Retries reuse verified completed members after partial failure. Cleanup
requires a canonical owned, registered, detached and clean worktree with no active
run. Modified/untracked/ignored files, hidden index flags, redirected paths,
unknown directories and mismatched pins are refused. Cleanup retains revision
pins and never force-deletes or globally prunes. Startup reconciles recorded state
without creating or deleting worktrees. ADR 0010 documents the lifecycle.

Validation: a clean source installation from the frozen lockfile passed strict
typecheck, all 88 tests (17 Git, 36 storage, 28 HTTP, 7 runtime) and production
build on Node 22.23.2 / Linux. Tests cover dirty source preservation, tasks sharing
a branch base, retained pins after cleanup and GC, partial failure/retry, ownership,
stale operations, version 5 upgrade, completed creation/removal with pending
metadata, and shutdown during preparation or startup reconciliation.

CI exposed inherited system checkout filters in its runner. The adapter now
honors an explicit `GIT_CONFIG_NOSYSTEM=1` while continuing to reject arbitrary
config injection. A synthetic system-config regression verifies isolated fixtures
and confirms that ordinary configured filters still trigger the supported-policy
error.

Chrome acceptance passed two-repository preparation, base-ref failure/correction,
dirty cleanup refusal, clean cleanup, pin retention, recreation, restart persistence
and a 390px viewport. See the [browser result](fixtures/worktrees/browser-result.json).
No normal application data or AI invocation was used.

At acceptance, the next task was 008 — the production Codex CLI runtime adapter, including the Task 000
compatibility and no-fallback requirements. Automatic submodule initialization,
custom checkout filters, task revision changes and force repair remain outside
Task 007. AEW-001 remains unchanged.

## Task 008 — Codex CLI runtime adapter

Status: accepted through the user's merge of PR #9 into main (4936d85).

Implemented: AIRuntime, production Codex CLI adapter, deterministic FakeRuntime,
verified-version/profile/tool preflight, read-only launch and owned process
supervision. CLI 0.154.0 was installed when this task resumed; its compatibility
was checked independently of the earlier 0.153.4 spike. Named profiles fail closed,
MCP configuration is checked without executing servers, and project configuration
that could override routing is rejected. Configuration metadata is fingerprinted;
credentials and raw configuration output are not read or persisted.

Schema 7 stores immutable launch metadata, monotonic bounded events and atomic
validated preview publication. Protected start/detail/cancel/SSE endpoints support
reconnect and explicit retry. The browser exposes model selection, diagnostics,
cancellation and the preliminary result. Task state remains CONTEXT_READY; Task 009
supplies the evidence-backed investigation/root-cause workflow. ADR 0011 records
this boundary and delivery of selected UTF-8 ranges through stdin.

Review added an explicit canonical `configHome` per connection (schema 8, ADR 0012).
Every diagnostic/model subprocess receives that directory as `CODEX_HOME`, with
no inherited/default fallback. Missing or redirected directories and known ambient
OpenAI credential/routing overrides fail before spawning. Old connections migrate
as unbound; one-time binding requires no AI history and no active StageRun.
Snapshots remain immutable. The UI displays the directory before launch and blocks
AI until it is saved. No additional model request was made for this review change.

The initial implementation passed a clean frozen-lockfile installation and full
check (103 tests). After the directory review, `pnpm check` passed strict typecheck,
108 tests (17 Git, 11 adapter, 38 storage, 35 HTTP, 7 spike) and production build on
Node 22.23.2 / Linux. New coverage verifies selected versus inherited homes in every
subprocess, pre-spawn rejection, schema 7 upgrade, one-time binding, SQL boundary
enforcement and preserved historical snapshots. Existing tests include
chunked UTF-8, malformed/truncated JSONL, schema failures, nonzero exits, recoverable
errors, output limits, missing/linked/changed profiles, enabled MCP, timeout,
separate-session descendant cancellation, selected artifact ranges, protected SSE,
reconnect, duplicate starts, cancellation/publication races, transaction rollback
and persisted restart interruption.

A real adapter invocation before the directory review completed through RuntimeService
using `codex`, the inherited `.codex-plus` configuration home, gpt-5.6-terra and medium.
The recorded safe configuration fingerprint matched that home rather than `.codex`;
this does not establish authentication/account identity. It identified the
synthetic cross-repository seconds/milliseconds mismatch, cited both histories and
used the selected log. Source/Git snapshots were unchanged. Local 0.154.0 negative
probes and read-only write-denial probes also passed. See the
[reviewed runtime evidence](fixtures/runtime-adapter/real-result.json).

Chrome passed the two-repository task path with a synthetic executable through the
production adapter: model selection, preview, redacted failure diagnostics,
cancellation, retry, retained prior output, event replay, production-to-development
restart and 390px layout. No model request was used by automated/browser tests.
The browser check was repeated after the directory review and also passed unbound
run blocking, one-time binding, saved-directory display/locking and run snapshot
persistence. See the [updated browser result](fixtures/runtime-adapter/browser-result.json).

GitHub CI runs the same checks on the task PR; the browser and real CLI evidence
are separate opt-in acceptance checks.
AEW-002 is mitigated by the production preflight; AEW-001 remains unchanged.
Next task: 009 — investigation workflow and validated evidence locators.

## Git handoff

- Initial artifacts: `main`, commit `d51b051`.
- Task 001: `task/001-bootstrap`, f7359a9, merged through PR #1 as aa56532.
- Task 000: `task/000-runtime-feasibility`, e37635d, merged through PR #2 as 6b9a967.
- Task 002: `task/002-local-storage`, c8ca418, merged through PR #3 as d8d4bf2.
- Task 003: `task/003-workspaces`, 4d07a77, merged through PR #4 as 8134f14.
- Task 004: `task/004-repository-registry`, 3aae7ec, merged through PR #5 as 9dadec4.
- Task 005: `task/005-repository-sync`, 137c495, merged through PR #6 as be6cc72.
- Task 006: `task/006-tasks-and-artifacts`, aec25bd, merged through PR #7 as bf3cef4.
- Task 007: `task/007-isolated-worktrees`, 7c48eff, merged through PR #8 as 9e233e1.
- Task 008: `task/008-codex-cli-runtime`, 62abf01, merged through PR #9 as 4936d85.
- Task 009: `task/009-investigation-and-evidence`, 257bb98, merged through PR #10 as af4c820.
- Task 010: `task/010-human-intervention-and-revision`, fc17306, merged through PR #11 as 18e621f.
- Task 011: `task/011-v01-hardening-and-dogfood`, 6982e84, merged through PR #12 as 9e39d3c.

## Task 009 — Investigation and evidence

Status: accepted through the user's merge of PR #10 into main (af4c820).

Implemented: the versioned workflow prompt/schema, paired investigation/root-cause
output, deterministic evidence validation, schema 9 immutable report aggregates,
atomic output/success publication and durable workflow-state projections. Protected
investigation/report/evidence APIs reuse the existing runtime cancellation and SSE.
The UI renders safe prose, timeline, root cause, unresolved questions, evidence
sources and selectable versions. Context changes mark reports stale; failures and
restart interruption preserve earlier content. Legacy previews remain unchanged.

A clean frozen-lockfile installation passed strict typecheck, 116 tests (17 Git,
11 adapter, 39 storage, 42 HTTP/service, 7 spike) and production build on Node
22.23.2 / Linux. Tests cover malformed pairs, missing references, path traversal,
foreign repositories/artifacts, unavailable/future commits, ancestor history,
invalid line/UTF-8 ranges, changed artifact hashes, symlinks/binary files, retained
pins after cleanup, cancellation, publication rollback, restart and schema 8 upgrade.

Chrome on the clean build passed two versions, prior-report preservation after
invalid evidence/failure/cancellation, retry, pinned source navigation, unsafe
HTML/link handling, configuration binding, event replay, restart and 390px layout.
No model request was used by automated/browser tests. See the
[browser result](fixtures/investigation/browser-result.json).

One real Codex CLI 0.154.0 invocation explicitly bound the selected personal
configuration directory and used gpt-5.6-terra with medium effort. It correctly
identified the seconds/milliseconds contract mismatch across two synthetic
repositories, published version 1 at ROOT_CAUSE_READY and reopened all five evidence
locators (files, commits and the selected incident log). Source/Git snapshots stayed
unchanged. Account identity is not certified by selecting a directory. Reviewed
[evidence](fixtures/investigation/real-result.json) excludes local configuration
paths, fingerprints, credentials and raw diagnostic payloads.

Persistent constraints/challenges and richer revision history are implemented in
Task 010 below. Markdown export and the three release investigations remain Task 011. AEW-001 is
unchanged. Locator validity does not prove the model's causal explanation.

See [ADR 0013](decisions/0013-investigation-pairs-and-evidence.md) for publication,
state, locator and rendering contracts.

## Task 010 — Human intervention and revision

Status: accepted through the user's merge of PR #11 into main (18e621f).

Implemented: protected challenge/constraint APIs and UI, schema 10 persistent
interventions and constraints, exact previous-report snapshots, immutable run
provenance and atomic revision publication. Constraints apply to every subsequent
run; saving/deactivation starts no AI and marks dependent results stale. Duplicate
submission IDs, obsolete context revisions, superseded targets and concurrent runs
are rejected. Failed/cancelled revisions retain the last successful report. History
shows the triggering text, attempt diagnostics and resulting versions.

Persisted dependency edges and recursive, task-scoped invalidation cover report and
root-cause results. Synthetic downstream nodes verify transitive invalidation and
cycle termination without implementing future workflow stages. Migration preserves
schema 9 snapshots and reports, with null provenance for earlier runs.

A clean frozen-lockfile installation passed strict typecheck, 125 tests (17 Git,
11 adapter, 40 storage, 50 HTTP/service, 7 spike) and production build on Node
22.23.2 / Linux. Coverage includes constraint carry-forward and limits, duplicate
submissions, ownership, rollback, failed/cancelled publication, restart interruption,
immutable history, deactivation, transitive invalidation and schema 9 upgrade.

Chrome on the clean build passed constraint saving without a run, failed and
cancelled challenges, successful revision with exact prior-report/context snapshots,
constraint deactivation, unchanged earlier versions, restart persistence and 390px
layout. The browser fixture explicitly waits for the terminal UI refresh and a new
run ID before testing retry/cancellation. See the reviewed
[browser result](fixtures/interventions/browser-result.json). Nine synthetic runtime
attempts were exercised; no real model request was made for Task 010.

ASK, ADD_CONTEXT and OVERRIDE remain reserved domain types and return an explicit
unsupported-action error. Constraints are model instructions, not filesystem
permissions. The three real release investigations and Markdown export remain
Task 011. AEW-001 is unchanged.

See [ADR 0014](decisions/0014-human-interventions-and-invalidation.md) for
submission, provenance, constraint and dependency contracts.

## Task 011 — Hardening and release acceptance

Status: accepted through the user's merge of PR #12 into main (9e39d3c).

Implemented: chosen-version Markdown export with original run/context provenance,
evidence locators and source-availability checks, escaped/redacted prose and protected
attachment responses. AEW-001 safe top-level navigation is fixed with API/frame/
mutation regression coverage. Private package and health versions are 0.1.0. The
Linux source-build demo, backup/restore constraints, release rubric and three generated
histories are documented; no installer, registry publication or release tag is created.

A clean offline frozen-lockfile installation passed strict typecheck, 130 tests
(17 Git, 11 adapter, 40 storage, 52 HTTP/service, 10 fixture/spike) and production
build on Node 22.23.2 / Linux. New tests cover export ownership, headers, chosen
versions, provenance, redaction/escaping, unavailable sources, protected navigation,
and executable reproduction of all three known historical defects. Earlier recovery,
cancellation, rollback and boundary tests remain the release regression gate.

Chrome on the clean build passed the full workspace/task/revision path, actual
Markdown downloads for v1 and a challenged v3, escaped unsafe prose, retained history,
restart and 390px layout. Nine synthetic runtime attempts used no real model calls.

Three real acceptance cases completed through production services with CLI 0.154.0,
the explicitly selected personal configuration directory, gpt-5.6-terra and medium:

- Single repository: correctly identified premature price rounding and excluded a
  later documentation change.
- Two repositories: identified the producer's milliseconds-to-seconds change and
  unchanged consumer's millisecond interpretation.
- Human revision: v1 separated a real tenant-isolation defect from unverified incident
  causality; after new log context, a persistent constraint and challenge, v2 explained
  the observed cross-tenant cache hit and resolved the earlier uncertainty.

These were four successful real model invocations. All 25 published evidence locators
reopened, source hashes and checkout state stayed unchanged, and report persistence
and SQLite integrity/foreign-key checks passed. The first launch configuration attempt
failed at executable validation before a model call; no silent fallback or automatic
paid retry was used. Quality review was performed by the implementation agent against
known history; user acceptance remains separate. See the [reviewed reports and results](fixtures/release/README.md).

Limitations: Linux and the two supported CLI versions only; trusted local repositories
and CLI configuration; no verified account identity or exact outbound audit; export
redaction is not complete secret detection. Backup/restore requires external sources
and the same canonical paths. No automatic session resume, implementation stages or
reserved ASK/ADD_CONTEXT/OVERRIDE actions. AEW-002 remains mitigated by preflight.

See [release acceptance](release-acceptance.md), [Linux demo](linux-demo.md),
[report export](report-export.md) and [ADR 0015](decisions/0015-report-export-and-release-acceptance.md).

## v0.1 documentation follow-up

Status: locally verified, awaiting PR review and merge, 2026-09-11.
Branch: `docs/v01-readme-and-user-guide`, based on `9e39d3c`.

The README now describes implemented capabilities and prioritizes a production
quick start. A separate user guide covers exact UI controls, expected outcomes,
synthetic examples, revision, export, recovery and troubleshooting. START_HERE and
Linux operations link to that guide; current feature references distinguish legacy
previews from full reports and remove obsolete next-iteration claims. API session
mechanics moved from the README into a dedicated reference. Historical acceptance
artifacts remain unchanged. AEW-003 records the task-state display issue separately;
this documentation update changes no application behavior.

Verification: the documented `pnpm build` passed on Node 22.23.2; all three
release-fixture behavior tests passed; 178 local links and anchors across 60
Markdown documents resolved. UI labels and workflow assertions were checked against
the current forms, runtime and storage code. The production Chrome scenario
`AEW_SMOKE_RELEASE=1 node scripts/workspace-smoke.mjs` passed setup, context saving,
worktree preparation, report/evidence review, constraint/challenge, failure/cancel/
retry, restart, historical Markdown downloads and the 390px layout. It used nine
synthetic runtime attempts and no real model calls. Historical release evidence
was not regenerated or rewritten.
