# Historical investigation and root-cause reports

An investigation turns prepared context into a versioned investigation/root-cause
pair. Follow the [user guide](user-guide.md#run-and-review-an-investigation) for
step-by-step usage.

## Use

1. Configure the workspace's intended Codex directory and model profile.
2. Create a task, import artifacts and select the exact UTF-8 ranges to supply.
3. Prepare every selected repository worktree.
4. In **Historical investigation**, review the connection directory, choose the
   model profile and select **Run investigation**.
5. Review the historical timeline, root-cause conclusion and unresolved questions.
   Open evidence buttons to read the recorded source and human-readable locator.

A concrete identified cause must cite evidence. **Insufficient evidence** is a
valid result when more context is needed. Locator checks establish source identity,
existence and range; the engineer decides whether it supports the conclusion.
Excluded PDF/video/image inputs are disclosed and cannot become analyzed evidence.
Active constraints and the exact previous report for a challenge are snapshotted
for each new run. Use [human interventions](interventions.md) to save rules or reconsider
a conclusion.

Every successful invocation adds one immutable version. **Report version** opens
older versions. A failed, cancelled or invalid attempt leaves the last successful
report active. Editing artifact context marks previous reports **stale** immediately;
start another investigation explicitly to use the changed context. A restart
interrupts unfinished runs and restores the last completed workflow state.

Task state is **INVESTIGATING** during a full run and **ROOT_CAUSE_READY** after
atomic publication. The latter includes an honest insufficient-evidence conclusion;
it means a report is available, not that a cause has been proven. Existing legacy
previews remain readable and are never converted into full reports.

Choose **Export Markdown** for the selected version; see [report export](report-export.md).
The task-summary display limitation is documented as [AEW-003](open-issues.md#aew-003--task-summary-displays-created-for-investigation-states).

## Evidence boundaries

Repository evidence references a full SHA at the task pin or an available ancestor.
File lines are 1-based and inclusive, read from Git objects rather than changed
working files. Commit evidence shows the recorded commit and its metadata. Task
worktree cleanup preserves evidence access while the original repository and pin
remain available. A changed pin or missing history produces an explicit error. Repository evidence
reads share application Git locks; if a repository is busy, finish or cancel its
active operation before reopening the source.

Artifact evidence references an immutable imported hash and UTF-8 byte range
`[start, end)` inside the original run's selection. Later selection edits do not
change it. Missing or corrupted stored bytes are reported as unavailable.

Supported file evidence is regular UTF-8 text up to 256 KiB and 1000 selected lines.
Symlinks, submodules, traversal paths, binary text and text containing replacement
characters are rejected. No arbitrary filesystem path is exposed by the read API.
Prose supports a small safe Markdown subset; unsupported markup is displayed as
text. Source snippets are always escaped text.

The [Codex runtime guide](codex-runtime.md) documents read-only restrictions,
connection selection, cancellation, diagnostics and provider-visibility limits.

## Protected API

Routes below are relative to `/api/workspaces/:workspaceId/tasks/:taskId`.
All require the local session; POST also requires Origin, CSRF and JSON.

| Method and path | Behavior |
| --- | --- |
| `POST /investigations` | `{ "modelProfileId": null }` or an owned profile ID. Persist/start one run and return its StageRun, 202. |
| `GET /investigations` | `{ "reports": [...] }`, newest successful version first. |
| `GET /investigations/:reportId` | Immutable pair with version, IDs, context revision, creation time and derived status/freshness. |
| `GET /investigations/:reportId/evidence/:evidenceId` | Revalidate the owned locator and return `{ "locator": "...", "text": "..." }`; unavailable sources return an error. |
| `GET /investigations/:reportId/export` | Download the chosen version as a protected Markdown attachment; see the export guide. |
| `GET /runtime-runs/:runId` | Existing persisted run/metadata/output transport for either schema. |
| `POST /runtime-runs/:runId/cancel` | Existing cancellation endpoint with `{}`. |
| `GET /runtime-runs/:runId/events` | Existing sequenced SSE/replay endpoint. |

The legacy `POST /runtime-runs` endpoint still starts a preliminary preview. New UI
runs use `/investigations`. `INVALID_RESULT` and `INVALID_EVIDENCE` are terminal
StageRun failures; they do not publish partial reports or trigger automatic retries.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm check
AEW_SMOKE_RUNTIME=1 node scripts/workspace-smoke.mjs
```

Ordinary tests and the Chrome scenario use synthetic executables and make no model
requests. Chrome requires Linux and a free port 4242 and uses an isolated profile.
The scenario checks evidence navigation, immutable v1/v2, invalid-evidence failure,
cancel/retry, inert unsafe markup, restart and a 390px viewport.

Separate real synthetic acceptance, after building:

```bash
AEW_INVESTIGATION=1 AEW_CODEX_HOME=/absolute/selected/config node scripts/runtime-adapter-smoke.mjs --preflight
AEW_INVESTIGATION=1 AEW_CODEX_HOME=/absolute/selected/config AEW_REAL_RUNTIME=1 node scripts/runtime-adapter-smoke.mjs
```

The second command consumes the selected connection's allowance. It uses
`gpt-5.6-terra` with `medium`, prepares two synthetic repositories and an incident
log, publishes a report and opens every evidence locator. `AEW_CODEX_EXECUTABLE`
can select the CLI binary explicitly. Review temporary outputs before sharing.
See [ADR 0013](decisions/0013-investigation-pairs-and-evidence.md) and
[development status](development-status.md) for recorded results.
