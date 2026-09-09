# Task 000 — Early runtime feasibility check

## Placement and goal

Run after Task 001 and before Task 002. Retained original task numbers are not
the execution order for this one additional task. Reduce runtime risk before
building the storage/UI workflow around an assumed CLI contract.

## Scope

- Create a small synthetic Git history and a second repository plus text artifact.
- Record installed Codex version and supported non-interactive flags, without
  reading authentication files or logging secret configuration values.
- Test an explicitly selected existing connection: JSONL events, schema output,
  both repository read roots, read access to the copied artifact, timeout and cancel.
- Verify attempted writes to either repository are denied by the execution policy;
  snapshot comparison is an additional check, not a replacement for sandboxing.
- Identify enabled external tools/hooks/project configuration that could bypass
  local write restrictions. Document the supported investigation configuration;
  do not silently override corporate routing or weaken restrictions to pass.
- Save redacted event fixtures and a short compatibility note for Task 008.

## Acceptance

- A structured synthetic result is obtained and both repositories are cited.
- Original files and Git state remain unchanged; cancellation stops owned children.
- Missing auth/profile, unsupported flags and policy failures are distinguishable.
- If selected configuration cannot meet mandatory read-only requirements, mark
  it unsupported and document the concrete limitation before proceeding with 008.

## Non-goals

No production runtime adapter, SQLite, workspace CRUD, direct API, or real user
repository investigation. This spike validates feasibility; Task 008 owns implementation.
