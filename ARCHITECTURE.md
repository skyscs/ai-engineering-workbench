# Architecture — v0.1

## Architectural style

Review baseline: ADR 0004 and DEVELOPMENT_PLAN.md refine execution, recovery and
task sequencing. These describe intended v0.1 behavior, not current scaffold capabilities.

The product is a **local-first application with a web UI**.

```text
Browser
   |
   | localhost
   v
Local daemon
   |-- Task / workflow API
   |-- Storage
   |-- Git integration
   |-- Artifact access
   |-- AI runtime adapter
   |
   +--> SQLite
   +--> Local filesystem
   +--> System git
   +--> Codex CLI
```

The browser never accesses repositories or arbitrary local files directly. The daemon owns privileged local operations.

## Technology baseline

### Web

- React
- TypeScript
- Vite

### Daemon

- Node.js 22.12+ (pin a tested Node 22 patch during bootstrap)
- TypeScript
- Hono

### Persistence

- SQLite for structured state and metadata
- Filesystem for repositories, worktrees, uploaded/copied artifacts, and generated reports

### Package management

- pnpm workspaces

### Git

- system `git` executable
- existing SSH agent / Git Credential Manager / credential helper
- application must not ask for repository passwords when system Git already works

### AI — first runtime

- Codex CLI subprocess
- existing Codex authentication and config are reused
- corporate proxy/model rules remain outside the Workbench when already configured in Codex

## Package boundaries

```text
apps/daemon
  HTTP transport, process lifetime, browser launch, API wiring

apps/web
  user interface only; no direct filesystem or Git access

packages/core
  entities, IDs, enums, domain invariants, dependency rules

packages/storage
  SQLite repositories, migrations, filesystem layout, artifact persistence

packages/git
  repository validation, clone, fetch, status, refs, worktree creation/removal

packages/ai
  AIRuntime abstraction, CodexCliRuntime, model profiles, event normalization

packages/workflow
  task state machine, stage runs, versioning, intervention handling, invalidation

packages/shared
  transport-safe DTOs and shared utility types
```

Dependencies should generally point inward toward `core`; `core` must not depend on UI, Hono, SQLite, Codex, or Git implementations.

## Local data layout

The root directory is resolved using platform conventions and can later be configurable.

Example on Linux:

```text
~/.local/share/ai-engineering-workbench/
  workbench.db
  repositories/
    <repository-id>/
  tasks/
    <task-id>/
      artifacts/
      generated/
  worktrees/
    <task-id>/
      <repository-id>/
  logs/
```

Equivalent platform application-data directories should be used on macOS and Windows.

## Repository strategy

### Registration

A repository can be:

- an existing local Git checkout; or
- cloned into the Workbench-managed repository directory.

### Synchronization

Use:

```bash
git fetch --all --prune
```

Do **not** run `git pull` automatically.

The product must not mutate the user's normal working checkout as part of synchronization.

### Task isolation

Each task creates one Git worktree per selected repository from a chosen base ref.

```text
worktrees/<task-id>/<repository-id>/
```

This makes later agent-driven implementation safer and prevents parallel tasks from contaminating each other.

For v0.1, resolve the chosen ref to a commit SHA and create detached worktrees.
Record the source SHA and retain an app-owned pin ref while results depend on it.
Worktrees isolate task checkout contents, not process permissions or credentials.
Git operations are serialized by common git-dir. Cleanup refuses dirty, unknown
or active worktrees and uses Git's worktree lifecycle rather than force deletion.

## AI runtime abstraction

```ts
interface AIRuntime {
  run(request: AIRunRequest): AsyncIterable<AIEvent>;
}
```

Conceptual request fields:

```ts
interface AIRunRequest {
  workspaceId: string;
  taskId: string;
  stageRunId: string;
  aiConnectionId: string;
  workingDirectory: string;
  contextManifest: RunContextManifest;
  instructions: string;
  modelProfileId?: string;
  outputSchemaVersion: string;
  accessMode: "read" | "write";
  signal: AbortSignal;
}
```

This is an internal conceptual interface, not a browser DTO. The manifest records
selected repository IDs, canonical read roots and commit SHAs, artifact IDs/hashes,
included/excluded context and active constraint snapshots. The adapter must make
all selected roots readable using verified CLI capabilities. A single cwd or
symlink does not by itself establish access. Reject accessMode="write" in v0.1.

Persist an immutable snapshot of requested connection/profile settings, input
manifest and prompt/schema/CLI versions before execution. Do not persist credentials.
CLI flags remain adapter-private, and raw extra arguments are not model-profile fields.

v0.1 ships only `CodexCliRuntime`.

Future runtimes may include:

- direct OpenAI Responses API;
- OpenAI-compatible corporate endpoints;
- local models;
- additional coding-agent CLIs.

The workflow package must not know how a provider authenticates.

## AI connection vs model profile

These are deliberately separate.

### AI Connection

Defines **where data is allowed to go** and how the runtime is reached.

Examples:

- Corporate Codex CLI profile
- Personal Codex CLI login

A Workspace is bound to one AI Connection in v0.1.

### Model Profile

Defines the requested model/execution profile for an individual stage run.

Examples:

- Corporate Terra
- Corporate Sol
- Deep Investigation
- Fast Classification

A user may override the model profile for a run only within the Workspace's AI Connection.

## Workflow result versioning

Important AI-derived artifacts are append-only versions, not mutable blobs.

Example:

```text
Investigation v1
Root Cause v1

User challenges conclusion

Investigation v2
Root Cause v2
```

Old versions remain inspectable and become superseded only after successful
replacement. Content is immutable; status is lifecycle metadata. Track freshness
separately so an active result can be stale without a successful replacement.

One v0.1 invocation returns the investigation/root-cause pair. Validate both and
publish them in one transaction; a failed revision preserves the previous pair.

## Execution and local recovery

StageRun storage is introduced in Task 006, before the runtime adapter in 008.
Allow one active AI run per task and one AI process per daemon; reject additional
starts with busy. Persist events for bounded SSE replay. The daemon owns process
lifetime; browser disconnection does not cancel a run. On restart, mark interrupted
runs failed with an interruption reason and offer explicit retry as a new run.

SQLite/file operations use durable operation state, staging and reconciliation,
not a claimed cross-resource transaction. Each feature supplies recovery when
introduced; Task 011 verifies those guarantees. See ADR 0004 for lifecycle rules.

## Dependency and invalidation model

Stage results record the upstream versions they depend on.

When an upstream result is revised, downstream results become stale/invalid rather than silently remaining “valid.”

Future example:

```text
Root Cause v1
  -> Plan v1
  -> Implementation v1

Root Cause v2 created
  => Plan v1 STALE
  => Implementation v1 STALE
```

The dependency mechanism should exist in the v0.1 domain model even before implementation stages are added.

## Deterministic vs AI responsibilities

### Deterministic application code

- state transitions
- persistence
- filesystem paths
- repository synchronization
- worktree lifecycle
- credential boundaries
- policy enforcement
- schema validation
- version/invalidation bookkeeping

### AI responsibilities

- interpreting task/artifact content
- finding likely relevant code
- reconstructing history
- forming hypotheses
- explaining evidence
- revising conclusions after human feedback

If a result can be computed exactly, compute it in code rather than asking a model.
