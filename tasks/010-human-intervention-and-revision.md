# Task 010 — Human intervention and revision loop

Status: accepted through the user's merge of PR #11 into main (18e621f). See [ADR 0014](../docs/decisions/0014-human-interventions-and-invalidation.md) and [the intervention guide](../docs/interventions.md).

## Goal

Allow the engineer to correct or challenge AI reasoning with a free-form prompt and create a new result version without losing history.

## Scope

- Intervention entity/API/UI
- support ASK, CHALLENGE, ADD_CONTEXT, CONSTRAINT, OVERRIDE at the domain level
- at minimum CHALLENGE and CONSTRAINT must execute end-to-end
- active constraints are automatically included in subsequent runs
- revised StageRun links to the intervention and superseded version
- prior result remains inspectable
- dependency/invalidation primitives are stored even if few downstream stages exist yet

## Acceptance criteria

- engineer can challenge Root Cause v1
- application creates a new StageRun and Root Cause v2
- v1 is marked superseded, not deleted
- UI shows what intervention caused v2
- adding a constraint affects subsequent AI instructions without the user repeating it manually

## Review additions

- Implement CHALLENGE and CONSTRAINT in UI/API. Other domain types are reserved;
  reject unsupported actions explicitly instead of presenting non-working controls.
- CHALLENGE creates a fresh run referencing the exact previous result/intervention.
  CONSTRAINT persists immediately, marks affected results stale, and applies to
  subsequent runs; it does not implicitly spend an AI run.
- Mark prior versions superseded only after successful publication of the new pair.
  Keep active/superseded separate from fresh/stale; failed revision keeps prior
  successful content and exposes the failed attempt.
- Input edits are blocked during an active run (cancel first). Between runs they
  increment context revision and mark dependent results stale. A plain ASK, when
  implemented later, must not invalidate a result.
- Reject stale-target/double submissions; a retry is another StageRun. Test
  constraint carry-forward, failed/cancelled revision, atomic publication, and
  transitive invalidation using domain fixtures without building future stages.
