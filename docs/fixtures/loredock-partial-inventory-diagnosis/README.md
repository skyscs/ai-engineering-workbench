# Ordinary partial-inventory preparation diagnosis

Task 129 follows the accepted [failed Task 128 gate](../loredock-prepared-flow-result/README.md).
PR #161 passed both exact-head CI events with 1,029 tests at `1dfb79e` before the
identical-tree merge `6150630`. The complete logs and verification ordering are retained
in [accepted-gate-ci.json](accepted-gate-ci.json).

This diagnosis has no reserved-family replay, application change, answer admission or
model call. Its ordinary permit inputs are development controls, not a new qualification
family. The consumed kiln family and its first failed gate remain immutable.

## Boundary under review

Source review finds three distinct decisions:

| State | Actual public contract / diagnostic boundary |
| --- | --- |
| Analysis is running | `QuestionPreparations.start` rejects a new preparation with `QUESTION_ANALYSIS_BUSY`. Source-reviewed; these small terminal controls do not claim observation of an active-analysis timing boundary. |
| Published, current-parser inventory for the current build | `CodePathsV2` may use it, including status `partial`. Publication/compatibility does not establish useful context or complete coverage. |
| Unpublished, incompatible or different-build inventory | Cannot be selected as that compatible inventory. Another matching published inventory may exist; otherwise native construction reports unavailable. |
| No compatible analysis | Source context may still prepare with an explicit native omission. |
| Terminal partial inventory with all code files parsed | The new ordinary observer permits its one public request after verifying exact file/gap counts. The frozen Task 128 `completed` prerequisite remains unchanged. |
| Partial inventory with failed/unattempted files | Outside these four controls. No readiness/usefulness conclusion transfers to it. |

The original source index, analysis processing, analysis coverage, native usefulness and
resource thresholds are reported separately. An inventory status cannot grant native
or semantic credit. A complete native item still means static, partial, unverified
evidence with unknown deployment coherence.

## Fixed first controls

Each control materializes four ordinary Git sources. The baseline keeps only the
`apply` action from the existing permit fixture, alongside its unrelated `locate` action.
All eight required original references are declared before execution: action, request,
route, publish, subscribe, consumer, write and selector. No oracle prose enters the app.

| Control | Files / code | Declared condition | One expected public preparation |
| --- | --- | --- | --- |
| completed | 12 / 5 | Published `completed`, all code parsed, zero file gaps | Required original-backed native path |
| constant | 13 / 6 | Add one unrelated constant-only file; published `partial`, one unsupported-TypeScript gap | Same required native path; partial/unverified qualifications remain |
| dynamic-request | 13 / 6 | Add one unrelated computed HTTP destination; published `partial`, one unsupported/dynamic HTTP gap | Same required native path; uncertainty remains |
| no-analysis | 12 / 5 | Actual Catalog-only construction, stopped and reopened through production without publishing a new build | Required originals with explicit unavailable native omission |

Each uses the actual production entry and public protected API. The first three wait
for the declared terminal file state, prepare once, repeat only the immutable review GET
and check exact originals/native edges/topic. The fourth reuses the accepted Catalog-only
helper. No candidate producer, parser, private validator, clock or limit is replaced.
The passive monitor retains raw resource failures separately from functional diagnosis.
An unknown error stops later controls; an independently retained usefulness failure may
allow the next fresh control, but is never repaired or retried.

The external owner has five declared catalog roots, including the Catalog-only stopped
checkpoint. Sources, full catalogs, HTTP bytes and first errors remain retained. Three
focused tests cover input isolation, terminal/coverage separation and rejection of
running, stale, incompatible or unfinished observations. The executable plan was
committed at `ba97dd7` before the first run; no executable changes followed it.

## First actual result

All four controls pass their functional diagnosis on their first execution. Each
produces one public preparation containing all eight required original references,
within eleven issued original spans from four sources.

| Control | Observed analysis | Native outcome | Raw maximum timer gap |
| --- | --- | --- | --- |
| completed | Five code files parsed; published completed, zero gaps | Useful required path; repeat review unchanged | 314.364279 ms, failed |
| constant | Six code files parsed; published partial, one `unsupported-typescript-profile` gap | Same useful required path; repeat review unchanged | 332.903393 ms, failed |
| dynamic-request | Six code files parsed; published partial, one `dynamic-or-unsupported-http-request` gap | Same useful required path; repeat review unchanged | 309.311866 ms, failed |
| no-analysis | Actual Catalog-only checkpoint and production reopen; no compatible inventory | Required originals; `INVENTORY_UNAVAILABLE`, no native item | 282.751807 ms, failed |

The three native items retain `partial`, static-analysis, unverified and unknown
deployment qualifications. The source indexes are complete; that does not imply
complete analysis coverage. All four observed maximum gaps are their first timer
intervals, above the unchanged 100 ms limit. Observed daemon RSS and heap pass their
individual bounds. These controls do not establish whole-product resource acceptance.

The external owner completes in 6,239.516 ms with zero errors or survivors and a
sampled owned-storage peak of 2,348,063 bytes. Independent review checks five complete
stopped catalog copies, sixteen clean Git identities, fifty original source files,
32 required-original matches and sixty raw HTTP responses. All three repeated review
pairs match exactly. Catalog integrity and foreign keys pass; attempts and witnesses
are zero. There are four preparation POSTs, zero answer admissions and zero model
calls. All 380 original raw entries remain unchanged. Independence here means a
separate checker over retained bytes, not external or blind product acceptance.

## Decision

The existing public API already accepts these terminal partial inventories and
returns the required useful path. Task 128 stopped at its stricter completed-only
evaluation prerequisite; that failure did not demonstrate public API refusal.
No product change is justified for the two observed coverage gaps. This conclusion
does not cover failed/unattempted files, missing required paths, arbitrary partial
inventories or the unobserved active-analysis timing boundary.

A future prospective gate should distinguish terminal processing from coverage,
while independently requiring the useful originals/path and retaining all gaps and
numeric limits. The consumed gate and its result remain unchanged. The smallest
next step is [Task 130](../../../tasks/130-loredock-cold-start-pause.md): attribute the
observed first-interval pause before choosing a startup fix. Dependency loading is
a possible cause, not yet a measured attribution. Near-limit heap, list work,
browser RSS and native-output size failures remain separate open work.

## Retained evidence

[records.json](records.json) binds the complete first run, pre-run executable/input
snapshot, independent stopped copies, review helpers, passive metrics and check logs
to archive hashes and per-file inventories. The original session tokens are redacted
by the existing HTTP recorder; request/response payloads and issued original text
remain available. No qualification rerun or model eligibility is implied.
