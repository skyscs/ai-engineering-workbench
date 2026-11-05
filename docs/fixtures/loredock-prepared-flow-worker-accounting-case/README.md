# Complete-worker accounting against an existing warm reference

The [case function](../../../scripts/loredock-prepared-flow/worker-accounting-case.mjs)
accepts a verified empty cold catalog and the first recorded warm repetition. It owns
one copied catalog and one diagnostic process. The
[warm helper](../../../scripts/loredock-prepared-flow/cold-warm-cases.mjs) now binds stopped
context/witness hashes, byte length and reviewed hash to each completed repetition.
Inspection happens after normal timing and never opens the sealed input checkpoint.
R15 can therefore compare against the already recorded R03 result without generating
another resource reference.

The diagnostic lifetime matches the warm lifetime: Find, Ready/review, actual prepared
admission, terminal publication, saved-answer GET and one-row list. Actual OperationBudget
methods are forwarded in the existing separate accounting lane. Every accepted charge
is summed across every observed budget. The case checks each original work ceiling and
the aggregate six-million-unit ceiling; diagnostic timing/memory never qualify resources.
It requires closed budgets and a clean audit, including no late or unscoped work.

The first warm connection is reused exactly as recorded by the controlled runtime.
No configuration or authentication content is read, copied or executed. The only allowed
comparison differences are preparation `id`/`requestId`, answer `id`/`createdAt`/
`dispatchedAt`, and the corresponding list answer identity/times. Review content, runtime
identity, paths, request prompt/schema/model/effort and stored witness/context bytes must
match. The list's published ID is separately checked against its one actual answer.

## Ordinary execution

The [ordinary entry](../../../scripts/loredock-prepared-flow/worker-accounting-case-development.mjs)
uses four synthetic permit sources with twelve files and five code files. Its fixed order
is cold setup, three warm flows, then one diagnostic replay of the first. All functional
checks pass, with three controlled runs in the resource process and one in diagnostics;
there are zero actual model calls.

Ten actual budgets total **2,570,082 accepted and requested work units**. The largest
individual budget is 441,779 against 1,000,000. Each closes exactly once without an error.
The final audit reports ten observed budgets, no active scope and no late, unscoped or
unclosed work. Exact raw provider requests and complete 66,336-byte stored witnesses match
between the first resource result and diagnostics. The earlier eight-budget control
remains historical evidence; this lifetime also includes the separate saved-answer GET
and one-row list, costing another 316,856 units.

Both normal daemon lifetimes still fail the frozen 100 ms raw timer-gap limit:
331.476347 ms cold and 286.206904 ms warm. Their other daemon metrics pass. The driver
correctly exits 1; the external owner records `driver-failure` with no cleanup errors or
survivors. No repeat selects a better result. The diagnostic pass does not cancel these
failures or the existing twenty-row aggregate list failure.

## Retention and validation

[records.json](records.json) binds complete raw output, sources, catalogs, independent
inspection copies, focused controls and logs. Four copied catalogs pass integrity and
foreign-key checks: two empty cold catalogs, one with three successful warm attempts,
and one with the single diagnostic attempt. Independent inspection verifies four clean
Git source identities, all 60 HTTP responses (57 exact byte sizes and three redacted
sessions), literal stored context/witness equality and unchanged raw/input trees.

The first offline retention script incorrectly expected owner reason `completed` despite
the recorded resource failure. It stopped before copying catalogs. Its source, traceback
and empty output are retained. Correcting that expectation to `driver-failure` makes the
independent offline inspection pass; no source preparation, generation or resource sample
was repeated.

Frozen-lockfile installation, production builds, four focused tests and the original
application/input seal pass locally. One new test rejects fault/history/unclassified
checkpoints, later warm references and changed input before any diagnostic launch.
Both complete final-head CI events remain required before merge. No application, parser,
schema, frozen input/oracle/threshold, reserved-family candidate or user demo is changed.
Full ordered integration, remaining resource assessment and the final executable/
environment/output seal are pending. Resource qualification and model eligibility remain
false.

The preceding catalog-fault checkpoint is accepted through
[PR #149](https://github.com/skyscs/ai-engineering-workbench/pull/149): push 42039637778 and
pull_request 42040517301 pass 983 tests at exact head
`49ac8f230fccbe7466e1ac1219f3b3cc347e678d`. Merge
`db959660be645881c6204a19abb8de6419b67f48` has the identical tree. Both complete CI logs
are retained here.
