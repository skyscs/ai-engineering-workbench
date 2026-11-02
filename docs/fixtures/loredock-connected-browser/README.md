# Connected-path browser verification

Task 069, 2026-11-02. The final functional run at `c6b796f` passes **15 checks**
with **28 path reads** on three fresh owned synthetic repositories. No model/answer
request, corporate source, user-demo rebuild or port-4244 listener was used.
[Result](result.json), [desktop](paths-desktop.png), [390px screen](paths-mobile.png).

The fixture adds nine supported roots, including an isolated root and a root whose
complete card support cannot fit. The compiled application runs in process behind an
owned non-forwarding loopback proxy. A fresh Chrome profile must visit a unique sentinel
before navigating the app. Node 22.23.2 and Chrome versions are recorded in the result.
Source revisions remain unchanged after explicit fixture construction. This is a fresh
functional check, not a rerun of any frozen scale/semantic matrix.

The checks cover keyboard opening/focus, default collapse, missing facts without implicit
analysis, two paths/four roots, complete originals, root pages and default restoration,
isolated/unavailable entries, desktop/narrow layouts, paused-to-published inventory,
real busy/retry, eviction, historical indexes, empty supported code and source/policy
changes. Delayed root/page/inventory/original responses use fully buffered Response
objects delivered even after cancellation. No stale response may restore discarded UI.

## First failures and corrections

- The first targeted strict check preceded workspace package builds and also exposed
  an optional `signal: undefined` incompatibility with exact optional property types.
  The initial full check retained [that failure](failures/initial-typecheck.txt).
  Omit absent signals and run the normal repository pipeline; it passes 483 tests.
- The [first browser attempt](failures/browser-first.json) did not activate the summary
  with the harness's Enter event. The harness now foregrounds Chrome, asserts focused
  summary and dispatches Space down/up. No product keyboard override was added.
- The [second attempt](failures/browser-second.json) found a missing historical label:
  analysis staleness only compares the registry. The browser now uses map staleness,
  which also compares the latest published index.
- The [third attempt](failures/browser-third.json) removed the sole source of supported
  roots before trying to open a root original for the policy test. Revoke the API source
  instead, retaining the client roots for that independent policy check. During harness
  review, buffer response bodies before withholding them to verify fencing independently
  of fetch cancellation. All fifteen final checks pass with this stronger delivery.

`pnpm check` passes strict checks, 483 tests and all builds. After the historical-label
fix, a targeted web build/typecheck passes. Screenshots were visually inspected. Browser
checks are opt-in because they require Linux Chrome:

```sh
pnpm build
LOREDOCK_SMOKE_OUTPUT=/absolute/owned/result-directory node scripts/loredock-connected-browser-smoke.mjs
```

The run is not independent semantic validation or a private pilot. Current graph/answer/
candidate/review consumers retain their original adapters and saved provenance. Runtime
coherence and unsupported syntax stay unknown; old failed gates/budgets stay unchanged.
