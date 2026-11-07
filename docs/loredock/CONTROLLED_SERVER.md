# Controlled production server tests

Task 164 repairs the functional parity gap identified by
[ADR 0070](../decisions/0070-loredock-complete-runtime-boundary.md).
A separate launcher imports emitted LoreDockServer and uses its asynchronous parser
readiness, service construction, protected loopback HTTP and joined shutdown.

The only production change is an optional typed constructor dependency, textRuntime,
passed to the existing Answers constructor. Omitting it preserves the default runtime.
The normal entry point and both experimental answer switches are unchanged. There is
no HTTP, environment, CLI or persisted selector for the injected implementation.
Answers-disabled startup never prepares or calls it.

## Test-only entry

After building packages and the LoreDock daemon, ordinary Node tests launch
scripts/loredock-controlled-server/launcher.mjs with one fresh canonical absolute
output directory. It creates owned data/, runtime/ and terminal.json. Existing
directories are rejected. The ephemeral loopback port retains production
Host/Origin/session/CSRF checks.

The deterministic runtime has no provider, subprocess or network implementation.
It retains exact prompt/schema/model/effort records, cites an issued original and
returns a synthetic question in the unknowns field. Fixed usage counts are test
data. One lease runs once and closes once. Abort cancels held preparation or dispatch;
close joins pending work before releasing ownership.

Controls are canonical newline-delimited JSON with sequential IDs and only stats,
hold-prepare, hold-run, release and stop. These are test controls, not product routes.
No control accepts executable paths, shell text or runtime flags. Signals and stdin
closure stop the same production owner.

| Boundary | Test limit |
| --- | --- |
| Control frame / count | 1 KiB / 32 |
| Pending test control requests / runtime leases | 1 / 1 |
| Runtime preparations | 4 |
| Request / response record | 128 KiB / 32 KiB |
| Total retained runtime records | 1 MiB |
| Launcher record / stdout | 4 KiB / 64 KiB |
| Parent-captured stderr | 64 KiB |
| Launcher wall timer | 30 seconds, requests shutdown |
| Joined shutdown | Reject completion beyond 10 seconds |
| Parent watchdog / cleanup fallback | 45 seconds / 10 seconds |
| HTTP request / response | 5 seconds / 1 MiB |

The shutdown threshold is checked after joining. The parent watchdog can kill its
owned process group if cleanup hangs. These ordinary test bounds do not prove
independent watchdog correctness, orphan closure or resource-contract compliance.
Tests await actual child closure before reopening or removing its catalog.

## Verification and limits

Source tests cover disabled startup, both answer modes, readiness, startup cancellation
and failure, repeated stop and actual parser closure; existing owner tests retain
default-runtime coverage. Emitted-process tests use fresh synthetic repositories and
real HTTP for prepared/legacy dispatch, cancellation, interrupted shutdown, invalid
controls and existing-directory refusal. Saved witness prompt bytes equal the runtime
request. Cancelled and interrupted attempts stay terminal after actual process exit.

The first process run exposed a declarative unknown in the fake response; production
correctly rejected it. Only the fake changed. The first full check exited 143 after
SIGTERM without a reported assertion failure. The second log was truncated during
the owner-reported workstation memory exhaustion; its exit status was lost. Both logs
are retained, and neither counts as a successful check.

The completed full check uses unchanged pnpm check with workspace concurrency one
and inherited affinity restricted to two CPUs. This limits local test parallelism;
it neither changes application memory limits nor supplies resource measurements.
See [logs and identities](../fixtures/loredock-controlled-server/README.md).
With the selected Node 22.23.2 / pnpm 10.15.0 toolchain on PATH, the local Linux
scheduling choice can be reproduced from the repository root:

```sh
python3 - <<'CHECK'
import os
os.sched_setaffinity(0, set(sorted(os.sched_getaffinity(0))[:2]))
os.environ["npm_config_workspace_concurrency"] = "1"
os.execvp("pnpm", ["pnpm", "check"])
CHECK
```

This is an ordinary development check, not the entry for a sealed resource run.

Only apps/loredock/dist/server.js differs among 148 compared emitted JavaScript modules:
it passes the optional dependency instead of undefined. The other 147 modules,
including 94 other LoreDock modules, remain byte-identical to the prior baseline.

The historical compatibility verifier reverses exactly three source edits and checks
the full original server hash. Task 140's delta manifest and archived originals are
unchanged; an unrelated server edit still fails. The frozen prepared-flow launcher
and exhausted families are untouched and uninvoked.

No browser, model, corporate repository, namespace or delegated-service experiment.
[Complete executor gaps](COMPLETE_EXECUTOR_LAYOUT.md), v2 application resources, answer
semantics, L5 and the Workbench bridge remain unqualified.

## Source fencing and owner recovery

[Task 165](../../tasks/165-loredock-server-fencing-recovery.md) extends the same dependency
through three protected HTTP scenarios. Revoking an uncited input source or excluding
paths aborts a held prepared answer, closes its lease once and hides earlier/pending
derived content. No late fake output is retained for the fenced request.

An actual orderly stop followed by a new production owner preserves successful and
interrupted history. HTTP reads return the same context/native context and successful
answer values. Startup and replay of the interrupted request make zero runtime calls;
an explicit fresh preparation/request creates one distinct successful attempt.
No SQL statuses are edited to manufacture recovery. This does not simulate abrupt
process loss or establish orphan closure.

The bounded HTTP client and polling helper now live in http.mjs; their bodies are
unchanged. The existing launcher and runtime remain unchanged. All 148 emitted JavaScript
modules match accepted Task 164. Thirteen focused tests and 1,254 full Node tests pass,
with ten Python suites, ten typechecks and ten final builds. See the
[seven retained logs and review](../fixtures/loredock-server-fencing-recovery/README.md).
The [next task](../../tasks/166-loredock-first-use-documentation.md) simplifies first-use
documentation; resource and semantic gates remain separate.
