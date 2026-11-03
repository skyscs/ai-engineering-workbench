# Diagnostic process regression verification

Task 078, 2026-11-03. The first focused and full checks all passed. No frozen
diagnostic corpus or matrix ran; these logs establish functional runner behavior,
not memory acceptance. No model requests were made.

| Check | Result |
| --- | --- |
| Real SQLite/JSON source rows and negative shapes | 2 tests pass |
| Actual child launcher on independent locker sources | 24/24 operations across three processes; exact receipt/page bytes and original support |
| Changed serialized source header | Expected exit 1, explicit stderr/report error, zero read operations |
| Focused daemon strict typecheck | Pass |
| Full `pnpm check` | Strict checks, 506 tests and builds pass |

The process regression checks closed initial snapshot hashes, repeated captures,
selected and isolated roots, paging, observer/control counts and history after
inventory eviction with zero nested path/fact work. Its ordinary functional test
removes owned temporary data after success and retains the directory on failure.
Child stdout/stderr/exit are archived before each assertion. Task 077's original
failing controls and resource gate remain unchanged.

`logs.json` lists uncompressed byte lengths, SHA-256 hashes and process exits for
the retained gzip logs. Reproduction uses Node 22.23.2 and pnpm 10.15.0:

```bash
pnpm install --frozen-lockfile
pnpm check
```

See the [task](../../../tasks/078-loredock-memory-runner.md) and
[internal runner](../../../scripts/loredock-memory-runner/README.md). Fresh
prospective attribution remains a separate task; no optimization was selected.
