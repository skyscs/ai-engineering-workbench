# Linux installation and v0.1 demo

Start with the [README quick start](../README.md#quick-start) to clone the project.
Run the commands below from that checkout, with pnpm 10.15.0 available in the
selected Node environment.

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
pnpm build
AEW_OPEN_BROWSER=0 pnpm start
```

Open `http://127.0.0.1:4242`. After source changes, run `pnpm build` before
`pnpm start`. Contributors can use `pnpm check` for typechecks, tests and the
build. The SQLite experimental warning is expected on the pinned Node release. The daemon binds loopback only;
use the exact URL, and stop any other process occupying port 4242. `pnpm dev` uses
Vite on port 5173 and rebuilds internal packages when started.

## Application walkthrough

Follow the [user guide](user-guide.md) for the complete workflow: generating a
practice fixture, configuring a connection/model profile, registering repositories,
creating a task, saving text context, preparing worktrees, investigating, challenging
and exporting versions. It also includes expected results and troubleshooting.
Generating fixtures makes no model requests; running investigations or challenges
through your configured connection does.

For a temporary data root isolated from everyday application data:

```bash
AEW_DATA_DIR=/tmp/aew-demo AEW_OPEN_BROWSER=0 pnpm start
```

Keep the same absolute directory on restart and use a dedicated local directory.
Temporary data may be removed by the operating system; use the default persistent
location or another persistent local directory for work you need to keep.

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

## Optional storage smoke

After building, `node scripts/storage-smoke.mjs` checks startup, ownership,
production-to-development restart and shutdown with temporary data. It requires a
free port 4242. With Chrome installed, `AEW_SMOKE_BROWSER=1` also checks rendering.
The headless fixture uses `--no-sandbox` and opens only the local fixture UI; no
model request or normal application data is used. For the complete application
scenario, use [release verification](release-acceptance.md#run-deterministic-checks).
