# First-use documentation review

Task 166 simplifies the first useful path after the production-owner functional checks.
The README previously placed a long feature/evaluation history before shared installation.
The guide explained artifact storage and CLI configuration hundreds of lines after startup.

The README now offers the synthetic example or local repositories, with commands, the
loopback address and links to detailed usage. The guide starts with expected outcomes,
registration versus indexing, the separate code-analysis phase and data-directory choice.
The existing Workbench sections and guide's detailed chapters/anchors remain available.
Historical evaluation/resource results stay in their original technical records and are
linked through development status and the roadmap. No failed result changes classification.

## Source-backed checks

| Claim | Inspected source |
| --- | --- |
| Package commands and toolchain | package.json, .node-version, .nvmrc |
| Default model-free mode, data directory and experimental guard | apps/loredock/src/index.ts |
| Loopback port and startup ownership | apps/loredock/src/server.ts |
| Registration actions | apps/loredock-web/src/SourceOnboarding.tsx |
| Index sources / Update knowledge and source list | apps/loredock-web/src/main.tsx |
| Project overview and Guide me | apps/loredock-web/src/ProjectOverview.tsx |
| New-publication automatic code analysis | apps/loredock/src/code-analysis-follow.ts |
| Synthetic demo preparation, output and reopening command | scripts/loredock-demo.mjs |
| Existing demo environment/shell regression coverage | scripts/tests/loredock-demo.test.mjs |

These are source checks, not a newly observed browser/demo run or user acceptance.
All application, script, dependency and test implementation bytes are unchanged.
The [review evidence](../fixtures/loredock-first-use/README.md) retains source identities,
document comparisons and both accepted Task 165 CI logs. A local full suite is not
repeated solely for prose; both complete exact-head CI logs remain required before merge.

## Concrete follow-up

The demo currently overrides LOREDOCK_ANSWERS and LOREDOCK_DEVELOPMENT, but preserves an
inherited LOREDOCK_PREPARED_ANSWERS=1. The printed reopening command also leaves that flag
inherited. Production correctly rejects prepared answers without cited answers. Existing
helper tests do not include the prepared flag. The expected startup conflict follows from
these sources; no demo failure was executed or claimed during this review.

The guide supplies a command-scoped workaround for that exact error. [Task 167](../../tasks/167-loredock-demo-mode-isolation.md)
separately scopes the two helper corrections, regression tests and the required historical
inverse delta. The production guard and frozen original source hash must stay intact.

No UI redesign, model call, corporate source access, browser/demo/resource run or native
executor change. Partial source coverage, experimental prepared answers and all remaining
semantic, resource, L5 and Workbench bridge gates remain explicit.
