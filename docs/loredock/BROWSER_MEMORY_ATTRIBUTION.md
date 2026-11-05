# Ordinary browser memory attribution

Task 134 follows accepted PR #166 (`63501cb`, identical-tree merge `1a03c04`). Both
complete CI logs pass 1,045 tests before merge. Application behavior and all resource
thresholds remain unchanged in this diagnostic task.

## Retained evidence

The first offline attribution at `eae8212` verifies all 223 archived ordinary Task 133
entries before reading them and again afterward. Its ten complete samples cover
1,019.920 ms. The exact peak is 1,403,904,000 summed resident bytes across sixteen
processes, exceeding 1,073,741,824 by 330,162,176. The declared Python collector and
browser root are identifiable; fourteen descendants have no recorded role. Kernel
lifetime records confirm ownership and successful cleanup, not the purpose of each child.

The retained observer records network events on UTC/CDP clocks and process samples on
the driver-relative clock without an exact bridge. Those samples cannot precisely
attribute the peak to preparation versus navigation/history. No blank-browser baseline,
process PSS or page heap was recorded. Summed process RSS counts shared resident pages
in each process; this fact does not authorize subtracting them from the fixed gate.

## Prospective first controls

Commit the plan, observer and explicit browser adapter before any new browser run.
Run once in this order, preserving first failures without retrying:

1. **blank-browser**: fresh isolated profile, same browser binary/flags/collector,
   `about:blank`, no daemon or application page; thirty-second idle window.
2. **indexed-ui**: independent complete copy of the fresh v1 baseline's stopped
   production catalog; production daemon and built UI, eight indexed sources,
   no answer or transient prepared context; thirty-second idle window.
3. **ready-and-saved**: independent complete copy of the v2 stopped checkpoint;
   production daemon, exact saved answer and fresh useful Ready through the real UI;
   thirty-second idle window. No new answer or runtime call.

Inputs are `/home/toshiba/aew/task133-native-v1-first` and
`/home/toshiba/aew/task133-native-v2-first`. The first observation belongs at
`/home/toshiba/aew/task134-browser-first`; exact sources/runtime/compiler/built assets
are copied to `/home/toshiba/aew/task134-browser-first-inputs` before execution.
The external kernel owner has a five-minute wall limit, the existing two-GiB total and
512-MiB per-catalog bounds, and two declared catalog roots. All source inputs remain
unchanged. No corporate code, real or controlled model call, consumed-family execution
or prior-run replay is used.

The adapter relocates the unchanged ordinary browser collector and exposes only a
blank-page option, changing its initial navigation/readiness predicate. Exact source
and resulting adapter hashes/deltas are retained. Chrome flags, raw RSS sampler, 100 ms
cadence, network retention, process ownership and cleanup remain unchanged. Every
lifetime sample, including startup and collector overhead, contributes to the raw peak.

Separate diagnostics record a driver clock bridge and phase boundaries. Starting after
initial page readiness, a 500 ms role observer uses the latest raw sample's owned
PID/start-tick identities, checks them before/after reading executable/argv, and records
vanished processes without guessing. It cannot classify startup children that already
exited. A final per-process `smaps_rollup` observation retains exact kernel bytes and
RSS/PSS values when identities remain current. It is a sequential diagnostic snapshot;
PSS cannot replace the gate's raw summed RSS or establish simultaneous unique memory.

There is no product change in these controls. Observation overhead stays included and
precludes resource qualification. Three independent lifetimes cannot establish a leak,
statistical latency, broad browser support or full prepared-flow acceptance. If the
blank baseline already exceeds the ceiling, document that constraint and scope the
next decision instead of changing limits or browser flags to manufacture a pass.
