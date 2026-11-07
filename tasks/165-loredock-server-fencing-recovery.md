# Task 165 — Verify source fencing and recovery through the production server

Status: planned after Task 164 exact-head CI acceptance. Independent functional
integration work under ADR 0070; no resource or native executor attempt.

1. Retain Task 164's checks, incomplete/failed logs, source identities and both full
   exact-head CI logs. Preserve every consumed first result, frozen launcher,
   compatibility manifest, API and resource contract.
2. Reuse the accepted internal runtime dependency and actual LoreDockServer lifecycle.
   Exercise protected HTTP endpoints on fresh synthetic data. Do not add another
   service bootstrap, product runtime selector or general command protocol.
3. Verify a prepared answer waiting on its runtime cannot publish after source
   revocation or policy exclusion. Check earlier derived content becomes unavailable,
   pending work is aborted and the prepared runtime closes once.
4. Stop the actual owner, await cleanup, reopen its owned catalog through a new owner
   and inspect saved success/interruption through HTTP. Startup must not call the
   runtime or retry automatically. An explicit retry gets a distinct ID and preserves
   earlier input/history. Never reuse a qualification catalog or edit SQL statuses
   to manufacture recovery.
5. Prefer the existing controlled runtime and small shared HTTP test helpers. Keep
   explicit test limits and cleanup. If a defect is found, record it and make only
   the required product repair with regression coverage; review any historical or
   emitted delta explicitly.
6. Run focused and full checks with bounded local parallelism, document actual
   results and limits, review the full diff and both complete exact-head CI logs
   before merge.

No model, browser, corporate repository, delegated service, namespace probe or
shared-namespace implementation. Passing lifecycle checks supplies no answer-quality,
resource, L5 or Workbench bridge acceptance. Native executor expansion remains paused.
