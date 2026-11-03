# ADR 0055 — Inspect terminal ownership before the next capture optimization

Status: accepted for bounded diagnostic preparation, 2026-11-03. No diagnostic
execution or production change occurs in Task 085.

## Context

Task 084 repairs independent offline evaluation. Complete Task 079 captures fail
heap/RSS limits; Task 080 identifies allocation stacks, not live retained objects.
Task 082 has an incompatible positive fixture and independent same-process memory
failures. Saved immediate-close samples keep the same RSS, but do not establish a
leak, native SQLite ownership or allocator release behavior.

## Decision

Follow the [ownership decision](../loredock/MEMORY_OWNERSHIP_DECISION.md): prepare
one fresh positive long-lived diagnostic, with exactly two terminal heap snapshots
after the normal sequence completes. Inspect the first after evicted history with
services open and the second after explicit shutdown/reference release. Implement
and verify its bounds/child/parser boundary on tiny independent examples before
authoring and freezing resource inputs.

Snapshot generation performs collection and changes memory. It runs outside all
application operation intervals, has its own finite parent-supervised diagnostic
bounds, and cannot supply resource acceptance. Preserve raw artifacts and failures;
unknown/native ownership stays unknown. Assessment runs outside the observed worker.

No statement cache or compact payload representation is selected. Any later fix
needs an evidenced ownership path or separately scoped observation, then independent
regressions and fresh uninstrumented complete-path same/reopened qualification.
All existing operation limits, original support, domains, charges and fences stay.

## Consequences

This separates post-operation reachability from allocation sampling without another
broad matrix. It cannot explain the in-operation peak, attribute all RSS, or estimate
normal close savings from two already-perturbed snapshots. Empty/expected owner sets
are valid diagnostic findings, not evidence that qualification passed. Old families
remain exhausted, and the streaming candidate stays outside production.
