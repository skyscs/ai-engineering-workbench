# Task 035 — Incident-context qualification baseline

Status: implemented and locally verified. Follows Task 034 / merged PR #38 (`53f3f68`).

## Scope and acceptance

1. Keep the owner's selected synthetic-only scope. Freeze ten new incident wordings,
   critical repositories, useful candidate bounds, original evidence and missing-input
   decisions before measuring retrieval. Reuse the immutable twenty-source corpus;
   preserve the original three-source routing cases and every answer evaluation.
2. Cover shared contracts and additional consumers, database/infrastructure changes,
   misleading names, renamed external boundaries, missing implementations, cross-repository
   HTTP, separate database scopes, missing recovery and production overrides.
3. Compare unchanged production answer-context retrieval with a plain keyword OR
   baseline using the same question tokenizer and source/span/byte bounds. Neither
   path receives expected repository names, reference IDs or gap judgments as input.
4. Measure critical repository recall, candidate count, full reference availability,
   explicit decision availability, latency and retained bytes separately. Owners of
   retrieved passages are diagnostic candidates, not modification targets. Do not
   equate returning all sources with useful routing or inject expected abstentions.
5. Verify every returned original against pinned Git ownership/bytes/ranges and repeat
   on fresh source identities. Keep absent product routing decisions explicitly
   not implemented. Add focused fixture/evaluator tests and preserve the measured
   failures instead of tuning product behavior in this phase.
6. Run full checks, review and merge after both exact-head CI runs pass. Continue to
   the next bounded context-selection phase without another command. No real model
   calls, corporate source access, automatic investigation or Workbench bridge.

These are new scenarios on previously inspected synthetic sources, authored by the
development agent. They are not blind, independently accepted or representative of
large private repositories. Task 034's failed answer gate remains failed.

## Outcome

- Frozen in `32b0926` before measurement: ten scenarios, 22 required repository
  occurrences, four explicit missing-evidence cases, useful candidate bounds of 2–6.
- Both methods recover 22/22 critical repository occurrences; production context
  supplies 10/10 complete recorded reference sets versus keyword search's 9/10.
- Owner unions contain 11–17 production-context repositories and 13–17 keyword
  repositories; both average 14.7 and meet the useful bound in 0/10 cases.
- Neither path implements a routing/abstention decision. No semantic/routing pass is
  claimed. All selections and summary metrics are stable on two fresh generations.
- Verified 583 span occurrences against 77 original files. No model/answer attempt,
  product tuning, UI change or checkout mutation. Full check: 342 tests and builds.
- Next: separately bounded source-candidate selection with original support and
  uncertainty, frozen general rules and fresh adversarial examples. Keep all answer
  failures and this baseline unchanged. See [evidence](../docs/fixtures/loredock-incident-context/README.md).
