# Production parser observation coverage

Status: prospective ordinary investigation, before any Task 141 measurement.

Task 140 is accepted through [PR #173](https://github.com/skyscs/ai-engineering-workbench/pull/173),
head `a8c7b44f77370848a39ce97aef6aeb42b40402af`, identical-tree merge
`410e9acd4e113a0175e806444f31b8b9273cd887`. Both complete CI logs pass 1,125 tests,
ten typechecks and ten final builds. Its application implementation stays fixed here.

## Prospective control

The [ordinary plan](../../scripts/loredock-parser-coverage/plan.mjs) fixes two small
synthetic source files, source/emitted order, pinned runtime, deadlines, observer bounds
and exclusive output before implementation or execution. Each mode runs a real server,
indexes a fresh repository, completes native analysis and a foreground graph, idles,
stops and reopens its catalog. No model or browser runs. The independent owner records
the actual process exit, process/session/thread census and immutable input inventories.
The original application sources and emitted modules must match the accepted base.
Observer tests use controlled promises and clocks; they do not consume this first run.

## What the facilities mean

Node's asynchronous `worker.getHeapStatistics()` is available on the pinned runtime;
it can reject when the worker is not running. The returned object has no sample timestamp.
See the [Node 22.23.2 API](https://nodejs.org/download/release/v22.23.2/docs/api/worker_threads.html#workergetheapstatistics).
The native implementation requests an interrupt, gathers V8 statistics inside the worker,
then schedules delivery to the parent. An inference from this implementation is that a busy
JavaScript task need not prevent a sample, but request/completion timestamps only bracket
its unknown instant. See [node_worker.cc](https://raw.githubusercontent.com/nodejs/node/v22.23.2/src/node_worker.cc)
and [node_worker.h](https://raw.githubusercontent.com/nodejs/node/v22.23.2/src/node_worker.h).
Before the worker Environment is published, and during teardown, a request may be rejected.

Parent `heapUsed` excludes worker isolates; process RSS includes their resident memory.
Neither adding independent maxima nor pairing asynchronous worker results with parent
values measures a simultaneous aggregate heap peak. The time before JavaScript observer
entry is uncovered, even if the first interval looks quiet. Track constructor entry/return,
online, protocol ready, requests, completions, exit and pending requests at close explicitly.
Never replace missing or rejected values with zero. Record bounded instrumentation overhead
as part of this diagnostic, without claiming an uninstrumented performance result.

Installed tsx 4.23.13 chooses synchronous module hooks on Node 22.23.2 unless an earlier
TypeScript preload changes registration. Therefore source mode does not necessarily create
an asynchronous Node loader thread. Node documents the difference in
[module customization hooks](https://nodejs.org/download/release/v22.23.2/docs/api/module.html#communication-with-module-customization-hooks).
Installed esbuild 0.28.2 also contains a synchronous-transform worker service and native
child-process service. Audit their actual lifetimes; a parent-only public Worker wrapper
cannot establish the full nested/internal isolate set. Record installed loader hashes.
Native threads do not map one-to-one to V8 isolates, and a sampled process census cannot
prove the absence of very short-lived descendants.

## Decision rule

Successful startup, parsing and actual shutdown establish only lifecycle control.
Complete startup and whole-isolate heap remain blocked if any lifetime or isolate is
unobservable. Retain the failure and scope a concrete measurement/architecture decision
before a new ordinary near-limit gate. Keep all existing limits and consumed families
unchanged. The known browser baseline RSS failure needs a separate explicit decision.
