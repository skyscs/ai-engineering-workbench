# AI Engineering Workbench

A local application for investigating software defects across Git repositories,
reviewing evidence and revising AI conclusions with human feedback.

## What v0.1 does

Workbench runs a browser UI and a local daemon. You describe a problem, select
repositories and optional text artifacts, and prepare isolated worktrees. A Codex
CLI invocation investigates committed source and history and produces a versioned
investigation/root-cause report. You can inspect its evidence, save persistent
constraints, challenge the conclusion and export a chosen version to Markdown.

Earlier reports survive revisions, failures and cancellation. The application
preserves your normal checkout's working files and uses pinned commits for tasks.
Model selection is manual: choose a workspace model profile or the selected CLI
connection's defaults for each run.

The v0.1 implementation was accepted through PR #12. See the [release acceptance](docs/release-acceptance.md)
and [reviewed example reports](docs/fixtures/release/README.md) for verified behavior.

## Requirements

- **Linux:** the verified runtime platform. macOS/Windows path conventions are
  tested, but their complete runtimes are not accepted.
- **Node.js 22.23.2:** pinned in `.nvmrc` and `.node-version`; minimum 22.13.0.
- **pnpm 10.15.0** and **system Git**. Git authentication must already work for
  repositories you intend to clone or fetch.
- **Codex CLI for AI runs:** the adapter accepts versions 0.153.4 and 0.154.0.
  Use an existing authenticated configuration and explicitly select its directory
  in the application. Other CLI versions are rejected until compatibility is verified.
  See [runtime requirements](docs/codex-runtime.md#supported-configuration).

Installing, starting the UI, preparing worktrees and running ordinary tests make
no model requests. **Run investigation** and **Challenge and run** invoke the
configured CLI and can consume the selected account's allowance.

## Quick start

With nvm installed, run:

```bash
git clone git@github.com:skyscs/ai-engineering-workbench.git
cd ai-engineering-workbench
nvm install
nvm use
```

Ensure pnpm 10.15.0 is installed for the selected Node environment, then:

```bash
pnpm install --frozen-lockfile
pnpm build
AEW_OPEN_BROWSER=0 pnpm start
```

Open **http://127.0.0.1:4242**. Keep the terminal running; stop with Ctrl+C.
Omit `AEW_OPEN_BROWSER=0` to allow automatic browser opening. Use the exact address;
the daemon binds loopback and reports an error if port 4242 is occupied. The
experimental SQLite warning on the pinned Node release is expected.

This is a source-build distribution. There is no installer, background service,
npm publication or network-facing mode. See [Linux installation and operations](docs/linux-demo.md)
for data directories, isolated demos, backup and upgrades.

## Your first investigation

1. Choose **New workspace**. Save the intended **Configuration directory** and
   optional executable/CLI profile before creating a task. Add a model profile
   under **Model profiles** if you want explicit model and effort settings.
2. Under **Repositories**, register an existing local checkout or clone into
   Workbench. Wait for readiness; fetch updates explicitly if needed.
3. Choose **Tasks → New task**, describe observed and expected behavior and select
   the relevant repositories.
4. If using artifacts, **Import files**, select **Include text** for the relevant
   UTF-8 ranges, then **Save text context**. Import alone does not supply text to AI.
5. Under **Task worktrees**, review base refs and choose **Prepare worktrees**.
   Wait for every selected repository to show `Worktree: ready`.
6. Under **Historical investigation**, select **Model profile** and choose
   **Run investigation**. Review the report and open evidence buttons.
7. Save a **Persistent constraint** or use **Challenge and run** to request a
   revised explanation. Inspect earlier versions with **Report version** and
   download any selected version with **Export Markdown**.

The [user guide](docs/user-guide.md) provides a complete synthetic walkthrough,
field-by-field setup, expected results, revision examples and troubleshooting.

## Limits and data handling

- Workbench stores state, imported files and reports locally. Codex can transmit
  exposed source and supplied context to its configured provider; Workbench has
  no exact outbound-payload audit or verified account-identity claim.
- Explicit configuration-directory selection separates workspace launch settings.
  Creating the first task locks those settings. An executable name alone does
  not select a personal or corporate account.
- Investigations use committed revisions. Uncommitted changes are excluded;
  fetching or preparing again does not move an existing task's pin.
- Text/Markdown/log ranges can be supplied explicitly. Images, PDFs and videos
  can be stored/downloaded but are not analyzed in v0.1.
- Only one AI invocation runs per daemon. Cancellation and retry are explicit;
  failures preserve the last successful report. Interrupted runs do not resume
  paid CLI sessions automatically.
- CHALLENGE and CONSTRAINT are available. ASK, ADD_CONTEXT and OVERRIDE, automatic
  model selection, code implementation, automated fix verification, integrations
  and additional runtime providers are deferred. Task edit/delete and repository
  removal are not exposed in the current UI.
- Export omits configuration paths and raw diagnostics and redacts known patterns;
  it is not a complete secret scanner. Review reports before sharing.

Use trusted repositories and CLI configuration. See [security boundaries](SECURITY.md)
and [known issues](docs/open-issues.md). Back up the complete stopped data directory
and external registered repositories; Markdown export is not a backup.

## Documentation and development

| Need | Document |
| --- | --- |
| Learn the application and troubleshoot a run | [User guide](docs/user-guide.md) |
| Install, operate, back up or upgrade | [Linux guide](docs/linux-demo.md) |
| Configure a connection or model profile | [Workspace settings](docs/workspace-settings.md) |
| Register, fetch or prepare repositories | [Registry](docs/repository-registry.md), [synchronization](docs/repository-synchronization.md), [worktrees](docs/task-worktrees.md) |
| Understand artifacts, reports and human revision | [Artifacts](docs/tasks-and-artifacts.md), [investigation](docs/investigation.md), [interventions](docs/interventions.md), [export](docs/report-export.md) |
| Integrate with the local HTTP API | [Session and transport](docs/local-api.md), then feature API tables |
| Inspect validation and development history | [Release acceptance](docs/release-acceptance.md), [development status](docs/development-status.md) |

For development, `pnpm dev` rebuilds internal packages and starts the UI on
`http://127.0.0.1:5173` with the daemon on port 4242. Restart it after internal
package changes. Vite also requires its exact port to be free.

```bash
pnpm check
```

This runs strict typechecks, behavioral tests and production builds. CI runs the
same checks from a frozen-lockfile installation, without model requests. Optional
browser and real acceptance procedures are described in the release guide.

The monorepo contains `apps/web`, `apps/daemon`, and packages for core types,
storage, Git, AI runtime, workflow and shared transport. Read [AGENTS.md](AGENTS.md),
[PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md)
and [WORKFLOW.md](WORKFLOW.md) before changes. Tasks 000–011 in
[the original development plan](DEVELOPMENT_PLAN.md) document the completed v0.1
sequence; they are not onboarding steps to execute again. Keep new work bounded
and all project artifacts in English.
