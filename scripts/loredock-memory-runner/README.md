# Offline diagnostic process runner

Task 078 repairs the process/JSON boundary without modifying Task 077's exhausted
worker, corpus or results. This internal runner has no application endpoint and
does not select or qualify a memory optimization.

`runDiagnostic` receives an owned corpus factory, expected corpus hash, size,
oracle and service constructors. `child.mjs` is its process entry point:

```text
node scripts/loredock-memory-runner/child.mjs ABSOLUTE_OUTPUT_ROOT ARM ABSOLUTE_TRUSTED_CONFIG_MODULE
```

The configuration module exports `config` and is executable trusted tooling, never
an indexed repository file or user-supplied application input. Run `same-process`
first, then `reopened-process`, then `instrumentation-control`, in separate processes.
Only the first prepares sources and copies a closed catalog. Each arm performs the
same eight capture/page/history operations. Existing output folders are refused.
A coordinator must provide watchdogs, record child exits, validate integrity and
resource outcomes independently, and check byte parity. An exit of zero only means
the worker returned without an operation/observer error; it is not resource acceptance.

The runner reuses Task 077's unchanged path/receipt/observer and stopped-copy helpers
on new inputs. Shared budgets, synchronous publication, source/manifest/original
guards and observation bounds remain unchanged. It normalizes only the prototype
of source rows: all own enumerable scalar columns, row order and values must match.
Unsupported prototypes, accessors, hidden fields and non-JSON scalar values fail.
Missing or extra columns fail comparison; no column subset or string coercion is used.

Ordinary CI covers `child.mjs` with the independent three-source locker regression
under `apps/loredock/tests/fixtures/`. All 24 operations must execute, retain exact
originals and return identical receipt/page bytes across processes. The test also
checks history after inventory eviction and a nonzero child exit on an altered
serialized source header. Separate real-SQLite tests cover JSON round trips and
negative column/value/order cases. These are functional regressions with no memory
acceptance assertion, model requests or frozen matrix imports.

Future attribution requires a separately frozen prospective fixture and protocol.
Do not point this runner at Task 077's old corpus or measurement directories.
