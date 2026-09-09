# AGENTS.md — Development Rules for AI Engineering Workbench

These instructions apply when a coding agent works on this repository.

## Core behaviour

All project artifacts, documentation, code comments, task descriptions, generated
reports, and commit/PR titles and descriptions must be exclusively in English.
This rule applies regardless of the language used in conversation with the user.
Conversational replies may use the language the user is currently using.

1. Implement only the explicitly assigned task or task sequence from `tasks/`. For reviews/planning, update the requested documentation without implementing product features.
2. Read `README.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `WORKFLOW.md` before making architectural changes.
3. Do not broaden scope because a future feature would be convenient.
4. Prefer simple, explicit code over framework-heavy abstractions.
5. Preserve package boundaries. `packages/core` must remain infrastructure-independent.
6. Do not introduce cloud services, hosted databases, remote telemetry, or external persistence.
7. Do not add a direct OpenAI API dependency in v0.1 unless a task explicitly asks for it.
8. Do not parse or copy Codex authentication/session secrets.
9. Do not mutate the user's normal Git checkout during synchronization.
10. Treat investigation as read-only.

## Quality

- TypeScript strict mode.
- Validate external/process input at boundaries.
- Use focused unit tests for domain invariants and Git/storage behaviour.
- Prefer integration tests for process adapters where practical.
- Never hide a failed external command; preserve stderr/exit code in a normalized error.
- Make filesystem paths platform-safe.

## Task completion

For each task:

1. implement the smallest complete change;
2. run relevant tests/lint/typecheck;
3. summarize files changed;
4. document any architectural decision that differs from the existing docs;
5. continue to the next task only if the user's explicit assignment already includes it; otherwise stop after the assigned task. A permitted sequence does not require renewed permission after each task.

Read `DEVELOPMENT_PLAN.md` and ADR 0004 for the revised task order and acceptance
rules. Current verification status is recorded in `docs/development-status.md`;
Task 000 follows Task 001 before Task 002.

## Product constraints

The Workbench is a **local-first developer tool with a web UI**, not a hosted SaaS and not an IDE replacement.

Human intervention and result versioning are core product capabilities. Do not design workflows that assume AI results are final or authoritative.
