# AI Engineering Workbench

A local-first engineering workspace for AI-native software development.

The product formalizes a workflow that many experienced engineers currently manage through ad-hoc prompts: collect task context, select relevant repositories, reconstruct defect history, produce evidence-backed root-cause hypotheses, let the engineer intervene in natural language, and later orchestrate implementation, verification, and reusable knowledge capture.

## Product principles

- **Local-first by default.** Repositories, task artifacts, worktrees, state, and generated reports live on the developer's machine.
- **Web UI, local runtime.** The browser is only the UI. A local daemon owns filesystem, Git, AI runtime, workflow, and storage access.
- **Human authority.** AI output is always reviewable, versioned, challengeable, and overridable.
- **Evidence over prose.** Important conclusions should reference code, Git history, tests, logs, or uploaded artifacts.
- **Deterministic code for deterministic work.** Filesystem operations, Git operations, state transitions, validation, and policy enforcement are application code, not LLM decisions.
- **AI connection defines the data boundary.** A workspace is bound to an approved AI connection. A task cannot silently switch from a corporate runtime to a personal one.
- **Model selection is per run.** The workflow can choose a model profile automatically, while the engineer can override it for an individual run within the workspace's allowed connection.
- **No fake autonomy.** The first release is intentionally not a multi-agent swarm or an IDE replacement.

## v0.1 goal

Given a task description, optional local artifacts, and one or more local Git repositories, the application can:

1. create an isolated task workspace;
2. maintain current repository metadata without modifying the developer's working checkout;
3. run a historical investigation through Codex CLI;
4. produce a versioned root-cause report with evidence;
5. allow the engineer to challenge or correct the result with a free-form prompt;
6. produce a revised version without deleting the previous reasoning artifact.

Implementation, verification automation, knowledge retrieval, Jira/GitLab integrations, local LLMs, and direct OpenAI API support are deliberately deferred.

## Repository layout

```text
ai-engineering-workbench/
  apps/
    daemon/             # local HTTP API and process owner
    web/                # React/Vite UI
  packages/
    core/               # domain types and invariants
    storage/            # SQLite + filesystem abstraction
    git/                # system Git integration
    ai/                 # runtime abstraction, Codex CLI first
    workflow/           # state machine and stage execution
    shared/             # transport DTOs and shared utilities
  docs/
    architecture/
    decisions/
  tasks/                # implementation specs executed one at a time
  AGENTS.md
```

## Development strategy

Build the product by dogfooding the workflow manually. Each implementation task is intentionally small and self-contained. Codex should receive an explicit task or bounded sequence and should not silently broaden scope.

Start with `tasks/001-bootstrap-local-shell.md`, then the early runtime check
`tasks/000-runtime-feasibility.md`, then Tasks 002–011.
See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for milestones and checks and
[REVIEW.md](REVIEW.md) for the review of the original artifact.

## Current implementation status

The repository includes the Task 001 bootstrap scaffold: pnpm workspace layout, React/Vite web shell, Hono daemon, strict TypeScript configs, a `/api/health` endpoint, dev proxying, and a production-oriented build path where the daemon serves the built web UI.

Task 001 remains unverified. Review additions are specification changes, not
implemented functionality. See `START_HERE.md` for verification and the revised handoff.

## Quick start

Prerequisites: Node.js 22.12+, pnpm 10.15.0, and Git. Task 001 must align
package engines with this reviewed minimum and pin a tested Node patch version.

```bash
pnpm install
pnpm dev
```

Development UI: `http://127.0.0.1:5173`

Local daemon: `http://127.0.0.1:4242`

Production-style local run:

```bash
pnpm build
pnpm start
```

The daemon then serves the built UI at `http://127.0.0.1:4242`.
