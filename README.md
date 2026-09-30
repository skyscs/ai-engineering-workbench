# AI Engineering Workbench

A local application for investigating software defects across Git repositories,
reviewing evidence and revising AI conclusions with human feedback.

The repository also contains **LoreDock**, the new local source catalog that will
provide system context for future Workbench investigations. Its first implementation
connects up to three local Git repositories, indexes committed text and opens exact
source citations. It makes no model calls and needs no Codex configuration.

After the shared installation/build steps below, run `pnpm loredock` and open
**http://127.0.0.1:4244**. Follow the [LoreDock guide](docs/loredock/USER_GUIDE.md)
for indexing, search, updates, coverage, storage and the synthetic demo.
The [answer-stage checkpoint](docs/loredock/ANSWER_FOUNDATION.md) records internal
retrieval experiments and remaining runtime gates; AI answers are not enabled yet.

## What v0.1 does

Workbench runs a browser UI and a local daemon. You describe a problem, select
repositories and optional text files, and start an investigation in one action.
Workbench saves your draft, checks the selected setup and prepares isolated
worktrees automatically. A Codex
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
no model requests. **Investigate**, **Run investigation again** and **Revise report** invoke the
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

1. Enter a local **Repository path or Git URL** and describe **What is going wrong?**
2. Optionally **Add files** or drop UTF-8 logs, text or Markdown into the composer.
   Saved files are included in full automatically; use **Exclude** to keep a file
   without supplying it to the model.
3. Choose the intended **Codex setup** once. Select an existing project or its
   configuration directory; executable/profile overrides are under **Advanced setup**.
4. Click **Investigate**. Workbench checks the setup, resolves source, saves context,
   prepares isolated code and starts analysis. You can close the page and return.
5. Review **What we found**, open evidence and use **Revise report** to reconsider
   the conclusion. **Report version** and **Export Markdown** preserve access to
   earlier results.

Drafts and files are saved locally before launch. **Copy to a new investigation**
reuses composer inputs with newly resolved code; running the same investigation
again retains its pinned commits. **Advanced settings** opens the original detailed
controls, including multiple repositories, model profiles and explicit text ranges.

The [user guide](docs/user-guide.md) explains the primary workflow, recovery,
storage locations and the optional advanced walkthrough.

## Limits and data handling

- Workbench stores state, imported files and reports locally. Codex can transmit
  exposed source and supplied context to its configured provider; Workbench has
  no exact outbound-payload audit or verified account-identity claim.
- Explicit configuration-directory selection separates workspace launch settings.
  Creating the first task locks those settings. An executable name alone does
  not select a personal or corporate account.
- Investigations use committed revisions. Uncommitted changes are excluded;
  fetching or preparing again does not move an existing task's pin.
- The composer accepts up to 32 nonempty UTF-8 text/Markdown/log files. Description
  and all saved files share a 1 MiB budget, or a lower configured storage limit.
  Advanced settings supports explicit text ranges and larger original artifacts.
  Images, PDFs and videos are not analyzed in v0.1.
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
| Use the LoreDock source catalog | [LoreDock guide](docs/loredock/USER_GUIDE.md), [browser acceptance](docs/fixtures/loredock-catalog/README.md) — local indexing and cited source search implemented |
| Review the next development direction | [LoreDock-first roadmap](docs/loredock/PLAN.md), [draft review](docs/loredock/REVIEW.md), [L0 feasibility](docs/loredock/FEASIBILITY.md) — AI answers and system relationships remain planned |
| Inspect the earlier interaction prototype | [Interaction prototype](prototypes/investigation/README.md), [UX plan](docs/ux-simplification-plan.md) — sample data, no model calls |

For development, `pnpm dev` rebuilds internal packages and starts the UI on
`http://127.0.0.1:5173` with the daemon on port 4242. Restart it after internal
package changes. Vite also requires its exact port to be free.

```bash
pnpm check
```

This runs strict typechecks, behavioral tests and production builds. CI runs the
same checks from a frozen-lockfile installation, without model requests. Optional
browser and real acceptance procedures are described in the release guide.

The monorepo contains Workbench's `apps/web` and `apps/daemon`, LoreDock's
`apps/loredock-web` and `apps/loredock`, and packages for core types,
storage, Git, AI runtime, workflow and shared transport. Read [AGENTS.md](AGENTS.md),
[PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md)
and [WORKFLOW.md](WORKFLOW.md) before changes. Tasks 000–011 in
[the original development plan](DEVELOPMENT_PLAN.md) document the completed v0.1
sequence; they are not onboarding steps to execute again. Keep new work bounded
and all project artifacts in English.
