# Start Here

The baseline architecture is ready for implementation. Read `DEVELOPMENT_PLAN.md`
for the reviewed sequence and `REVIEW.md` for identified gaps. The scaffold is
not verified yet; documentation requirements below are not implemented features.

## 1. Create a Git repository

Use the development remote `git@github.com:skyscs/ai-engineering-workbench.git`.
Check its current refs first. Clone it into an empty development directory, then
copy this directory's contents into that checkout without the original ZIP.
Preserve any existing remote history. For a confirmed empty remote, the first
commit can record the imported scaffold:

```bash
git add .
git commit -m "chore: import v0.1 specification and unverified scaffold"
```

If you create a public GitHub/GitLab repository, keep all examples synthetic and do not commit corporate artifacts, URLs, tokens, logs, or source code.

## 2. Install prerequisites

- Node.js 22.12+ (Node 22 development line; pin an exact tested patch in Task 001)
- pnpm 10.15.0 as specified in packageManager
- Git

Then:

```bash
pnpm install
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

Task 001 is scaffolded, but installation, build and acceptance checks must be
completed first, including the review additions in its task file. Next run:

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

## Verification note for this generated scaffold

The files were created in an execution environment without access to the npm registry. Package installation/build/typecheck could therefore not be executed here. The scaffold should be dependency-installed and verified on the target development machine before Task 001 is considered fully closed.
