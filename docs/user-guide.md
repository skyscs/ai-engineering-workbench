# AI Engineering Workbench user guide

This guide takes a developer from an empty workspace to a reviewed investigation,
a human revision and an exported report. Examples use generated repositories;
the same UI steps apply to your own trusted repositories.

Install and start the application using the [README quick start](../README.md#quick-start).
For operating the daemon, backups and upgrades, use the [Linux guide](linux-demo.md).
Run terminal commands below from the Workbench source checkout with the pinned
Node version selected. The application itself opens at `http://127.0.0.1:4242`.

## Contents

- [Understand the workspace](#understand-the-workspace)
- [Create a practice case](#create-a-practice-case)
- [Configure your workspace](#configure-your-workspace)
- [Register repositories](#register-repositories)
- [Create a task](#create-a-task)
- [Import and select context](#import-and-select-context)
- [Prepare the task worktrees](#prepare-the-task-worktrees)
- [Run and review an investigation](#run-and-review-an-investigation)
- [Guide the next version](#guide-the-next-version)
- [Export and return later](#export-and-return-later)
- [Practice a revision with new evidence](#practice-a-revision-with-new-evidence)
- [Troubleshooting](#troubleshooting)

## Understand the workspace

| Term | What it means in the application |
| --- | --- |
| Workspace | A collection of repositories and tasks bound to one AI connection. |
| AI connection | The executable, explicit configuration directory and optional CLI profile used for that workspace. |
| CLI profile | A named configuration layer within the selected CLI directory; distinct from a Workbench model profile. |
| Model profile | A workspace-owned label with an optional model identifier and reasoning effort, selected for a run. |
| Task | A problem description and selected repositories. Task creation does not start AI. |
| Artifact | A preserved imported file. You separately select supported text to supply as context. |
| Task worktree | A detached checkout of a recorded commit, separate from your normal working files. |
| Stage run | One preparation or AI attempt, including its recorded inputs and outcome. |
| Report version | A successfully published investigation/root-cause pair; failed attempts do not create a version. |

The browser controls the local daemon, which owns files, Git and CLI processes.
Closing the browser does not cancel work. Only **Run investigation** and
**Challenge and run** start model invocations in the current UI. Registering or
fetching a remote repository can use network Git, but does not invoke AI.

## Create a practice case

Generate the single-repository rounding regression:

```bash
node scripts/release-fixtures.mjs single
```

The command prints a JSON manifest and leaves an isolated temporary directory.
Record these values:

| Manifest field | Use |
| --- | --- |
| `root` | Location of the generated fixture and its `manifest.json`. |
| `repositories[0].source` | Absolute checkout path to register. |
| `description` | Ready-to-use task description. |
| `artifact` | Absolute path of `incident.log`, selected through the browser file picker. |
| `expected` | Review rubric; keep it for evaluating the report rather than adding it as task context. |

This generator makes no model requests. Its history contains a pricing refactor
and a later documentation-only change. Keep the generated directory while the
task uses it: the repository is registered in place, and temporary directories
may be cleaned by the operating system. For durable work, put repositories in a
persistent location before registering them.

Expected result: a manifest, a Git checkout and a log file exist. No application
workspace or task has been created yet.

## Configure your workspace

### Create the workspace and connection

Choose **New workspace** and complete the form before creating a task:

| UI field | What to enter |
| --- | --- |
| Workspace name | For example, `Checkout investigations`. |
| Connection name | A descriptive label such as `Personal investigation connection`. This label does not authenticate or select an account. |
| Configuration directory | The existing absolute directory for the intended Codex configuration. Enter a resolved path; `~` and environment variables are not expanded. |
| CLI configuration | **Base configuration in selected directory**, or **Named CLI profile** if your supported setup has that layer. |
| CLI profile name | Only for named selection: the existing profile name, not a model name or a file path. |
| Codex executable path (optional) | An absolute executable path, or leave blank to use `codex` from the daemon's PATH. Shell aliases are not executable paths. |

Use your actual existing configuration directory. For example,
`/home/developer/.codex-plus` could identify a personal setup, but the directory
name is not proof of account identity and is not created by this form. Workbench
passes the saved directory as `CODEX_HOME` for every CLI subprocess and does not
fall back to an inherited home. Authentication stays with Codex; do not paste
tokens into any application field.

The optional named layer follows the adapter's supported configuration format;
see [runtime configuration](codex-runtime.md#supported-configuration). Saving
settings does not verify profile existence, model availability or authentication.
The **Configured · not verified** badge is expected.

Choose **Create workspace**. Later edits use **AI connection → Save connection**.
Creating the first task locks the connection's launch settings. To change its
executable, selected directory or CLI profile afterward, create another workspace.
The narrow exception for a previously unset directory is described in
[workspace settings](workspace-settings.md); do not rely on it for normal setup.

Expected result: the workspace appears in the sidebar and its intended connection
directory is saved. No model invocation has occurred.

### Add a model profile

Under **Model profiles**, enter:

| UI field | Example |
| --- | --- |
| Profile name | `Investigation — medium` |
| Model identifier (optional) | An identifier supported by your configured provider. The release cases used `gpt-5.6-terra`. |
| Reasoning effort | `medium`, if supported by that model. |

Choose **Add profile**. Empty model/effort values request the selected CLI's
defaults; they do not discover or recommend a model. Workbench does not select
profiles automatically or substitute another connection after a failure.
Choose the intended profile again when opening a task; the UI selection is not
a saved workspace-wide default.

Expected result: the profile is listed and can be selected for an investigation.
Availability is checked by the runtime when a run is attempted.

## Register repositories

Under **Repositories → Add a repository**:

1. Select **Source type → Existing local checkout** for the practice case.
2. Enter **Repository name**, for example `Checkout`.
3. Paste `repositories[0].source` into **Absolute checkout path**.
4. Leave **Base ref (optional)** blank for detection, or set `refs/heads/main`
   for the generated fixture.
5. Choose **Register repository**.

For a remote repository, select **Clone into Workbench**, enter its SSH/HTTPS
source and choose **Start clone**. System Git credentials must already work;
the app cannot answer password or unknown-host prompts. Managed cloning downloads
history without populating a normal checkout; task preparation creates the
checkout used for investigation.

Expand the record to review its ref, commit and history limitations. Use
**Refresh repositories** to reload records. **Fetch updates** explicitly downloads
supported remote branch history; it does not pull, merge, import new tags or move
an existing task's commit. The generated fixture has no remote: this action only
refreshes local metadata. See [synchronization](repository-synchronization.md).

Expected result: the repository is ready and available in the new-task form.
A ready repository is not yet a prepared task worktree. Empty or shallow history
may still prevent a useful investigation.

## Create a task

Choose **Tasks → New task**, enter a title and description, and check at least one
repository. For the practice case, use `Checkout rounding regression` and copy
the manifest's `description`. A useful description identifies:

```text
Observed: a 1999-cent item with a 15% discount charges 1700 cents.
Expected: the discounted total is 1699 cents.
Context: the regression appeared after a pricing change; a later commit
only added audit documentation. Use the incident log and inspect history.
Unknown: which calculation change explains the extra cent?
Investigate the cause without implementing a fix.
```

Choose **Create task**. If no repositories are listed, register a ready repository
and reopen the form. For a multi-repository issue, select every relevant repository
at creation. The current UI has no task description/repository editor or task delete
control; create a new task when those initial choices need to change.

Expected result: task details appear, with selected repositories and unprepared
worktrees. Connection launch settings are now locked; no AI run has started.

## Import and select context

**Import local artifacts** appears below the investigation section; scroll down
if necessary. Select the manifest's `incident.log` using **Files**, then choose
**Import files**. The stored copy is independent of the original, and duplicate
filenames create separate artifacts.

In **Text context preview**:

1. Locate `incident.log` and select **Include text**.
2. For this small log, keep **Start byte** at `0` and **End byte** at its full size.
3. Check the draft total, then choose **Save text context**.
4. Wait for **Text context selection saved.** before running an investigation.

The draft checkboxes alone do not save the selection. **Download original** opens
the preserved file for inspection. For a large file, set a smaller range:
`[start, end)` includes the start and excludes the end. These are UTF-8 byte offsets,
not line numbers or character counts; both boundaries must surround complete
characters. Oversized context is rejected, not silently truncated.

| Default limit | Value |
| --- | --- |
| One imported file | 100 MiB |
| Imported files in one task | 1 GiB |
| Description plus selected text | 1 MiB |

These defaults can be configured at daemon startup; the UI displays effective
limits. See [artifact limits](tasks-and-artifacts.md#limits-and-recovery).
PNG/JPEG, PDFs, videos and other unsupported inputs can be preserved/downloaded
but are excluded from analysis. Importing an image does not provide OCR or vision.

Expected result: the saved selection contains the log's intended range. Importing
or saving context makes no model request. Later context changes can mark existing
reports stale and require an explicit new run.

## Prepare the task worktrees

Return to **Task worktrees**. Review each **Base ref** before preparation. If changing
it, choose **Save base ref**; the ref must already resolve locally. For remote updates,
fetch before choosing the revision. Then choose **Prepare worktrees**.

Wait for each selected repository to show `Worktree: ready`, a path and a commit.
Preparation checks out committed files in detached worktrees. Your normal checkout's
uncommitted changes are excluded. Submodules are not initialized; LFS/smudge/process
checkout filters are unsupported. Shallow repositories do not gain missing history.

Once a task commit is recorded, its base ref is locked. Fetching, retrying preparation
or cleaning and recreating the worktree keeps that commit. Create a new task to
investigate a newer revision. If one repository fails, successfully prepared members
remain; correct the reported issue and explicitly retry preparation.

Expected result: all worktrees are ready and **Run investigation** can become available
once the connection is configured and no conflicting operation is active.

## Run and review an investigation

### Start, monitor, cancel or retry

In **Historical investigation**, check the displayed configuration directory and
choose the intended **Model profile**. Choose **Run investigation** once. This
starts a real CLI invocation using the saved context and pinned repositories.

The section shows a run ID, status, requested settings and **Run events (latest 100)**.
Only one AI invocation can run per daemon. Context writes and worktree cleanup for
the active task are blocked. Close/reopen the browser without cancelling, or choose
**Cancel run** and wait for the terminal outcome before editing or retrying.

If a run fails, read its error and correct the cause. **Run investigation** creates
a fresh attempt. After a lost connection, use sidebar **Refresh**, reopen the task
and inspect the latest attempt before submitting again. No automatic paid retry or
CLI session resume occurs. Cancellation and completion can race: a run that already
published successfully remains successful.

Expected result: a successful run publishes one complete investigation/root-cause
pair. Failure or cancellation leaves any previous successful report available.

### Evaluate the report

Read **Investigation**, **Historical timeline**, **Root cause** and **Unresolved
questions**. Use evidence buttons to open **Recorded source**. Locators identify
pinned repository files/commits or saved artifact hashes/ranges. Check whether the
source actually supports the statement; valid locators alone do not prove causality.

For the rounding fixture, compare the result with the manifest's `expected`:
look for the change from rounding the final discounted cents to rounding before
multiplication, the incident's one-cent difference, and the later documentation-only
commit. Do not grade by exact wording. **Insufficient evidence** is a valid conclusion
when the available inputs cannot establish a cause.

Use **Report version** to inspect earlier publications:

| Label | Meaning |
| --- | --- |
| active | Latest successful publication, even when the conclusion is insufficient evidence. |
| superseded | A later version published successfully; this version remains inspectable. |
| fresh | No tracked context change has invalidated this version. This is not a correctness score. |
| stale | Context changed since the report; explicitly run again to incorporate it. |

A version can be both active and stale. A failed revision does not supersede it.
The task-summary line currently shows **Created** for some running/completed
investigation states; use the run status and report sections to assess progress.
This display limitation is tracked as [AEW-003](open-issues.md#aew-003--task-summary-displays-created-for-investigation-states).

## Guide the next version

### Save a persistent constraint

Under **Human interventions → Persistent constraint**, enter a rule, for example:

```text
Preserve integer-cent accounting. Compare the old and new rounding order
and distinguish code changes from later documentation changes.
```

Choose **Save constraint**. It appears under **Active constraints**, applies to
subsequent ordinary investigations and challenges, and marks existing results stale.
Saving it does not start AI. **Deactivate constraint** stops applying an obsolete
rule to future runs; historical snapshots retain it. To correct a rule, deactivate
it and add a replacement. Up to 32 active constraints and 32 KiB total are supported;
individual text is limited to 8192 characters and the API body limit.

### Challenge a specific report

1. Select the latest published **Report version** and review the current context.
2. Select the intended model under **Historical investigation**.
3. Enter feedback under **Challenge version …**, for example:

   ```text
   Reconsider whether the latest audit-documentation commit introduced this
   regression. Compare price.mjs before and after the calculation refactor,
   calculate the 1999-cent example, and explain what changed in your conclusion.
   ```

4. Choose **Challenge and run**. This starts a fresh AI invocation with the exact
   selected prior report, feedback, saved context and active constraints.
5. Review the new version's **Triggered by this challenge** text and explanation.

The model may retain a supported conclusion instead of agreeing with the challenge.
Only successful publication supersedes the prior pair. A superseded version cannot
be challenged; choose the latest one. Switching report or context resets drafts.

Expand **Intervention history (latest 100)** to inspect feedback and attempt outcomes.
**Inspect attempt** shows recorded diagnostics and model/constraint settings;
**Open version …** selects the resulting report when one exists. A failed or cancelled
challenge remains in history. Re-submit a deliberate new challenge to retry it;
an ordinary investigation does not implicitly repeat the failed feedback.
ASK, ADD_CONTEXT and OVERRIDE are reserved actions with no working UI controls.

## Export and return later

Select a **Report version**, then choose **Export Markdown**. The download contains
that version's original context/provenance, reasoning and evidence locators. Lifecycle,
freshness and source availability describe export time. **Unavailable or busy** means
a source could not be rechecked; the recorded locator is retained. Exporting starts
no AI and does not mutate the report. Review the document before sharing; see
[export contents and limitations](report-export.md).

Stop the daemon with Ctrl+C and restart it with the same data directory. Use the
workspace sidebar's **Refresh**, select the workspace and reopen the task. Completed
reports and saved artifacts/constraints persist. A graceful stop cancels an owned
active model run; recovery after an abrupt crash marks unfinished runs `INTERRUPTED`.
Retry explicitly after inspecting the recorded state.

**Clean up worktree** removes a clean owned task checkout after confirmation.
Dirty/active worktrees are refused; the original repository and retained pin remain.
Prepare again to recreate the same pinned checkout. Cleanup is not task deletion
or a way to update the task to a newer commit. Preserve external registered sources
and follow the [backup procedure](linux-demo.md#data-backup-and-upgrades).

## Practice a revision with new evidence

For an incomplete initial report followed by new observations, generate:

```bash
node scripts/release-fixtures.mjs revision
```

Register the generated `catalog` checkout and create a new task using that manifest's
`description`. Prepare and investigate **without importing the incident log yet**.
The initial description lacks the affected tenants, request sequence and flag values;
review whether the report distinguishes a code defect from unverified incident causality.

After v1 publishes:

1. Import the manifest's `artifact`, include its full text and **Save text context**.
2. Copy the manifest's `constraint` into **Persistent constraint** and save it.
3. Choose the latest report and copy the manifest's `challenge` into the challenge form.
4. Choose **Challenge and run**. Inspect the revised reasoning, evidence and v1.

The log adds alpha/42 followed by beta/42 receiving alpha's title on a cache hit,
with uppercase disabled and the database holding the correct beta value. Evaluate
whether the revision links these observations to the SKU-only cache key and explains
which earlier uncertainty was resolved. Export both versions and reopen after restart.
This walkthrough uses two real model invocations when performed with your connection.
For automation without model requests, use the release guide's
[deterministic browser scenario](release-acceptance.md#run-deterministic-checks).

## Troubleshooting

| Symptom | What to check or do |
| --- | --- |
| UI will not start or reports an occupied port | Select the pinned Node/pnpm versions, build, and stop conflicting processes on 4242 (also 5173 for development). Use the exact `127.0.0.1` URL. |
| `Run investigation` is disabled | Save the configuration directory, wait for all worktrees to be ready, and let the current operation finish. Check for an active run before retrying. |
| Configuration directory or named profile is missing | Correct the existing absolute path/profile before task creation. `~` is not expanded. Consult the runtime configuration guide; there is no inherited-home fallback. |
| `UNSUPPORTED_VERSION` | Use one of the CLI versions accepted by this adapter with an explicit executable path if needed. A newer installed CLI is not automatically compatible. |
| Authentication, configured tools or environment preflight fails | Review the normalized error and [runtime restrictions](codex-runtime.md#supported-configuration). Resolve the selected CLI setup outside Workbench; never bypass restrictions or switch accounts implicitly. |
| Connection fields are locked | The workspace already has a task. Create a new workspace for changed launch settings; only the documented one-time unset-directory binding is an exception. |
| No repository in the task form | Register a ready repository first, then reopen **New task**. |
| Base ref does not resolve | Fetch if appropriate; choose an existing local ref before preparation. An empty repository needs a commit. Already recorded task revisions remain pinned. |
| New commits or local edits are absent from the report | Uncommitted edits are excluded. Existing task pins do not advance after fetch or preparation; create a new task for another committed revision. |
| Imported log did not influence the run | Verify **Include text**, range boundaries and **Save text context**. A previous run keeps its old snapshot; start another run explicitly. |
| Context exceeds its limit | Select a smaller UTF-8 byte range and save it. The UI total includes the description; no silent truncation occurs. |
| PDF/image/video has no include control | These inputs are stored but not analyzed. Supply relevant information as a supported text artifact instead. |
| Evidence is unavailable or busy | Wait for conflicting Git/model work to finish. Restore missing original repositories/history or stored artifacts at their recorded paths; do not replace the locator with unrelated current content. |
| Duplicate or stale challenge submission | Refresh the task/history and review the latest report/current context before deciding to submit again. A lost response may still have created a run. |
| Task says `Created` but a report exists | Known display issue AEW-003; inspect the run and report sections rather than this summary label. |
| Browser loses its session after restart | Use sidebar **Refresh**, select the workspace and reopen the task. A disconnect alone does not cancel an active invocation. |
| Run is `INTERRUPTED` after a crash | Inspect its recorded outcome and possible surviving CLI processes, then retry explicitly. No automatic session resume is provided. |
| Import or preparation partially failed | Inspect the error; completed files/worktrees remain. Retry the failed input or preparation explicitly. Restart only when recovery is requested; do not delete unknown files or bypass locks. |
| Cleanup refuses a worktree | Preserve changes and wait for active operations to finish. Use normal cleanup only when the owned worktree is clean; do not force-delete it to change revisions. |

For endpoint contracts and more detailed limits, follow the
[README documentation index](../README.md#documentation-and-development).
