# Bounded history summary observation

Task 131 follows accepted PR #163, exact head `ce61fec`, identical-tree merge
`12b1392`. Both complete CI logs were inspected before that merge: 1,034 passing
tests in each event. They are retained alongside this result.

[ADR 0060](../../decisions/0060-loredock-answer-history-summaries.md) was committed
before implementation at `b581984`. The first ordinary execution used application
and observer commit `7765ba2`, Node 22.23.2, the actual HTTP app and unchanged limits.
It never reads the consumed kiln corpus. No application bytes changed after this
observation. New prepared list rows explicitly declare metadata-only validation;
full reads and dispatch retain their exact implementation.

## First ordinary results

The same ordinary permit corpus used by the earlier history observation supplies
four Git sources and twelve files. The existing controlled runtime creates 64 useful
answers through actual preparation, review, admission, validation and publication.
There are zero real model calls. Stopped copies at 20 and 64 rows are reopened with
the production entry point; separate copies run budget diagnostics.

| Stored answers | Useful rows returned | Production list HTTP time | Aggregate work | Page budgets |
| --- | --- | --- | --- | --- |
| 20 | 20 | 29.708301 ms | 257,241 | 1, closed |
| 64 | 20 | 20.914291 ms | 257,241 | 1, closed |

The fixed limits remain 500 ms and 1,000,000 work units. Prior ordinary list work was
3,168,560 at both sizes; the new observation uses about 92% less work. These are first
observations, not statistical latency guarantees. Actual budget forwarding measures
work separately from production timing and does not qualify memory or latency.

Both production lists match their creation-time bytes. All 84 reopened full details
match their original public response bytes, and idempotent admission returns the
original answer without dispatch. Restart loses transient Ready state as expected.
The 65th admission is refused without consuming Ready or adding a runtime call.
Revoking an omitted dependency fences all 64 answers and purges all witness/context
payloads while preserving their quota tombstones.

The external owner finishes in 91,188.994 ms, with exit zero, no errors or surviving
descendants, all eight declared catalog roots observed and 46,687,801 peak sampled
storage bytes. This is a bounded ordinary control, not complete resource qualification.

## Retention and review

An independent review copies every stopped catalog before opening SQLite. All eight
copies pass integrity and foreign-key checks. It checks 3,476 issued original spans
against exact Git source bytes/revisions, all retained context/request hashes and
dependency sets, 767 complete HTTP responses, and seven redacted sessions. All 1,064
raw entries remain unchanged before and after review. The complete raw tree, input
snapshot, all copied catalogs, review helper and logs are retained by
[records.json](records.json), with per-entry SHA-256 inventories.

Local strict typecheck and full production build pass. All 22 prepared-answer tests,
22 legacy/history/source-reference tests and the complete 238 script tests pass.
New regressions cover useful twenty-row parity, one budget, payload corruption versus
metadata corruption, missing/unknown/rebound inputs, omitted dependencies, review/build
freshness, policy/revocation, and refusal before oversized context text is loaded.
The historical helper proves that full reads/admission/dispatch remain exact; no old
manifest, schema, consumed driver or qualification seal is rewritten.

## Limits and continuation

The summary validates stored metadata and source membership, not the complete witness.
Payload-only corruption can therefore leave a status visible and still fail explicitly
when opened. This is intentional and documented in the API contract and user guide.
There is no startup cache, background materialization, schema change or limit increase.

Startup still exceeds 100 ms. Near-limit heap, browser RSS and the required native path
size remain separate unresolved gates. Prepared input stays experimental and complete
qualification requires a fresh prospective family. After exact-head CI and merge,
[Task 132](../../../tasks/132-loredock-native-context-size.md) diagnoses the retained
ordinary native-size failure before choosing a representation change.
