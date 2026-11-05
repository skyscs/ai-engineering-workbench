# Exact expected HTTP outcomes for history controls

The [HTTP assessor](../../../scripts/loredock-prepared-flow/http-assess.mjs) now accepts
explicit expected negative outcomes for the two normal history boundaries: admission
at full witness capacity (`ANSWER_WITNESS_LIMIT`) and retrieval of a transient preparation
after restart (`QUESTION_NOT_FOUND`). Each declaration binds one retained request ID,
exact method and route, HTTP 409 and exact error code. No wildcard route, broad status
allowlist, duplicate declaration or unsupported error is accepted.

An expected response still undergoes all applicable byte and latency checks. A wrong
method, route, status or error remains a mismatch; an absent declared response remains
incomplete; another request with the same error is not covered. Recorded client failures
also remain failures. The assessor retains the declarations and matched IDs in its output.
Caller declarations must come from the fixed case's intended operation, not from a scan
that retrospectively excuses every observed error.

The [protected client](../../../scripts/loredock-prepared-flow/io.mjs) exposes its existing
journal request ID in response metadata, without changing application payloads or hashes.
The [history reopen case](../../../scripts/loredock-prepared-flow/history-cases.mjs)
retains its missing-preparation response and asserts the expected 409. A capacity case's
existing retained refusal now carries its request ID as well.

## Actual ordinary controls

The [fixed entry](../../../scripts/loredock-prepared-flow/http-outcomes-development.mjs)
runs two actual production reopens from the existing 20/64-row checkpoints, then assesses
the earlier quota observation offline. No answer is newly admitted and no model, controlled
runtime or reserved-family candidate is invoked.

| Case | Declared request | Expected result | Assessment |
| --- | --- | --- | --- |
| Restart with 20 rows | `00003`, exact old preparation route | 409 `QUESTION_NOT_FOUND` | Passed HTTP subset |
| Restart with 64 rows | `00003`, exact old preparation route | 409 `QUESTION_NOT_FOUND` | Passed HTTP subset |
| Earlier capacity continuation | `00404`, POST `/prepared-answers` | 409 `ANSWER_WITNESS_LIMIT` | Passed HTTP subset |

The quota reference is fixed before assessment and binds the original
`owned-history-over-capacity` request and retained refusal hash. It is not regenerated.
Both new daemon exits are normal; all 84 saved answers and original-request replays remain
byte-identical. The external owner exits 0 with no errors or surviving descendants.

Independent retention inspection verifies two complete copied catalogs, integrity and
foreign keys, all 84 answer identities, 574 reused input files and 498 HTTP responses:
495 exact retained bodies plus three redacted sessions. Exactly two missing-transient
responses and one quota refusal are present. No source checkpoint or earlier HTTP/process
input changes. Final matrix integration must bind these declarations to its own exact
requests; these ordinary IDs do not become reusable allowances.

## Verification and limitations

[records.json](records.json) retains the raw run, complete catalog copies, reused inputs,
first and corrected test sources, focused control directories, helper sources and logs.
The first new test incorrectly expected `failed` for an unsupported HTTP method with no
covered limit; the assessor correctly retained both a mismatch and `incomplete`. Only
that test expectation changed. All nine HTTP controls then pass, along with five browser
evidence controls. The application run was not repeated after this test correction.

Installation and production builds pass. A first seal command used a nonexistent script
path and failed before verification; its error is retained. Running the existing fixture
seal at its actual path then passes without writing a new seal. Both full final-head CI
events remain required before merge.

This change does not alter application behavior, expected error payloads, frozen limits,
parser/schema/defaults or the user demo. It grants no whole-flow resource or model
eligibility. Earlier timer, browser, list-work and required-native-path failures remain
failed. Remaining operation/lifetime coverage, complete R01-R15 integration and the final
executable/environment/output seal are still pending.

The preceding content checkpoint is accepted through
[PR #154](https://github.com/skyscs/ai-engineering-workbench/pull/154): push 42055463301
and pull_request 42055504104 pass 1,001 tests at exact head
`4ac2068be9ce3c3b6902360ee2e53f3c28cddaf8`. Merge
`2db2707abeb074be3caa94732a88a1569e2a6ba6` has the identical tree. Both CI logs are retained here.
