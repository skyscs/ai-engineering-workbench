# Bulk source onboarding verification

Task 025, Linux, Node 22.23.2. Generated from the independent twenty-source synthetic
corpus using production registration/index/overview code and a headless Chrome browser.
No real model calls, private sources or source application execution.

- [Browser result](browser-result.json): pasted list, duplicate/invalid/existing paths,
  preview before mutation, one confirmation, delayed response fencing, twenty contexts,
  last-source original citation, Guide me, refresh, daemon restart and revocation.
- [Mobile preview](bulk-preview-mobile.png), [mobile overview](overview-mobile.png),
  [desktop overview](overview-desktop.png). Mobile width 390px; no horizontal overflow.
- [Existing source workflow](source-regression.json) and [opt-in answer workflow](answer-regression.json)
  regressions pass. The answer scenario uses four fake-runtime calls and zero real models.
- [Capacity measurements](../../../fixtures/loredock-scale/onboarding-result.json):
  79 indexed files / 60 excluded canaries, twenty README contexts, 79 reused files on
  unchanged refresh, two retained generations, separate commands/blob reads/timings.

Reproduce after `pnpm build` with port 4244 free:

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-bulk-browser node scripts/loredock-bulk-smoke.mjs
node scripts/loredock-scale-readiness.mjs
```

Owned temporary fixture repositories, database and browser profile are removed on exit.
Separate automated load cases exercise first-source path/byte imbalance, long/oversized
READMEs and persisted allocations across pause/restart/resume. These browser/capacity
checks do not evaluate question quality, production throughput or L5 readiness.
