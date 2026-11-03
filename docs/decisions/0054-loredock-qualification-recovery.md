# ADR 0054 — Separate useful-path expectations from recorded-artifact evaluation

## Status

Design decision, Task 083, 2026-11-03. Task 082 remains rejected and exhausted.
No runtime, evaluator implementation, adapter rule or resource limit changes here.

## Decision

Require a pinned source/adapter compatibility review before freezing positive
resource inputs. Keep unknown or unsupported constructs outside complete-path
expectations unless a separately scoped adapter task establishes their support.

For future offline qualification, retain intact raw bytes and structurally valid
first receipts before useful-path assertions. Evaluate artifact integrity, shape,
source support, usefulness, history, raw parity and resources independently with
explicit dependency states. Overall acceptance still requires every applicable
condition; byte equality or consistent incomplete history is not usefulness.

The [recovery contract](../loredock/QUALIFICATION_RECOVERY.md) fixes the preparation
checklist, dependency rules and independent regressions. Implement it separately
without changing exhausted coordinators/results. Review remaining memory evidence
before scoping another optimization or fresh complete qualification.

## Reasons and consequences

Task 082's authored `onIssued` method exceeds the preserved `onMessage` profile.
The resolver emits the correct gap, while the useful-path oracle fails. The
coordinator then loses its first receipt and raises dependent history errors.
Post-run readback can explain those errors but cannot repair acceptance scores.

Separate same-process heap and RSS failures also remain. Correcting preparation
and evaluation does not qualify snapshot streaming, prove a leak or authorize
production promotion. Preserve all original evidence, limits and user-data/model
boundaries. No general workflow framework or new product configuration is needed.
