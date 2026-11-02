# Task 070 — Connected-path consumer and provenance contract

Status: scoped before implementation, 2026-11-02.

## Baseline and authorization

Continue the owner's authorized development sequence on synthetic sources without model
calls. Task 069 merged as `9476b22` after exact head
`9263bce433816658794a2acd408e007408d9ff28` passed push run 41461640680 and pull-request
run 41461701867 (483 tests). The merge tree matches that head; fifteen fresh browser
checks pass. Phase C is navigation, not broader consumer or semantic acceptance.

## Scope

Implement Phase D's design decision only. Review current answer inputs/publication,
candidate links, correction snapshots/reapplication and inventory/history retention.
Specify consumer order, immutable provenance, historical replay vs current freshness,
complete support/coverage admission, dependency/purge boundaries and failure behavior.
Define a bounded next offline qualification before any new production consumer.

Keep default browser paths separate from question relevance and routing. Preserve existing
answer/review bytes, adapter namespaces, failed gates and exhausted evaluation budgets.
No parser/runtime/schema/API/UI change, stored graph, model call, corporate code, demo
restart or qualification rerun belongs to this task.

## Acceptance

- Trace actual source contracts and identify incompatible assumptions explicitly.
- Decide a smallest next slice with prospective acceptance and stop conditions.
- Distinguish structural/integrity verification from semantic/private-pilot acceptance.
- Update integration/development status and document the decision in an ADR.
- Review local document targets and exact diff; merge after both exact-head CI events pass.
