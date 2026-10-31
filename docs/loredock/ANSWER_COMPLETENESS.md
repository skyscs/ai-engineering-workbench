# Question-aligned completeness investigation

Date: 2026-10-31. Task 028 follows merged PR #31 (`7258f5d`). This is a source/input
diagnosis and prospective evaluation contract. No new model answers are generated,
no historical scores are revised, and Task 027's expanded semantic gate remains failed.

## What completeness should measure

A useful answer addresses the question's requested facts and the qualifications needed
to interpret its claims. Additional system context can help without becoming mandatory
for every short lookup. Unsupported claims, invented conflicts, global absence from
partial coverage, and human assertions promoted to facts remain failures regardless
of answer length. Conditional words do not supply missing implementation prerequisites.

Record four separate judgments: requested propositions, necessary qualifications,
optional background and forbidden/unsupported assertions. Evaluate qualifiers by meaning:
“the local configuration declares” can already restrict a claim without an extra unknown
question. If an answer volunteers a runtime or security conclusion, its support obligations
grow with that conclusion. Do not judge completeness by word count, citation count or
whether particular caveat words occur.

The new [prospective rubric](../../fixtures/loredock-completeness/RUBRIC.md) makes broader
integration questions explicit. It does not introduce an application mode selector or
require users to choose repository names. It is an evaluator artifact, not prompt input.

## Review of all original questions

This alignment review diagnoses the old rubric; the frozen Task 027 scores remain as
recorded. It does not retrospectively declare omitted requirements optional or certify
the previous answers under a replacement gate.

| Question | Direct obligation | Scope/uncertainty needed | Alignment observation |
| --- | --- | --- | --- |
| s01: system areas | Give a sourced overview of the documented areas. | Partial source scope, external internals and deployment remain unknown. | Broad wording supports broader context; avoid an exhaustive system inventory claim. |
| s02: one inventory application | Distinguish the two documented logical applications and routes. | Repository identity does not establish deployment boundaries. | Closely aligned. |
| s03: checkout forwarding | Identify the literal destination and request behavior. | Keep the route static; identity-flow claims require enforcement uncertainty. | A bare target lookup need not tour retry behavior, but volunteered identity/transport claims still need their limits. |
| s04: stock-topic source | Identify a source and its scoped declared value. | Preserve local/declarative scope; do not assert a production topic or live subscription. | The old rubric additionally demands a message contract and explicit live-subscription caveat. Separate this wider explanation into an explicit context question prospectively. |
| s05: former component name | Explain the documented source rename. | Do not infer deployed instances. | Closely aligned when the rename is explicitly source-scoped. |
| s06: carrier delivery guarantee | Describe visible outbound behavior and whether a guarantee is established. | Carrier internals/guarantees are unavailable. | The requested runtime guarantee makes the missing evidence central. |
| s07: shipment projection location | Locate the repository and declared target. | A local declaration is not a verified live database. | Handler and concrete storage implementation are wider context unless execution is asserted or requested. |
| s08: payment settlement retries | State the port and documented missing implementation. | Limit absence to supplied sources; provider behavior stays unknown. | Closely aligned. |
| s09: only documented consumer | Recognize the additional consumer. | Documented/local consumers do not enumerate deployed subscriptions. | Closely aligned; no exhaustive runtime inventory. |
| s10: same database | Distinguish declared database scopes. | Names do not prove physical topology or replication. | Appropriate limits on interpreting the identity comparison. |
| s11: contract-library publisher | Distinguish message definition from runtime publication. | Schema ownership does not prove a running producer. | Closely aligned. |
| s12: tenant membership | Distinguish identifier carriage from enforcement. | Do not infer global absence of controls. | Required security qualification, not optional background. |
| s13: component API call | Describe the supplied component's visible behavior. | Keep the negative claim scoped to that component/source. | No need to enumerate other UI integrations to answer a component-scoped question. |
| s14: reservation location | Locate the relative request and candidate local route. | Host and live deployment wiring are unresolved. | Dynamic plugin wiring is additional context; the sources do not establish that the loader is on the reservation path. Do not invent that dependency to justify a caveat. |
| s15: loaded plugin | Describe runtime-computed selection. | Concrete plugin target/build/runtime mapping is unavailable. | Plugin uncertainty is directly requested here. |
| s16: production topic | Explain the placeholder and unknown actual value. | Never substitute local config or invent a local/unknown-production conflict. | Closely aligned. |
| s17: index applied | Distinguish migration declaration from execution. | Live database/index status remains unverified. | Closely aligned. |
| s18: analytics rationale | Report documented intent. | Do not promote rationale into measured effectiveness. | Source-attributed rationale can convey the qualification without an unrelated benchmark inventory. |
| s19: cursor recovery | Explain the visible cursor flow and missing persistence/recovery. | No restart guarantee; absence is source-scoped. | Recovery is central. Scheduling/client implementation is wider execution context; ask for it explicitly in the prospective context pair. |
| s20: historical topic | Preserve the historical/local disagreement. | Do not infer a deployed production value. | Closely aligned. |

This is a development-agent assessment, not independent acceptance of a new product
quality standard. Independent review remains part of the broader knowledge-ready gate.

## Retained-answer diagnosis

