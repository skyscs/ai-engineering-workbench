# ADR 0056 — Integrate representation separately from path semantics

## Status

Accepted for bounded implementation planning, Task 098, 2026-11-04. No application
behavior or production receipt consumer changes in this decision.

## Context

Task 097's complete two-process resource qualification passes. Its composed reader
also contains literal-topic semantics, distinct identities and offline receipt
accounting, whereas production serves connected paths v1. Current regression controls
and manifests deliberately depend on the pre-change production source.

## Decision

Follow the [integration review](../loredock/QUALIFIED_COMPOSITION_INTEGRATION.md).
First prove typed internal read-scope, immutable-pair and shared-budget primitives.
Preserve an explicit portable test-only baseline before changing source-bound tests.
Then integrate representation/ownership into existing v1 services with exact v1
output, lifecycle, original-validation and caller equivalence. Qualify that final
compiled composition on fresh inputs before claiming production scale acceptance.

Treat literal-topic derivation, new wire/receipt identities and durable receipt
ownership as separate migrations. Do not replace a TypeScript service with an
experimental factory or override emitted private methods. Keep application imports
independent of experiment scripts and test data. No user-facing cache or budget
configuration is introduced.

## Consequences

The successful resource experiment permits integration work, not automatic rollout
of every experimental capability. Preserved reference behavior prevents comparisons
from silently becoming self-comparisons. No database migration is needed for transient
representation; rollback preserves the stopped catalog and original historical bytes.
Private-project semantics, dense-code scale, question selection and L5 remain open.
