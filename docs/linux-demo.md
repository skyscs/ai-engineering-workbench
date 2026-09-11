# Linux installation and v0.1 demo

The verified distribution is a source checkout with a production build, run as the
current user on Linux. There is no installer, background service or public server.
macOS and Windows path conventions are covered by tests; their runtimes have not
been accepted. The packages are private and are not published to npm.

## Install and run

Use Node 22.23.2 (pinned in `.nvmrc` and `.node-version`), pnpm 10.15.0, system Git
and a compatible, already authenticated Codex CLI. The current adapter accepts CLI
0.153.4 and 0.154.0. See the [runtime guide](codex-runtime.md) for configuration
restrictions. System Git should already be able to access the selected repositories.

```bash
nvm install
nvm use
pnpm install --frozen-lockfile
pnpm check
AEW_OPEN_BROWSER=0 pnpm start
```

Open `http://127.0.0.1:4242`. `pnpm check` includes the production build; after source
changes, run it again or use `pnpm build` before `pnpm start`. The SQLite experimental
warning is expected on the pinned Node release. The daemon binds loopback only;
use the exact URL, and stop any other process occupying port 4242. `pnpm dev` uses
Vite on port 5173 and rebuilds internal packages when started.

## Demo using synthetic history

Generate a non-proprietary fixture without invoking AI:

```bash
node scripts/release-fixtures.mjs single
```

The printed manifest contains temporary repository paths and an incident log.
Use `interaction` for the two-repository case or `revision` for the human revision
case. The generator leaves files for inspection and makes no model requests.

1. Create a workspace. Before creating a task, explicitly save the intended Codex
   configuration directory and executable in **AI connection**. Use the correct
   personal/corporate directory; an executable name alone does not select an account.
2. Create a model profile for the intended model and effort. The acceptance runs use
   `gpt-5.6-terra` and `medium`.
3. Register each manifest repository through **Repositories**. Create a task using
   the manifest description and select all its repositories.
4. Import the incident log and explicitly select its text range. For the `revision`
   case, postpone the log until after the initial investigation.
5. Choose **Prepare worktrees**, then the model profile and **Run investigation**.
   This step invokes the configured CLI and can consume its account allowance.
6. Review the report and open its evidence. Cancel an active run if necessary;
   another **Run investigation** starts a fresh attempt. Failed attempts preserve
   the last published report.
7. In the `revision` case, import/select the log now, save the manifest constraint,
   then challenge the latest report using the manifest challenge. Saving a constraint
   alone starts no AI. Review the revised explanation and reopen version 1.
8. Choose **Export Markdown** for either version. Stop and restart the daemon,
   reconnect with **Refresh**, and verify that reports, constraints and history remain.

## Data, backup and upgrades

Default data is `$XDG_DATA_HOME/ai-engineering-workbench` or, when unset,
`~/.local/share/ai-engineering-workbench`. Set `AEW_DATA_DIR` to an absolute path on
a local filesystem for an isolated demo. Keep the same setting on restart.

Stop the daemon before copying the **complete** data directory, including SQLite,
artifacts and managed repositories. A database-only copy loses imported files and
Git objects. Also preserve external registered repositories: they are referenced,
not copied into the data directory, and retained pins/worktrees depend on them.
Restore at the same canonical paths for v0.1. Moving data or source repositories
between machines/paths is not an implemented migration workflow.

Back up before upgrading. Startup applies schema migrations and refuses a database
created by an unsupported newer schema. Downgrading the executable is not a rollback
strategy; restore the complete stopped backup and matching source revision instead.
Never remove `.owner.db` to bypass ownership. One daemon may own a data directory.

A graceful stop cancels its owned active invocation. After an abrupt crash, unfinished
runs become `INTERRUPTED` and require explicit retry; the app does not resume a paid
CLI session. Inspect possible remaining CLI processes after a force-kill before
retrying. Do not delete dirty worktrees: use the UI cleanup, which refuses them and
retains revision pins needed by report evidence.

See [release acceptance](release-acceptance.md), [export details](report-export.md)
and [security boundaries](../SECURITY.md) for the verified scope and limitations.
