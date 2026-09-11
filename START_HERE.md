# Start Here

AI Engineering Workbench v0.1 is a local Linux application for versioned,
evidence-backed investigations and human revision through Codex CLI. Follow the
[Linux demo](docs/linux-demo.md) for installation, connection setup and the complete
investigate/challenge/export flow. Current verification and acceptance are recorded
in [development status](docs/development-status.md).

## Get and run the project

```bash
git clone git@github.com:skyscs/ai-engineering-workbench.git
cd ai-engineering-workbench
nvm install
nvm use
pnpm install --frozen-lockfile
pnpm check
pnpm start
```

Prerequisites are Node 22.23.2 (minimum 22.13), pnpm 10.15.0 and system Git. Install
pnpm for the selected Node environment if needed. Open `http://127.0.0.1:4242`.
`pnpm check` includes the build. `pnpm dev` instead starts the development UI on
`http://127.0.0.1:5173`. Set `AEW_OPEN_BROWSER=0` to suppress automatic browser launch.

Generating a fixture, configuring the workspace and preparing worktrees do not
invoke AI. **Run investigation** and **Challenge and run** do. Explicitly save the
intended Codex configuration directory before creating the task, and select its
model profile. No default corporate/personal connection is inferred.

## Verification and development

Use the [release acceptance guide](docs/release-acceptance.md) for deterministic
checks and separately opted-in real investigations. The suite and browser fixture
require no Codex credentials. Read [AGENTS.md](AGENTS.md), the product/architecture/
security/workflow documents, and [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) before
implementing changes. Keep task scope bounded and project artifacts in English.

The source packages remain private. This repository does not publish an installer,
background service or cloud application. Back up the complete stopped data directory
and external registered repositories before upgrading; see the Linux guide.
