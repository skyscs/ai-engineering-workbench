# Literal HTTP header comparison evidence

Task 031 adds a model-free review clue to the existing map. It preserves the Task 030
prospective semantic failure and all frozen evaluations. This is adapter/UI acceptance,
not a new answer-quality result or full-system readiness assessment.

## Independent example and negative cases

Before implementation, `apps/loredock/tests/header-bindings.test.ts` introduced a
`submitReceipt` client with `X-Receipt-Key` and a `Ledger.accept.key` route binding to
`X-Receipt`. The old adapter failed the assertion requiring a header comparison;
the new adapter exposes a candidate gap with both original source references.
No fixture oracle or expected-answer data enters production analysis.

Tests also cover case-insensitive matches, punctuation differences, empty declarations,
unsupported/dynamic objects, computed/spread/getter inputs, case collisions, prototype
setters, malformed/Unicode/long names, exact handler ownership, count and serialization
bounds. Existing projection tests exercise graph/output budgets and original evidence
integrity. Historical v1 adapter corrections remain readable across restart and cannot
be reapplied; v2 unchanged-support reapplication still passes the existing tests.

## Browser acceptance

`scripts/loredock-header-smoke.mjs` uses twenty owned synthetic repositories, adding two
independent source files only to generated checkouts. It verifies all three states and
an HTTP candidate outside the two chosen outlines, caller/route citation focus by
keyboard, correction save/reload, escaped route labels, 390-pixel layout, source
revocation, a held late response and a policy change. It rejects any runtime preparation
or answer attempt. Source checkouts remain clean and are removed at teardown.
The retained `browser-result.json` records the result; local screenshots support layout
inspection. `regression-browser-result.json` records the broader existing pilot UI run.

Reproduce after `pnpm check`, using Node 22.13+ and local Chrome. The scripts use port
4244 and must run sequentially while no other LoreDock instance occupies that port:

```sh
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-headers-browser node scripts/loredock-header-smoke.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-regression-browser node scripts/loredock-smoke.mjs
```

## Limits

The comparison covers literal fetch/Dojo headers and the pilot same-document JSON binding
format. It does not read general Spring/framework annotations, resolve `Headers` objects,
execute wrappers or prove actual values, live connectivity or identity enforcement.
Unknown and omitted work stays visible. No new prompt evidence or model run is included;
the original 23/24 prospective agent score and failed gate remain unchanged.
See [ADR 0034](../../decisions/0034-loredock-http-header-bindings.md) and the
[user guide](../../loredock/USER_GUIDE.md#follow-a-static-flow-outline).