The [machine-readable report](../fixtures/loredock-completeness/retrieval-result.json)
records exact positions and citation use in both earlier runs. A passage being cited
does not establish that every limitation in it was included in the answer.

| Case | Supplied evidence | Conclusion from the retained outputs |
| --- | --- | --- |
| s04, v7/v8 | Worker README at rank 2, shared StockReserved contract at 13, local topic config at 19. | Required originals were present. Both answers cite the local value but omit the additional explanation demanded by the old rubric. Retrieval omission is not the cause of this historical failure. |
| s07, v7/v8 | README at 1, ShipmentStore/handler at 3, local target at 4; all are cited. | v7 omits the concrete-storage limitation despite citing the relevant interface. v8 states it. Citation resolution alone did not expose the omission. |
| s14, v7/v8 | README at 1, local route at 3, request at 4; the separate plugin source is absent. | The README explicitly supplies the unresolved plugin/build caveat. v7 mentions it and v8 does not. The old gate fails, but the question does not explicitly ask for that wider context. |
| s19, v7/v8 | Cursor method at 1, README at 2; both are cited. | v7 omits scheduling from the documented missing pieces; v8 includes it. The source was available in both. |
| r04, v7/v8 | Worker README at 1 and the interface at 14. | The v7 convergence speculation lacks implementation prerequisites even though its citation resolves. v8 avoids it. This is a support issue, separate from concise-answer completeness. |

The new baseline pins both raw runs, both semantic reviews and the original oracle by
hash, so this investigation cannot silently rewrite the previous outcome.

## Prospective retrieval result

Twelve intents each have two wordings, producing twelve development and twelve reserved
questions. The complete chosen evidence basis is retrieved for **12/12 development**
and **10/12 reserved** questions. The same two misses recur with fresh source IDs;
every selection and requirement result is stable. Maximum observed context is thirty
spans / 8,429 text bytes; maximum prompt is 31,993 bytes. Product caps remain thirty
spans / 64 KiB text and 96 KiB prompt. No model or runtime preparation occurs.

| Reserved case | Missing recorded reference | Bounded FTS diagnostic | Interpretation |
| --- | --- | --- | --- |
| h02: stock integration context | `contract-library/contracts/StockReserved.json` | Lexical rank 36 of 44; absent from the 18 expanded candidates. Expansion emphasizes order-worker identifiers and common Mongo/configuration fields. | The shared JSON contract is omitted at the thirty-span limit. The selected StockProjection record **already contains sku/units**, so the absent chosen reference does not prove that the message-shape proposition is unanswerable. Record equivalent support separately in semantic review. |
| h04: reservation runtime context | `inventory-api/src/Reservations.java` | Lexical rank 23 of 34; absent from the 13 expanded candidates. Expansion uses `headerBindings` and `tenantId`, admitting many order/identity passages before remaining lexical matches. | The handler's concrete Stock-port delegation is not supplied. A route naming `Reservations.reserve` does not establish that missing method body or its storage boundary. |

The production retriever admits its strongest six lexical matches, orientation samples,
expanded matches and then remaining lexical matches. Inspection shows two related risks:
frequent common identifiers dominate the expansion-term allowance, and expansion can
displace later direct matches. The h04 route's literal `Reservations.reserve` reference
is not among the current CamelCase/underscore expansion terms. These observations justify
a bounded retrieval experiment; they do not establish a universal ranking fix.

The reserved questions are **not held out for retrieval** after this measurement. They
remain unseen by the answering model, but were authored by the same agent after earlier
failures. Do not advertise them as an independent blind corpus or use their model outputs
for repeated tuning. Model budget for Task 028 is zero.

## Implementation contract and outcome

Task 029 should improve literal-reference expansion and candidate admission before any
new paid answer experiment. Preserve original source/answer history, the frozen questions,
and all caps. Compare generic strategies that retain query-relevant/per-source identifiers,
handle bounded qualified member references, and reserve direct lexical opportunity when
merging expansion candidates. Do not special-case fixture names, use answer expectations
as retrieval hints, add repository-picking fields or enlarge payloads to hide the issue.

Measure the original twenty questions, the prospective twenty-four and the original
three-source oracle together. Preserve collision, source/policy/review fences, byte limits,
fresh-identity stability and zero-hit orientation behavior. Include an unrelated source
with frequent identifier distractors and a qualified-reference example before tuning.
Report both chosen-reference recall and any equivalent supplied evidence without equating
either to answer correctness. Keep prompt v8 and model settings fixed during retrieval work.

After this offline prerequisite is understood, a separate bounded real-model task can
evaluate the prospective rubric once, with the development and reserved scores reported
separately and the earlier failed gate still visible. Task 028 has a zero-model budget;
later attempts belong to the explicit budget of a subsequent task under the owner's
standing authorization. Framework coverage, retention, independent review and an eligible
private pilot remain ahead of the Workbench bridge.

Task 029 implements this bounded experiment as retrieval v7. It reaches 24/24 recorded
reference sets with unchanged original expanded/pilot recall and unchanged limits.
[Final measurements and rejected variants](../fixtures/loredock-reference-retrieval/README.md)
retain the v6 evidence above as history. Prompt v8 remains fixed; prospective semantic
evaluation is still outstanding and Task 027's failed gate is not reclassified.
