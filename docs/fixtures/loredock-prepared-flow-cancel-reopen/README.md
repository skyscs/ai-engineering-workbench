# Reusable cancellation and interrupted reopen

The [case functions](../../../scripts/loredock-prepared-flow/cancellation-cases.mjs)
accept an existing complete stopped catalog checkpoint and a question. Each observation
gets its own verified copy. The original checkpoint stays closed and its complete file
inventory must match before launch and after observation. One
[integrity control](../../../scripts/tests/loredock-cancellation-checkpoint.test.mjs)
changes a retained input and verifies that no process starts; an unverified interruption
descriptor is rejected before creating a reopen directory.

The [ordinary entry](../../../scripts/loredock-prepared-flow/cancel-reopen-development.mjs)
uses four established permit sources, twelve indexed files and five parsed code files.
It runs cold setup, preparation cancellation, provider cancellation, held shutdown and
then a separate production reopen. There is no retry, real provider or reserved-family
candidate read. A failed case retains its partial output and stops later dependent work.

## Functional observations

Preparation cancellation uses the existing diagnostic budget forwarder. The actual
budget is still open when the cancellation HTTP response finishes, then records
`check:CANCELLED`, one close and 6,438 work units. Merely receiving a `preparing` admission
would not establish active work. A subsequent useful Ready preparation cancels with no
open budget and no budget error. Neither preparation dispatches the runtime; the final
accounting audit has no late, unscoped or unclosed activity. This is diagnostic evidence
of work cancellation, not an uninstrumented resource-timing result.

Provider cancellation and shutdown use the declared provider hold. Each performs one
controlled prepare/run/close and retains known usage of 80 input and 20 output tokens,
with no published answer. Cancellation remains `cancelled`; exact same-request replay
does not dispatch again. Observed drain after requesting hold release is 8.812999 ms,
and cancellation through drain is 22.114947 ms. These are fault-lane observations; the
counter observation under the declared hold is not an exact private hold-entry clock.

Held shutdown completes in 19.684378 ms, closes the runtime and retains a complete
interrupted checkpoint. This case does not restart the daemon. The later reopen copies
that checkpoint and starts the actual production entry. It retains the interrupted
status, original context, complete compact context and known usage. GET, same-request
replay and a later GET have identical body hashes; the transient preparation is absent.
Independent catalog inspection finds exactly one interrupted attempt and one intact
witness, with no additional admission.

Fault provenance stays attached to the later production process even though it has no
runtime double or budget forwarding. Production entry alone does not make an inherited
fault catalog a resource-timing observation. The HTTP assessor documentation records
the same limitation for external SQL/CDP interventions and historical metadata.

## Retention and limits

The run remains **exit 1**: the base cold daemon's raw timer gap is 311.397804 ms against
the unchanged 100 ms limit. All five functional stages complete without case errors,
and the external owner leaves no survivors. Accounting and fault lanes retain
`timingQualified: false`; no subset result grants resource qualification.

[records.json](records.json) binds complete raw outputs, source Git repositories,
checkpoints, process journals, controlled requests/outputs, HTTP bodies, independent
verification copies and logs. Independent inspection checks all fifty response bodies
(forty-five exact byte sizes and five redacted sessions), four source Git identities,
unchanged raw/source trees and both unchanged input checkpoints. Seven complete copied
catalogs pass integrity and foreign-key checks, expected empty/cancelled/interrupted
row counts, exact retained context and witness/prompt/schema comparisons. Original
checkpoints are never opened with SQLite during that inspection.

The focused integrity test, production builds, script syntax and original application/
input seal pass locally. Both complete final-head CI events are required before merging.
No application code, parser, oracle, threshold or user demo checkout changes.

The preceding expiry checkpoint is accepted through
[PR #143](https://github.com/skyscs/ai-engineering-workbench/pull/143): push 42021909024 and
pull_request 42021916122 pass 981 tests at exact head
`9cb7ea07e4e1b8de8c8479e362698f2af5818425`. Merge
`9acd1f3d3cd038a6f160d8c392c5e7916271c13d` has an identical tree. Both full CI logs are
retained here; its browser memory and daemon timing failures remain failed.

This is ordinary subset integration. Full R01-R15 assembly, remaining resource
assessment and the final committed executable/environment/output seal remain pending.
The reserved family has zero candidate reads, and model eligibility remains closed.
