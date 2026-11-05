# Retained HTTP assessment

The [HTTP assessor](../../../scripts/loredock-prepared-flow/http-assess.mjs) reads existing
protected-client journals and response files. It sends no request and imports no
application service. Request IDs must be sequential and unique; each response must bind
to its request. Duplicate, reordered, malformed, missing or truncated evidence cannot
become a passing result. Recorded request failures and non-success HTTP statuses remain
visible. Session payloads must retain the explicit redaction placeholder; their original
secret-bearing byte count is not reconstructed from the redacted file.

Every other response is checked against its exact retained UTF-8 byte length and hash.
The applicable frozen limits cover review bodies, scalar preparation status, saved or
admitted answers, answer lists, and GET status/list/saved-answer latency. Actual complete
oversized responses remain failed; they are not truncated into passing observations.
Inclusive thresholds retain their original values.

The file entry binds the declared lane to the retained daemon process metadata. A
resource observation also requires a normal retained daemon exit. Accounting and fault
observations never qualify resource timing. The `timingQualified` field identifies this
lane distinction; a resource-lane record may still be failed or incomplete. It does not
mean the whole resource gate passed. Process metadata, exit and journal hashes bind the
bytes inspected. The final execution seal remains responsible for authenticating the
complete executable/environment; these are trusted stopped ordinary artifact directories,
not a sandbox against hostile concurrent filesystem mutation.

Bootstrap flags alone cannot prove that no external fault occurred. A catalog copied
from an interrupted/fault case or an externally intercepted HTTP response keeps that
case's provenance even when the later daemon uses the production entry. Such an
observation must remain excluded from resource timing. This assessor authenticates the
recorded lane, not an absence of unrecorded SQL/CDP interventions; the final case manifest
and execution seal must bind that wider history. Historical process records are not
rewritten to imply stronger evidence.

## Offline observations

The [read-only runner](../../../scripts/loredock-prepared-flow/reassess-retained-http.mjs)
checks seven declared datasets without rerunning an application, parser, preparation or
model. Before/after inventories verify unchanged HTTP and process trees.

| Retained dataset | Responses | Applicable checks | Scoped result |
| --- | ---: | ---: | --- |
| Failed 240-file cold control | 30 | 0 | Incomplete; it never reached a covered review/status/history response |
| Original twelve-file cold control | 16 | 8 | HTTP subset passed |
| Three twelve-file warm lifetimes | 32 | 45 | HTTP subset passed |
| 20-row history setup client | 2 | 2 | List HTTP subset passed |
| 64-row history setup client | 2 | 2 | List HTTP subset passed |
| 20-row accounting client | 2 | 2 | Observed; resource timing excluded |
| 64-row accounting client | 2 | 2 | Observed; resource timing excluded |

The runner stays **exit 1** because the first scope is incomplete. An empty measured
scope cannot become a pass. The history clients contain one session request and one list
request each; they are not the complete Chrome CDP network traces. Both historical list
requests still cost 3,168,560 aggregate work units against 1,000,000, even though these
HTTP byte/latency checks pass. Likewise, the cold/warm daemon timer failures remain
failed. Independent limits are not interchangeable.

[records.json](records.json) retains the original HTTP/process inputs, offline report,
source scripts, control artifacts and verification logs. Independent inspection checks
all 86 responses, 79 exact unredacted bodies, 61 applicable comparisons, lane assignments
and unchanged raw input/report trees. Seven session payloads retain only their declared
redaction. There are zero new candidate or model executions.

Six [controls](../../../scripts/tests/loredock-http-assess.test.mjs) exercise UTF-8 byte
accounting, exact boundaries, complete oversized bodies, missing/error responses,
duplicate/reordered/corrupted records, excluded lanes, file metadata binding, truncated
journals, missing response files and redacted sessions. The complete local check passes
979 tests, strict typechecks and production builds, with the original application/input
seal unchanged. Earlier focused checks remain recorded.

The preceding cold/warm checkpoint is accepted through
[PR #141](https://github.com/skyscs/ai-engineering-workbench/pull/141): push 42015747164 and
pull_request 42015756110 pass 973 tests at exact head
`a7a64277d85073bf8b34821cfc4555171ac41cf8`. Merge
`141416deb098c79c2d2fa9d087c2077e307b0a8d` has an identical tree. Both full CI logs are
retained here. Its scaling and timer failures remain failed.

This assessor covers the listed HTTP limits only. It does not assess browser traces,
aggregate operation work, whole preparation/worker latency, complete storage, source
correctness or all R01-R15 outcomes. Functional/source checks and every other resource
prerequisite are still required. All reports retain `resourceQualification: false` and
`modelEligibility: false`; the reserved family remains unobserved by a candidate.
