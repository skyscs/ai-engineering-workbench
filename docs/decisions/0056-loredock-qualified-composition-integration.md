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
Then integrate representation/ownership into existing v1 services with exact output
under the same test identity basis, lifecycle, original-validation and caller equivalence. Qualify that final
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

Task 100's source audit clarifies that the current fingerprint hashes the complete
analysis module. Representation edits change that fingerprint and derived generation
IDs. Preserve the fence, test explicit reanalysis and rollback incompatibility, and
do not claim byte identity across versions. The behavioral test reference deliberately
shares the current fingerprint provider; it is not a historical runtime replay.

Task 102's [compiled-boundary review](../loredock/FINAL_QUALIFICATION_BOUNDARY.md)
rejects the conditional v1-to-experiment identity adapter: topic witnesses, exact
shared charges, derived IDs and publication/history are absent or different in v1.
Implement the internal native versioned producer and complete typed capture before
the final compiled resource qualification; keep the browser on v1 until that gate
passes. No path-only substitute, relaxed threshold or old-result reinterpretation
is accepted. Task 103 scopes the internal producer without exposing a new consumer.
