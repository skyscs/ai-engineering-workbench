# Start Here

Read `DEVELOPMENT_PLAN.md` for the reviewed sequence and `REVIEW.md` for the
original scaffold review. Task 001 is now verified; see `docs/development-status.md`
for evidence. The next task is the early runtime feasibility check (Task 000).

## 1. Get the project

Use the development remote `git@github.com:skyscs/ai-engineering-workbench.git`.
The initial artifacts have been published. Clone the existing repository:

```bash
git clone git@github.com:skyscs/ai-engineering-workbench.git
cd ai-engineering-workbench
```

If you create a public GitHub/GitLab repository, keep all examples synthetic and do not commit corporate artifacts, URLs, tokens, logs, or source code.

## 2. Install prerequisites

- Node.js 22.23.2 (pinned in .node-version and .nvmrc; minimum 22.12)
- pnpm 10.15.0 as specified in packageManager
- Git

Then:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Open:

```text
http://127.0.0.1:5173
```

The UI should report that the local daemon is connected.

## 3. Production-style local run

```bash
pnpm build
pnpm start
```

The daemon serves the built UI from:

```text
http://127.0.0.1:4242
```

Set `AEW_OPEN_BROWSER=0` to disable automatic browser opening.

## 4. Codex development workflow

Task 001 has passed local installation, build, test and browser smoke checks.
Next run:

```text
tasks/000-runtime-feasibility.md
```

After Tasks 001 and 000 are verified, continue with Task 002. Read:

```text
AGENTS.md
README.md
PRODUCT.md
ARCHITECTURE.md
SECURITY.md
WORKFLOW.md
docs/architecture/domain-model.md
tasks/002-local-storage-foundation.md
DEVELOPMENT_PLAN.md
docs/decisions/0004-v01-execution-and-recovery.md
```

Then instruct it:

```text
Implement Task 002 only. Do not start Task 003. Follow AGENTS.md and preserve the documented architecture. After implementation, run the relevant checks and summarize any deviations from the specification.
```

## Verification history

The original archive was generated without registry access and was unverified.
Task 001 subsequently established a lockfile, protected local API and reproducible
checks. See `docs/development-status.md` for current evidence and limitations.
