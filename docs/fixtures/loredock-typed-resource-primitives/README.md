# Typed resource primitives

Task 099 scope `bc0b3b1` precedes implementation `c145eb9`. Three internal TypeScript
modules now express the qualified helpers without importing experimental scripts:

- `PreparedReadScope` owns one bounded asynchronous statement scope for a caller's
  SQLite handle. Every read executes again with current arguments; only statements
  are retained. Count/text caps, busy/error fallback and nested/overlapping/expired
  context isolation match the frozen helper. `close` releases its references; the
  caller remains responsible for closing SQLite.
- `createCanonicalFactPair` exposes readonly retained values, copies/freezes one
  exact eligible fact-free shape and preserves the 4 KiB serialized bound and all
  fallback references. Inputs remain mutable and independent; the helper does not
  replace full payload validation or retain per-file evidence.
- `OperationBudget` retains one shared deadline/work ceiling, path/receipt subtotals,
  single path ownership, cancellation, synchronous observation and explicit errors.

The modules are **unconnected** to current production services. No schema, parser,
wire identity, old helper, measured input or application behavior changes. The
prepared scope takes a typed SQLite handle and fresh-execution fallback rather than
subclassing the production store or accessing emitted private methods.

First strict typecheck exits 2 on three new-test typing diagnostics: an implicitly
typed result array and a spread of an untyped SQLite result. Correction `5f006e0`
adds explicit result types only. The next typecheck passes. All **12 independent
behavioral comparisons pass on their first execution**, covering native bindings,
fresh rows/external schema writes, preparation counts and bounds, failure cleanup,
recursive/nested/overlapping/expired owners, immutable values, UTF-8 boundaries,
aggregate-only budget exhaustion, deadline/cancellation and observer failures.

Full checks pass **609 tests**, strict types and builds. All three built modules
import successfully. All **415 Task 097 dependency files** remain byte-identical;
the three new files do not rewrite the frozen composition. `validation.json` retains
seven first/corrected logs with normalized exit codes and raw/archive hashes.
No resource family, profiler, model request, corporate source or user demo is run.

Next preserve the portable independent reference required by ADR 0056 before wiring
these helpers into production v1. Typed equivalence does not itself qualify that
future composition or establish a memory saving. Both final-head CI events and an
identical-tree merge remain required.
