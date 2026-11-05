# Ordinary oracle setup and independent assessment

The [ordinary input module](../../../scripts/loredock-prepared-flow/ordinary-oracles.mjs)
extends the reusable permit example to eight synthetic repositories and ten model-free
question types. The [setup driver](../../../scripts/loredock-prepared-flow/oracle-setup-development.mjs)
creates independent original Git trees and actual catalogs, performs exactly one
preparation per case, and retains every actual review before assessment. It never imports
the reserved family, calls a model or changes application behavior. These ordinary
development inputs are not qualification results.

Nine setups use actual production HTTP indexing and automatic analysis. The no-analysis
case uses only the expressly permitted real Catalog setup, stops it and reopens through
the actual entry; no replacement build or manual analysis is started. The note case finds
the exact HTTP comparison by both original source/path endpoints, opens its supporting
originals, and writes the unverified human note through the real corrections API before
preparation. It does not attach a note to the first arbitrary graph edge.

## First outcomes

The first run finishes all ten preparations, with three assessment failures. All required
original source tuples are present across the ten cases. Two failures are an independent
reader defect: it looks for machine omission codes only in human-readable gap arrays,
although the accepted native item preserves those exact codes as positive `omissions`
counts. The consumer-method and dynamic-topic items each contain the required count of
one and omit the forbidden delivery/dispatch edges.

The [assessor correction](../../../scripts/loredock-prepared-flow/assess.mjs) recognizes
an exact positive safe-integer omission count as well as an exact gap entry. It does not
accept a missing, zero, negative, string or unrelated omission. The regression exercises
both required codes and those negative controls. No frozen oracle, expected gap, source
input, application output or resource threshold changes.

The separate [offline reassessor](../../../scripts/loredock-prepared-flow/reassess-oracle-development.mjs)
reads the original retained sources, oracle and review bytes. It checks file hashes and
uses zero additional candidate preparations. The original failed run remains unchanged;
the corrected assessment is a distinct retained artifact, not a new candidate result.
Both runs still exit 1 because the complete-path positive remains failed.

| Ordinary case | Corrected assessment of the original bytes |
| --- | --- |
| D01 complete path | **Fails:** native item omitted with `derived-size`; 8,368 combined derived bytes exceed 8,192. All eight required source references are present. |
| D02 ambiguous actions | Both action originals present; explicit `QUESTION_AMBIGUOUS` omission. |
| D03 consumer method gap | Partial native item; exact `unresolved-consumer-method: 1`; no delivery/dispatch edges. |
| D04 computed topic | Partial native item; exact `unresolved-topic-expression: 1`; no delivery/dispatch edges. |
| D05 empty cancellation handler | Dojo request, declared route and empty Java handler originals present. |
| D06 different header names | Both header originals present; optional native item omitted for derived size. |
| D07 existing index without analysis | Monitor GET original present; explicit `INVENTORY_UNAVAILABLE`; zero native analyses. |
| D08 unknown deployment | Original explicitly states unknown broker/collection/revisions; no native item. |
| D09 engineer note | Exact original header comparison plus the human/unverified note; optional native item omitted for derived size. |
| D10 untrusted quotation | Original quoted instruction present; no native item, model or tool action from the quotation. |

The genuine D01 positive failure is not repaired by weakening its expected result,
shortening inputs, removing qualifications, raising limits or switching to legacy input.
The derived-size refusal is bounded behavior but does not satisfy a required useful
native path. This ordinary finding joins the existing history-work, browser-RSS and
startup-delay concerns. Any product fix belongs to the subsequent task sequence;
Task 128 keeps the accepted application and frozen gate unchanged.

## Retention and scope

[records.json](records.json) binds the original run, separate offline assessment, complete
source Git trees/catalogs, original and corrected assessor inputs, and verification logs.
Independent inspection of ten complete stopped copies passes integrity and foreign-key
checks. Every catalog has zero answer attempts; only D07 has zero native analyses. Every
required original appears in its issued source review. The original trees and hashes
remain unchanged after reassessment and copied-catalog inspection. Both external owners
report zero errors and surviving descendants while preserving their driver's exit 1.
The corrected assessor passes all seven focused tests and the complete 958-test local
check, strict typechecks, production builds and the unchanged application/input seal.
The preceding local 957-test check is retained separately from the corrected validation.

The ordered history slice is accepted through
[PR #137](https://github.com/skyscs/ai-engineering-workbench/pull/137): push 42006715733 and
pull_request 42006778571 pass 957 tests at exact head
`3498a0333844970a51ded597dc5a2cb8a32880eb`. Merge
`4ccf622847e3c3d8905d14270c41fb234088cf25` has the identical tree. Both complete CI logs
are retained here.

This is nine passing ordinary prerequisite assessments and one failed required positive,
not a semantic score or a qualification of the reserved ten cases. Actual answer quality,
runtime wiring, incident causality, production deployment and tool-policy behavior of a
model are not tested here. The full R01–R15 coordinator, remaining process lifetime work,
resource assessor and final pre-observation executable/environment seal are still required.
