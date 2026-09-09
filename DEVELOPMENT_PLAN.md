# Iterative development plan — v0.1

## Goal and current state

Development repository: `git@github.com:skyscs/ai-engineering-workbench.git`.
The first release investigates defects, presents evidence and revises conclusions
after human intervention. Agent-driven code implementation remains outside v0.1.

Task 001 implementation and checks are tracked in [Development status](docs/development-status.md);
subsequent tasks are not implemented yet.
This document replaces the initial discussion plan. REVIEW.md explains findings;
ADR 0004 records architecture decisions. Original task numbers are preserved.
All project artifacts, documentation, code comments and commit/PR descriptions
must be written exclusively in English, regardless of conversation language.

## Sequence and demonstrable outcomes

| Order | Tasks | Work | Exit criteria |
| --- | --- | --- | --- |
| 1 | 001 | Prepare a checkout of the target remote and import the scaffold without the ZIP/local data; establish Node 22.12+, pnpm 10.15.0, lockfile, checks and local API foundations. | Clean install/typecheck/build; working dev and production UI; JSON API 404; rejected unauthorized origins. |
| 2 | 000 — early spike | Validate real Codex CLI against synthetic history: profile, read-only policy, two repositories, artifact access, JSONL/schema, failure and cancellation. | Record compatible CLI/configuration and limitations; obtain structured output without modifying source files. Resolve critical adapter limitations before production integration. |
| 3 | 002 → 003 | SQLite/migrations/directories, then Workspace, AI Connection, ModelProfile and minimal UI. | Settings survive restart; cross-connection profiles are rejected; repeated initialization/migration is safe. |
| 4 | 004 → 005 | Register existing/cloned repositories and implement explicit fetch. Start validation with a local fixture, then clone. | Registration/sync work; dirty checkout, index and HEAD are preserved; actionable Git errors. |
| 5 | 006 → 007 | Task, immutable artifacts, minimal StageRun/input manifest, then detached worktrees. | Prepare a two-repository task with an artifact through the UI; retry/failure does not duplicate or corrupt state. |
| 6 | 008 → 009 | Runtime adapter and first complete investigation workflow with validated evidence locators. | Real task → worktrees → investigation → root cause flow; deterministic FakeRuntime covers the same workflow in tests. |
| 7 | 010 | Challenge/constraint, result history and stale dependencies. | v2 records the revision; v1 remains inspectable; failed revision preserves the prior report; constraints carry forward. |
| 8 | 011 | Stabilization, Markdown export, Linux documentation and three acceptance investigations. | Release criteria pass, including restart/cancel/retry/challenge; record the verified release state. |

Demonstrate a persisted workspace after step 3, a prepared task after step 5,
a useful report after step 6 and human revision after step 7. Avoid polishing full
CRUD/UI before the first complete report. Create a small smoke fixture in Task 000,
reuse it throughout development, and complete three substantial release cases in 011.

## Delivery rules

- Keep one task or explicitly bounded task segment per branch/change. Link task,
  commits and validation evidence. Multiple commits are fine when review fixes
  make them clearer than an artificial one-commit rule.
- Before implementation, make the task's acceptance criteria concrete. Implement
  the smallest complete result, validate it and update status/documentation.
  Record significant architectural departures in an ADR.
- Track `not started`, `in progress`, `verified`, `accepted` and remaining limitations.
  Verification requires relevant checks and scenario evidence; user acceptance
  is recorded separately. A scaffold or passing typecheck is not a working feature.
- Follow the user's assigned scope: stop after a single assigned task; continue
  an explicitly authorized sequence without requesting approval at every task.
  Discuss material product changes separately.
- Establish reproducible checks in 001. CI uses source code and synthetic fixtures,
  without Codex credentials or real investigation data.
- Declare workspace package dependencies and keep core infrastructure-independent.
  Do not introduce a generic workflow platform, service queue or event sourcing.

## Minimum contracts

- JSON HTTP APIs validate external inputs and return stable error codes.
  File access resolves registered entity IDs rather than arbitrary file paths.
- Persist StageRun and its input snapshot before execution; the daemon owns the
  process. Start returns a run ID; SSE sends persisted events with sequence IDs.
  Reconnecting reads retained events; closing a browser does not cancel the run.
- v0.1 permits one active AI run per task and one AI process per daemon.
  Additional starts return explicit busy rather than entering a hidden queue.
  Serialize Git mutations by common git-dir; reject a second daemon for a data root.
- AIRunRequest includes connection/profile selection, instructions, repository/
  artifact manifest and read roots, schema version and cancellation signal.
  Provider-specific launch arguments remain inside the adapter.
- One AI invocation returns both investigation and root cause; validate and publish
  the pair atomically. INVESTIGATION_READY is an internal intermediate transition,
  not a requirement for a separate successful AI call.
- Retry creates a new StageRun. Restart marks unfinished runs failed/interrupted;
  explicit retry is available. Automatic paid retries or CLI session resume are
  not required for v0.1.

## Validation and release

For each task, run typecheck and relevant behavioral tests; run build when changing
application/build/package integration. At checkpoints, validate a clean installation,
full build and browser smoke. Select and record test tooling in 001; avoid tests
that only mirror implementation details.

Required scenarios include unavailable Git/CLI, invalid JSON, process failure,
interrupted streams, cancel vs completion, restart during an operation, duplicate
requests, disk-full import, stale inputs, incorrect profiles, dirty worktrees,
unavailable artifacts and nonexistent evidence locators.

Release fixtures cover a single-repository regression, a two-repository interaction,
and an incomplete/incorrect initial conclusion corrected through challenge and
constraint. Each has known history, expected evidence and a manual review rubric.
Assess reasoning and evidence rather than exact generated text or a confidence
number. Insufficient evidence is a valid outcome; an invented proven cause is not.

Run real Codex smoke separately through an explicitly selected local connection;
ordinary tests require no AI requests. Release evidence includes three investigations,
restart persistence, version history, valid Markdown export and a reproducible
Linux demo. Test platform path conventions without claiming full macOS/Windows
support before validating those systems.
