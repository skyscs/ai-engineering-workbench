# Workflow Model — v0.1

## Task lifecycle

The task lifecycle is stateful and explicit.

```text
CREATED
  |
  v
CONTEXT_READY
  |
  v
INVESTIGATING
  |
  v
INVESTIGATION_READY
  |
  v
ROOT_CAUSE_READY
```

A failed stage does not advance the task. Failure details belong to the `StageRun`.

One v0.1 AI invocation produces investigation and root cause together. Validate
and publish the pair transactionally; INVESTIGATION_READY is an internal
intermediate transition rather than a separately completed AI invocation.
Task status reports workflow progress; prior result versions remain inspectable
during a new run. A failed/cancelled run restores the last completed task state.

Human interventions can create new versions and move the task back into a running state without deleting prior results.

## Stage concepts

### Context preparation

Deterministic preparation of:

- task description;
- selected repository metadata;
- task worktree paths;
- imported artifacts;
- active constraints.

### Investigation

AI-assisted analysis whose goals are:

1. understand the reported problem;
2. inspect relevant code;
3. inspect relevant history;
4. reconstruct how current behaviour emerged;
5. identify candidate root causes;
6. reference evidence.

Investigation must explicitly instruct the runtime not to implement a fix.

### Root cause

A structured conclusion derived from an investigation version.

Conceptual shape:

```ts
interface RootCauseResult {
  summary: string;
  confidence?: number;
  hypotheses: RootCauseHypothesis[];
  evidenceIds: string[];
  unresolvedQuestions: string[];
}
```

The exact schema can evolve after the first experiments; evidence linkage is mandatory.

## Human intervention loop

Human intervention is a first-class workflow operation, not an emergency chat feature.

Supported conceptual types:

- `ASK` — request an explanation without invalidating the current result;
- `CHALLENGE` — dispute the current conclusion and re-run reasoning;
- `ADD_CONTEXT` — add new artifact/text and reconsider the result;
- `CONSTRAINT` — add a rule that applies to current and future stage runs;
- `OVERRIDE` — engineer explicitly supplies an authoritative conclusion/direction.

The UI can offer shortcuts, but free-form natural-language input is always available.

v0.1 executes CHALLENGE and CONSTRAINT through the UI/API. The other types are
reserved domain concepts and return unsupported errors until implemented; do not
display them as available actions. Context editing/import remains possible between
runs without implementing ADD_CONTEXT as an AI intervention operation.

## Revision behaviour

Example:

```text
Root Cause v1
  "Regression introduced in CallbackDialog migration"

Engineer challenge:
  "This component predates the commit. Inspect NumericInput history."

Root Cause v2
  "Regression originated in useCallbackConfig refactor"
```

v1 remains stored and becomes superseded only after v2 is validated and published.
A failed or cancelled revision leaves v1 active. Content is immutable; lifecycle
metadata can change. Track freshness independently from active/superseded status.

Changes to description, selected repositories, artifacts or constraints increment
the task context revision and immediately mark dependent results stale. Context
edits are blocked while a run is active; cancel first or edit after completion.
CHALLENGE targets a specific result and creates a fresh run. CONSTRAINT persists
without implicitly starting an AI run and is included in subsequent runs.

The revised result should record:

- previous version id;
- triggering intervention id;
- model profile/runtime used;
- timestamp;
- evidence set;
- short explanation of what changed where available.

## Constraints

Constraints are persistent task-level instructions, for example:

- no backend changes;
- do not add dependencies;
- preserve existing public API;
- inspect history before proposing a fix.

Even in v0.1, active constraints should automatically be included in every relevant AI run.

## Stage run

Every AI or expensive deterministic execution is represented as a `StageRun`.

Conceptual fields:

```ts
interface StageRun {
  id: string;
  taskId: string;
  stage: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  aiConnectionId?: string;
  modelProfileId?: string;
  startedAt?: string;
  completedAt?: string;
  previousVersionId?: string;
  triggeredByInterventionId?: string;
}
```

This makes model choice, retries, revisions, and future cost/usage reporting explicit.

Persist the run/input snapshot before spawning. One active run per task and one
AI process per daemon are allowed in v0.1. Reject duplicate/busy starts. The input
snapshot fixes description, selected commit SHAs, artifact hashes, constraints,
requested connection/profile and prompt/schema versions.

Cancellation is idempotent and stops the owned process tree. Publication and
cancellation use atomic terminal transitions so only one outcome wins. Daemon
restart marks unfinished runs failed/interrupted and exposes explicit retry;
retry creates another StageRun. Browser reconnect reads persisted run/events;
it neither cancels nor restarts execution.
