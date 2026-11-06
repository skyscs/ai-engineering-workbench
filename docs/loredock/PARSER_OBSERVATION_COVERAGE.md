# Production parser observation coverage

Status: first ordinary investigation retained; lifecycle passes, observation coverage fails.
The method below was committed at `fd4f2e3` before candidate `7080e75` ran once.

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

## First result

The [complete retained record](../fixtures/loredock-parser-coverage/README.md) contains both
actual process exits, raw parent samples, worker requests/completions, process census,
catalogs, synthetic Git sources and candidate/installed-loader bytes. No output was rerun.
All 95 emitted LoreDock modules match the accepted Task 140 checkout byte for byte.
Application sources, packages, schemas, defaults and resource ceilings are unchanged.

| Diagnostic | Source | Emitted |
| --- | ---: | ---: |
| Whole child lifetime, ms | 846.277 | 481.120 |
| Listening at process performance clock, ms | 648.359 | 285.603 |
| Parent samples | 48 | 37 |
| Maximum raw parent interval, ms | **324.833** | 72.231 |
| Sampled parent heap maximum, bytes | 21,312,392 | 13,645,312 |
| Whole-process RSS high water, bytes | 203,759,616 | 170,586,112 |
| Sampled process-tree RSS maximum, bytes | 238,866,432 | 170,586,112 |
| Heap requests fulfilled / rejected / pending at close | 77 / 5 / 1 | 21 / 4 / 0 |
| Longest heap request/completion interval, ms | 81.519 | 78.615 |

Each mode indexes the two synthetic files, publishes one parsed native file without gaps,
produces a three-node foreground graph, joins the parser's actual exit and reopens an
integrity-checked catalog. Both children exit 0 naturally; no descendants remain and
neither needs forced cleanup. This is a lifecycle result, not a knowledge-quality score.
The production worker exits with code 1 after deliberate termination; its parent exits 0.

The source parent's public constructor observes an esbuild helper and the parser worker.
The helper is still live at observer close and naturally ends with the process; its first
successful heap window begins 308.842 ms after creation. The parser's first successful
window starts 25.988 ms after creation. The external census also observes two esbuild
native child processes. The parser's nested loader/service internals are not observed by
the parent wrapper; native thread counts cannot establish an exhaustive V8 isolate set.

The emitted parser's first successful window is 27.754–27.915 ms after creation. Its
last successful window ends 13.694 ms before actual worker exit. Even this simpler mode
has unavailable early/late heap and delayed results during its lifetime. JavaScript
observer entry itself starts after process bootstrap. External census requests have gaps
up to 26.562/25.389 ms. Those are actual sampling limits; a requested 10-ms cadence does
not guarantee 10-ms observations.

The source interval violates the unchanged 100-ms ceiling in this instrumented control.
The emitted interval and RSS values remain diagnostics: neither repairs incomplete
startup/isolate coverage. Worker heap maxima are available individually in the raw ledger;
there is no simultaneous aggregate heap value. Source loader caches were not controlled,
and no cold-cache, browser, near-limit or uninstrumented performance claim is made.

Eight focused observer regressions cover slow/rejected/missing samples, exit, late delivery,
bounded capacity and separate isolate maxima. Next, [Task 142](../../tasks/142-loredock-resource-observation-decision.md)
decides whether a supported measurement boundary can satisfy the original contract before
spending another near-limit attempt. It does not authorize a relaxed ceiling or gate.
