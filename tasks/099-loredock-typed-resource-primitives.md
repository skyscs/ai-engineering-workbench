# Task 099 — Type the qualified resource ownership primitives

Status: merged through PR #103, 2026-11-04; helpers remain unconnected.

Implement three internal TypeScript modules under `apps/loredock/src`: a bounded
prepared-read scope owner, the single immutable canonical fact/range pair and the
shared operation budget. Follow ADR 0056 and the qualified-composition integration
review. Keep all existing production services, schemas, wire identities, frozen
scripts/manifests and measured inputs unchanged. No service wiring is in scope.

The read owner accepts the owned SQLite handle and typed fresh-execution fallback;
only trusted SELECT / exact PRAGMA data_version reads are eligible. Preserve current
arguments/native values, 64 statements / 64 KiB SQL, bounded fallback, error eviction,
recursive busy fallback, nested/overlapping/expired-context isolation and close cleanup.
It never caches rows, changes writes/iterators or spans a transaction across yields.

The pair helper accepts validated facts/ranges, copies/freezes at most one exact
eligible fact-free shape up to 4 KiB serialized and otherwise returns original values.
Keep ordered gaps, distinct per-file evidence and source inputs untouched. Express
readonly output in types without weakening public AnalysisPayload validation.

The budget preserves one five-second / one-million-unit operation, exact path/receipt
subtotals, single path claim, cancellation, reducible internal bounds, synchronous
observer, close/idempotency and explicit errors. No HTTP fields or configuration.

Use independent tiny behavioral comparisons with the unchanged offline helpers;
cover fresh external writes/schema, SQL bindings/errors/bounds/overlap/expiry,
pair identity/immutability/fallback/UTF-8 limits and aggregate-only/deadline/ownership
budget refusals. Assert error codes and successful values rather than mirroring lines.
No fresh resource family or memory claim is needed for unconnected primitives.

Preserve first failures/logs; run strict/full checks and built-module imports. Review
the complete diff, verify frozen dependencies remain unchanged, and require both
exact-head CI events before merge. Next is the explicitly scoped reference-preserving
v1 representation integration, followed by final-composition qualification.

## Outcome

Scope `bc0b3b1` precedes implementation `c145eb9`. All three typed modules are
independent of experiment/test imports and current service wiring. Twelve tiny
comparisons with frozen helpers pass their first execution. Initial strict checking
finds three typing diagnostics in the new SQLite test; correction `5f006e0` changes
only test result declarations. All first logs remain
[retained](../docs/fixtures/loredock-typed-resource-primitives/README.md).

Full checks pass 609 tests/types/builds; the three built modules import and all
415 Task 097 dependencies remain unchanged. Complete diff/reference/hash review
precedes CI. Next preserve the independent test reference before the v1 service
integration; no resource claim or production behavior change follows here.

Final head `1ddac18` passed push 41822159152 and pull-request 41822228450 CI
(609 tests), then merged as identical-tree `efac695`.
