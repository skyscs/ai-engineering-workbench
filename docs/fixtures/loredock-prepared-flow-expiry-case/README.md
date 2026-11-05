# Reusable real-expiry case

The [expiry case](../../../scripts/loredock-prepared-flow/expiry-case.mjs) accepts already
materialized source roots and a question for later ordered-suite integration. It starts
the actual production entry, indexes those roots and uses the real compiled browser UI.
The [ordinary entry](../../../scripts/loredock-prepared-flow/expiry-development.mjs)
retains its established four-source permit fixture and owns only input creation and the
top-level report. No clock change, shortened TTL, refreshed preparation or model runs.

The browser performs one Find context action and keeps polling through the actual
ten-minute lifetime. A passive MutationObserver records removal of the context and the
expiry notice. The final case scrolls to the question panel before Find, requires Ready
to intersect the viewport, and requires the entire expiry notice to be visible without
another scroll. The [Ready viewport](ready.png) and [expired viewport](expired.png) are
unchanged screenshots from the final run. Zero admission requests, zero stored attempts
and zero witnesses confirm that the configured UI connection never generates an answer.

## Timing proof and retained controls

The [bounds assessor](../../../scripts/loredock-prepared-flow/expiry-bounds.mjs) brackets
publication using external monotonic observations. Actual expiry cannot precede Find
start plus ten minutes. Requiring observed clearing by that earliest possible expiry
plus two seconds therefore proves the two-poll upper bound. Using Ready observation
plus two seconds instead could hide preparation/rendering delay. Two controls reject
that false-pass example, early clearing, invalid values and reordered observations.

This is a conservative proof, not an exact reading of the server's private expiry clock.
A long preparation can make this external bound inconclusive even when the UI behaves
correctly; such an outcome cannot qualify. The test never moves a clock or wraps an
application method to obtain a more favorable result.

Two real runs remain separate:

| Observation | First extracted case | Visible case |
| --- | ---: | ---: |
| Find start to observed clearing | 600407.648405 ms | 600509.252954 ms |
| Ready observation to clearing | 600116.138499 ms | 600234.984989 ms |
| Scalar browser polls | 601 | 601 |
| Preparation / admission requests | 1 / 0 | 1 / 0 |
| Completed browser API response bodies | 3015 | 3015 |
| Browser sampled RSS including collector | 1368072192 bytes | 1378480128 bytes |
| Incomplete browser samples | 0 | 1 |
| Maximum raw daemon timer gap | 322.928161 ms | 315.774108 ms |

Both real DOM-expiry controls complete with no errors or owned survivors. The first
screenshots show the top of the page, so they do not prove viewport visibility. That
input revision and its original output remain retained. Its unchanged raw times also
pass the stronger bounds assessor in a separate offline read with zero new candidate
execution. The second run includes visibility and the conservative bound directly.
Both actual runs finish before their subsequent local verification work begins.

The functional result is not a resource pass: both browser RSS observations exceed the
unchanged 1 GiB limit, both daemon timer gaps exceed 100 ms, and the second browser tree
retains one explicitly incomplete sample. No failure or missing sample is discarded.

## Retention and status

[records.json](records.json) binds both complete runs, original/final source scripts,
screenshots, all completed API responses, raw process/memory output and verification
logs. Temporary owned Chrome profiles remain local and are explicitly excluded from
portable archives. Independent inspection verifies unchanged raw trees and source bytes,
600 Ready polling bodies followed by one expired body in each run, and all 6030 completed
browser API bodies. Two complete copied catalogs pass integrity and foreign-key checks,
with five parsed code files and no answer or witness rows.

The two focused bounds tests, script syntax, production builds and the original
application/input seal pass locally. The application, parser, frozen oracle and limits
are unchanged. Both complete final-head CI events are required before merging; the
full application suite is not redundantly repeated locally during a real timer run.

The preceding HTTP checkpoint is accepted through
[PR #142](https://github.com/skyscs/ai-engineering-workbench/pull/142): push 42017449096 and
pull_request 42017474717 pass 979 tests at exact head
`0c3223208f5f90d28afc42b0535f1cfb3389adaf`. Merge
`f4389040308b5582539d587148d756a1c53123b0` has an identical tree. Both full CI logs are
retained here. Its subset passes do not resolve the recorded whole-flow failures.

This is an ordinary reusable case, not complete R01-R15 integration, resource
qualification or the final executable/environment/output seal. The reserved family has
zero candidate reads, and no model or user-demo mutation occurs.
