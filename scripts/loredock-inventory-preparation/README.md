# Inventory replacement preparation audit

Task 092 uses the unchanged bounded `MemoryObserver` on an independent tiny fixture
with eight additional fact-free markers per source. No frozen resource family is
imported. Preparation/indexing/initial analysis are outside the observation. The
reference capture uses the existing prepared-read services, then two replacements
are divided into synchronous `start` and asynchronous worker phases. Observation
begins before the pending worker microtask can run. Verification reads occur outside
these phases. Evicted history checks exact original projection/support/dependencies
and absence of nested path/fact/snapshot work.

Run from a clean committed worktree with the pinned installed/built workspace:

```sh
LOREDOCK_INVENTORY_AUDIT_OUTPUT=/absolute/new-owned-output timeout --signal=TERM --kill-after=5s 60s pnpm --filter @loredock/daemon exec tsx ../../scripts/loredock-inventory-preparation/audit.mjs
```

The command above resolves relative to the filtered package; use the absolute
script path when invoking it outside that convention. Keep first stdout/stderr and
exit, the bounded report, owned sources/data and the original reference receipt.
The observer records SQL templates/counts, never parameters or returned rows.
Its memory/timing endpoints are intrusive diagnostics, not resource acceptance.
The audit changes no production or previously measured module and selects no
optimization until the first source/count readback is reviewed.

The [retained first outcomes](../../docs/fixtures/loredock-inventory-preparation/README.md)
include the source-count preflight error and the corrected complete audit. The
[reviewed decision](../../docs/loredock/INVENTORY_PREPARATION_AUDIT.md) selects a
separate worker-scoped prepared-read candidate; this audit implements no optimization.
