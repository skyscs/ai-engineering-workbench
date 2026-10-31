# Incident-context baseline evidence

Task 035 follows merged PR #38 (`53f3f68`). The owner selected continued synthetic-only
development. No corporate source or new model call is used. Ten incident descriptions,
critical repositories, useful candidate bounds and evidence/decision expectations were
frozen in `32b0926` before retrieval measurement. The existing twenty-source corpus and
all earlier questions, routing cases and model answers remain unchanged.

[Frozen cases and method](../../../fixtures/loredock-routing/README.md) ·
[Full measurement](retrieval-result.json)

## Outcome

| Measure | Plain keyword OR | Production answer context v7 |
| --- | ---: | ---: |
| Critical repository occurrences recovered | 22/22 | 22/22 |
| Cases with every critical repository | 10/10 | 10/10 |
| Complete recorded original reference sets | 9/10 | 10/10 |
| Candidate repository range | 13–17 | 11–17 |
| Mean candidate repository count | 14.7 | 14.7 |
| Cases within frozen useful candidate bound | 0/10 | 0/10 |
| Explicit routing/abstention decisions | Not implemented | Not implemented |

Candidates here are **owners of retrieved original passages**, not a product routing
decision. The frozen useful bounds range from two to six. Both methods recover critical
repositories but include too many sources to constitute useful automatic selection.
Neither method's generic context gaps are scored as the four expected missing-evidence
decisions. Routing and L5 acceptance remain false/pending; no root cause or repository
modification target is evaluated.

The keyword baseline misses the recorded `OrderConsumer.java` reference in ir02, while
production answer context includes it. This is a reference-recall observation, not a
claim that the keyword input is semantically unanswerable. Its other originals may
support part of the answer and would require a separate semantic review.

Two fresh generations preserve every selected original locator for both methods and
all summary metrics. The audit verifies 583 returned span occurrences against 77
original Git files, including owner, revision, blob, range, file and span hashes. No
answer attempt exists; normal synthetic checkouts are unchanged and owned fixtures
are removed. Expected repository names and gap judgments never enter retrieval inputs.

One local measurement on the 79-file synthetic corpus records 1.44 seconds for indexing,
38 ms total keyword queries and 223 ms total production context queries across ten
incidents. Context timing includes its bounded derived comparison work; provenance
audit/Git reads are outside query timing. These are diagnostic timings, not comparative
production latency targets. Maximum input is 30 spans: 8,574 keyword bytes and 8,721
answer-context bytes, within the unchanged 64 KiB limit.

One retained generation uses 16,869 raw bytes, 16,790 span-text bytes and a 483,328-byte
checkpointed catalog database, including metadata/indexes. This does not measure
full managed Git storage, all retention versions or realistic large repositories.

## Verification and limitations

The initial harness called a nonexistent `Catalog.build` method and stopped before
retrieval measurements. Corrected it to the existing authorized `readBuild` method;
no frozen input or product behavior changed. The failed instrumentation run made no
model call and yielded no benchmark score.

Full check: 342 tests, strict typechecks and builds. The integration test verifies
the exact question-only calls, source ownership, regeneration stability, caps and the
distinction between reference recall and absent routing decisions. There is no UI or
runtime change, so existing browser evidence remains applicable.

These are new incident wordings on previously observed source material, authored and
reviewed by the same agent. This is not independent, blind or private-project acceptance.
Task 034's answer gate remains failed, and its fixed real-model budget remains exhausted.

## Next bounded change

Add a separate, model-free candidate-selection preview with original supporting
passages, bounded scope and explicit uncertainty. Freeze its general ranking rules
and fresh adversarial examples before evaluation; retain this broad-context baseline
unchanged. Do not tune case-specific repository allowlists, use reviewer expectations
as input, enlarge the answer context or label a lexical score as causal confidence.

Keep the complete answer context separate from the proposed investigation scope.
Provide an explicit way to inspect omitted candidates and preserve source/policy/revision
fences. A weak match or missing implementation must remain unresolved; neither candidate
selection nor a graph edge authorizes code edits or automatic Workbench investigation.
Independent quality review and an eligible private pilot still precede the bridge.
