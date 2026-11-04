# Task 101 — Integrate resource ownership into connected paths v1

Status: scoped for implementation, 2026-11-04.

Use the typed Task 099 primitives and portable Task 100 behavioral reference to
integrate only transient representation into production services. Keep the existing
v1 resolver/topic rule, wire schema, query surface, user controls, original evidence
and consumer separation. No shared-budget/receipt or literal-topic migration here.

Stream `CodeAnalysis.snapshot` with identical authorization, ordered checkpoint/
count/byte/manifest validation and parsed IDs. Scope the actual asynchronous worker
invocation in the existing scheduler, preserving its shared ownership guard,
catch/finally, pause/resume/cancel/stop and short transactions. Add one typed read
scope owner to each store, initialize safely around constructor reads, use it only
for explicit `one`/`all` scopes and release it before closing SQLite. Writes and
direct iterators remain fresh and unchanged.

Scope the existing path read owner; retain full payload validation before compact
facts/ranges/evidence entries and one readonly canonical pair per request. Preserve
all files, gaps, domains, alternatives, work, consumed hashes, final snapshots and
metadata/source/policy fences. Narrow internal types only as needed; no unsafe cast
may hide missing required payload fields or mutable shared arrays.

The analysis implementation participates in the parser fingerprint. Keep that
existing computation: old inventories become incompatible, and reanalysis creates
new generation IDs. Preserve originals and recorded history; test old-fingerprint
refusal, explicit reanalysis and backward reopen. Never claim cross-version byte
identity or silently reuse the old fingerprint. Same-identity test controls must
still preserve complete v1 output and all original/SQL/work behavior.

Use the independent reference for exact snapshot/payload and stopped-copy worker
comparisons. Before editing the current path reader, preserve its exact v1 behavior
as an additional explicitly sourced test control, without altering Task 100's original
store/analysis archive. Add production v1 path comparisons and negative/overlap/lifecycle
regressions; keep all historical helper tests and measured files unchanged. Exercise
actual protected HTTP services, launcher/fallback wiring, exact symbol lookup and
the built browser with owned data, including busy/retry, cancellation/stale responses,
originals, root pages and desktop/mobile layouts. Do not start the user's demo.

Retain first failures/logs, run full strict checks/builds, review production imports,
complete diff and preserved references, then require both exact-head CI events.
No production scale acceptance follows until a separately frozen qualification of
the final compiled composition passes unchanged gates. No model/corporate input,
new receipt storage, automatic routing or L5 claim is in scope.
