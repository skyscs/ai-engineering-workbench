# One-command synthetic demo verification

Task 050, 2026-11-01. Scope `8d8594b` follows PR #53 / main `1fafc0a`. The source-build
`pnpm loredock:demo` command prepares a separate twenty-source example and starts the
normal compiled daemon with model calls disabled. See
[ADR 0044](../../decisions/0044-loredock-isolated-synthetic-demo.md).

Strict types, all 399 tests and production builds pass. Five new integration tests verify
twenty owned source roots, 79 admitted files, sixty exclusions, 21 retained code files,
original short-name search and zero answer attempts. The preparer releases its database
owner so a new service can open the same data. Unpublished indexing and incomplete code
analysis are retained without retries. Interruption stops indexing before code analysis;
early cancellation retains the printed directory before any database is opened.

Two launcher tests verify inherited data/answer/development isolation without mutating
the parent environment, and shell-quoted reopening with spaces, quotes, backticks and
literal command-substitution text. The quoting check reads the actual child environment
with harmless marker strings. Occupied-port probing leaves its existing listener alive.
The probe immediately closes incidental connections before releasing the port.

The [browser result](browser-result.json) runs the actual `pnpm loredock:demo` command,
including its build. It deliberately inherits answer/development mode enabled and an
external sentinel data directory. The ready UI has twenty connected sources, 79 indexed
files and 21 examined code files without entering paths. Health reports model execution
disabled; the external directory remains unchanged. `StockProjection.accept` retains its
full qualified name and opens the inventory-worker original through the keyboard.

A second launch fails on the occupied port before generating a fixture, while the first
daemon continues serving the same index. Ctrl+C retains source/data files and an owned
manual marker file. Reopening through normal daemon startup keeps the same published
index and inventory IDs without reanalysis. A separate interrupted preparation retains
an interrupted index and starts neither code analysis nor a daemon. The 390px page has
no horizontal overflow; mobile screenshots were inspected locally.

The harness owns every process and temporary root and removes its own generated examples
after verifying retention. The product command retains examples on exit. No user data,
corporate repository or Codex configuration is read or modified by demo preparation;
no model, new full-volume benchmark or semantic acceptance run is involved.

Reproduce with the documented toolchain, installed dependencies, Chrome and port 4244 free:

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-demo-browser node scripts/loredock-demo-smoke.mjs
```

For manual exploration, use `pnpm loredock:demo` and the
[short review route](../../loredock/USER_GUIDE.md#try-the-synthetic-system). Stop with
Ctrl+C and keep the printed reopening command if you want the same notes/data later.
The OS may clean temporary directories; normal long-lived sources/data remain the right
choice for an actual project. Functional browser checks are not independent semantic review.
