# Code coverage workflow verification

Task 046, 2026-11-01. Scope was committed in `39eaa20` after PR #49 reached main as
`7ee582f`. The daemon now follows new current index publications with bounded local
analysis, exposing protected controls and compact coverage/file browsing. See
[ADR 0041](../../decisions/0041-loredock-code-coverage-workflow.md).

Strict types, all 379 tests and production builds pass. Four new integration tests cover
publication/replay, manual ownership, interruption without automatic resume, queued work,
coalescing, shutdown, obsolete source/policy scope and isolated automatic-start errors.
They include an unavailable publication pointer: the observer records an error instead
of terminating the daemon. HTTP checks cover Host/Origin/session/CSRF, body/input bounds,
all lifecycle controls, invalid pages, foreign file IDs, exact original ownership and
source/policy fencing. The complete Task 045 lifecycle/migration suite still passes.

The [new browser result](browser-result.json) uses a small twenty-source shape: 179
indexed files, including 121 code candidates. New publication starts analysis automatically;
all 121 files are available through 50/50/21-file pages. Six files retain seven syntax-gap
messages. Native disclosure, selected-file focus and original evidence work with the
keyboard. A hostile source label remains escaped. The 390-pixel layout has no horizontal
overflow; default coverage is compact and technical details remain collapsed.

Held-response cases cover replacing a selected file, closing details while an original
loads, refreshing while a file page loads, and policy/revocation while a file loads.
Restart preserves inventory IDs without creating another attempt. An older held project
poll cannot overwrite a newer policy mutation refresh. UI request generations and clearing
obsolete index-start receipts preserve the newer scope.

The first browser run reached the policy case but submitted an obsolete source-index
request immediately after a test-driven external policy change; the server correctly
rejected it. The harness now waits for the restored policy in the UI. The final run also
covers an explicitly held older project poll across a newer UI policy update. No production
boundary was relaxed to make the test pass.

The [existing candidate browser regression](candidate-browser-result.json) also passes:
source suggestions, related-source pages, keyboard originals, hostile labels, Dojo support,
review/history and late question/review/source/policy fences remain intact. Browser suites
ran sequentially on owned port-4244 daemons and owned temporary sources/data. Screenshots
were inspected locally. No user data directory, account configuration, corporate source,
model request or new full-volume benchmark was used.

Reproduce after building with the documented toolchain:

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-code-browser node scripts/loredock-code-coverage-smoke.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-candidate-browser node scripts/loredock-candidate-smoke.mjs
```

Use new owned output directories and run browser checks sequentially with port 4244 free.
These are functional checks, not framework-cost or semantic acceptance. Current graph,
source-candidate and answer selection remain unchanged; bounded query access to the wider
inventory follows separately. Previous semantic failures and independent review stay open.
