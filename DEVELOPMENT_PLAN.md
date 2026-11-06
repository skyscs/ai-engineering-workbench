# Iterative development plan — v0.1

## Goal and current state

Development repository: `git@github.com:skyscs/ai-engineering-workbench.git`.
The first release investigates defects, presents evidence and revises conclusions
after human intervention. Agent-driven code implementation remains outside v0.1.

Implementation and verification for each iteration are tracked in
[Development status](docs/development-status.md).
The owner changed the next development priority on 2026-09-28: preserve the current
Workbench and build LoreDock's system-wide context before further investigation features.
Follow the [LoreDock-first roadmap](docs/loredock/PLAN.md) and its
[specification/reuse review](docs/loredock/REVIEW.md).
[Task 014](tasks/014-loredock-scope-and-fixtures.md) delivered the accepted synthetic corpus
and mechanical feasibility checks. [Task 015](tasks/015-loredock-source-catalog.md)
delivered the model-free source catalog.
[Task 016](tasks/016-loredock-cited-answer.md) delivered the owner-accepted cited-answer
slice with runtime qualification. [Task 017](tasks/017-loredock-declaration-map.md) delivered
the accepted declaration map. [Task 018](tasks/018-loredock-static-flows.md) delivered bounded
code links and two partial static outlines. [Task 019](tasks/019-loredock-engineer-corrections.md)
delivered accepted relationship corrections and dependent-flow review invalidation.
[Task 020](tasks/020-loredock-incremental-refresh.md), accepted through merged PR #24,
began L4 with validated text-file reuse and visible committed-inventory changes.
[Task 021](tasks/021-loredock-correction-reconciliation.md), accepted through merged PR #25,
adds explicit review/reapplication
of earlier corrections when relationship semantics and all supporting evidence match.
[Task 022](tasks/022-loredock-project-orientation.md), accepted through PR #26,
adds basic original README context and a first reading guide.
[Task 023](tasks/023-loredock-answer-review-context.md) connects bounded engineer notes
to answer previews, immutable inputs and review freshness through merged PR #27.
[Task 024](tasks/024-loredock-scale-corpus.md) establishes a heterogeneous twenty-source
fixture and [capacity baseline](docs/loredock/SCALE_READINESS.md) through merged PR #28.
[Task 025](tasks/025-loredock-bulk-onboarding.md) adds reviewed bulk local paths, twenty
active sources and fixed equal index shares with baseline README orientation.
Task 025 reached main through PR #29 (`c5e8082`).
[Task 026](tasks/026-loredock-scale-retrieval.md) improves bounded twenty-source question
retrieval: 20/20 required-evidence recall, stable selections and visible source scope
without larger text/prompt limits, through merged PR #30 (`7fc97bb`).
[Task 027](tasks/027-loredock-scale-answer-quality.md) completes two real-model runs:
the final agent assessment is 18/20 expanded answers and 4/4 review cases, but required
limitations are still omitted in two answers. The semantic gate remains failed.
[Task 028](tasks/028-loredock-answer-completeness.md) diagnoses question/rubric alignment
and freezes twenty-four prospective wordings without model calls. Recorded evidence
is complete for 22/24, with two repeatable reserved-wording misses under retrieval v6.
These are reference-recall measurements, not new semantic scores; equivalent issued
evidence must also be assessed. Reserved wordings are inspected for retrieval and are
not an independent blind corpus.
[Task 029](tasks/029-loredock-reference-retrieval.md) adds source-balanced, query-affine
literal-reference expansion and direct-query priority within existing caps. Recorded
reference recall reaches 24/24 prospective cases, preserving both earlier 20/20 baselines.
All historical results remain unchanged.
[Task 030](tasks/030-loredock-prospective-answers.md) completes one fixed-prompt prospective
run: 11/12 development and 12/12 reserved cases pass agent review. Required propositions
are covered, but an extra unsupported header-propagation claim fails the semantic gate.
The 24-attempt budget is exhausted; no repeated tuning on these answers is included.
[Task 031](tasks/031-loredock-http-header-bindings.md) adds bounded model-free comparison
of literal request headers and same-document route bindings, with original evidence
and explicit unresolved mappings. Candidate links outside the two outlines are visible.
[Task 032](tasks/032-loredock-answer-interface-context.md) includes bounded derived HTTP
comparisons in answer previews, saved inputs and prompt v9 only when every original
supporting passage is already supplied. Retrieval v7 and all historical answers remain
unchanged. New context/provenance/budget/history checks use fake runtimes only.
[Task 033](tasks/033-loredock-interface-qualification-design.md) freezes a new twenty-source
freight corpus with fourteen prospective questions and 38 required propositions. All
recorded original references are available; six of ten interface questions also receive
their specific derived clue under the existing comparison cap. Product behavior is unchanged.
[Task 034](tasks/034-loredock-interface-answer-qualification.md) executes that contract
once after committing implementation/runtime identity. All fourteen attempts complete;
agent review passes 8/14 and the gate fails. Two required qualifications are omitted,
three claims overstate repository scope and two have incomplete local citations.
All original evidence and judgments remain available; old failed gates stand.
[Task 035](tasks/035-loredock-incident-context-baseline.md) freezes ten incident cases
and measures current candidate evidence without models. Both keyword and answer-context
owner unions recover all 22 critical repository occurrences, but average 14.7 candidates
and exceed every useful case bound. Routing/abstention decisions are not implemented.
[Task 036](tasks/036-loredock-source-candidate-preview.md) adds a model-free candidate
preview with original support and explicit uncertainty, using rules and fresh adversarial
cases frozen before implementation. Primary lists contain 1–4 sources and retain 18/22
critical repository occurrences; all four misses remain in Other matches. Broad answer
context is unchanged and automatic routing remains unavailable.
[Task 037](tasks/037-loredock-related-candidates.md) adds optional bounded related-source
context with original evidence on both sides. Union recall reaches 21/22, but list sizes
grow to 1–8 and only four cases meet both useful scope conditions. The primary policy
and answer context stay unchanged; extra links remain collapsed reading clues.
[Task 038](tasks/038-loredock-link-precision-qualification.md) evaluates a frozen structural
subject filter offline. It meets all size bounds and eight combined conditions, but loses
a useful configuration clue: recall is 20/22. Production v1 remains unchanged.
[Task 039](tasks/039-loredock-dojo-object-exports.md) adds bounded literal Dojo AMD object
exports under code adapter v3, including binding/module-boundary guards and preserved
historical review. The current diagnostic recovers 22/22 critical occurrences; only five
cases meet both useful scope conditions. Original span/lexical selection remains unchanged.
[Task 040](tasks/040-loredock-compact-related-sources.md) adds compact expandable reading
cards with clue subjects visible before opening, preserving selection and evidence.
[Task 041](tasks/041-loredock-synthetic-capacity.md) measures 3,679 files across twenty
sources at existing limits: complete original-context recall, all-text refresh reuse,
21/22 candidate recall and only 100/3,621 code documents examined. Retained database
growth and passage-order changes are recorded separately from stable passage sets.
[Task 042](tasks/042-loredock-source-order-qualification.md) qualifies strongest-link-first
ordering offline. It recovers the observed volume omission but loses a critical configuration
source in a frozen counterexample. Unconditional promotion is rejected; production stays v1.
[Task 043](tasks/043-loredock-related-source-pages.md) adds explicit four-source pages for
remaining eligible related repositories, preserving default order, primary/answer context
and original evidence. Context and scope changes fence pending page/evidence responses.
[Task 044](tasks/044-loredock-code-inventory-feasibility.md) examines all 3,621 code files
once and repeats on the same index: identical facts, 741,496 fact bytes, no failures,
and seven unsupported-syntax gap occurrences. All 98 sampled symbol ranges agree.
[Task 045](tasks/045-loredock-durable-code-inventory.md) implements the bounded durable
service with actual parser fingerprints, validated restart/resume, atomic file checkpoints,
source/policy fencing and two-inventory retention under schema 8. It reparses new indexes
and leaves existing projections/answers unchanged.
[Task 046](tasks/046-loredock-code-coverage-workflow.md) connects the service to new index
publication, protected API controls and compact code coverage/file browsing. Existing
indexes and interrupted work remain explicit; late context/detail responses are fenced.
[Task 047](tasks/047-loredock-exact-symbol-search.md) adds exact-symbol lookup over the
compatible published inventory, sharing the existing search input while preserving
independent text results. Original support, bounded scans and late-result fences are explicit.
[Task 048](tasks/048-loredock-symbol-search-qualification.md) qualifies all 3,621 retained
files in eighteen lookups, with identical repeats and 818/865 ms median/max local latency.
The prospectively amended oracle passes 18/18; the original 16/18 naming error remains recorded.
[Task 049](tasks/049-loredock-short-java-symbols.md) adds exact short Java class/method
aliases while retaining full identities, overloads and source ambiguity under query v2.
Compatible inventories remain usable without reanalysis.
[Task 050](tasks/050-loredock-synthetic-demo.md) delivers `pnpm loredock:demo`: twenty owned
sources with a ready index/inventory, separate retained data and model mode forced off.
The owner requested independent synthetic work while manual feedback is unavailable.
[Task 051](tasks/051-loredock-storage-audit.md) adds read-only storage accounting, separating
SQLite allocation, payload copies, live sidecars and history dependencies.
[Task 052](tasks/052-loredock-offline-compaction.md) adds explicit offline compaction of
already-free pages while preserving all logical history.
[Task 053](tasks/053-loredock-search-storage-feasibility.md) passes a prospective external-
content literal-search comparison: 182/182 mechanical checks and 17.8% lower total allocation
on the fixed small shape. [Task 054](tasks/054-loredock-search-rebuild-control.md) adds the
matched rebuild control: complete token/position equality, 112/112 query comparisons and
17.4% further total savings against rebuilding alone.
[Task 055](tasks/055-loredock-external-literal-search.md) implements production schema 9
with atomic legacy conversion, stable row identities/settings, transactional write/purge
and schema-8/9 maintenance compatibility. Logical text and stored copies are distinguished
in version-2 reports. [Task 056](tasks/056-loredock-history-retention-contract.md) maps
history dependencies and demonstrates that deleting old postings can reorder current
matches despite unchanged current text. Keep history by default; its chosen follow-up is the
[read-only generation dependency inventory](docs/loredock/RETENTION_DESIGN.md), not deletion.
[Task 057](tasks/057-loredock-history-audit.md) implements that bounded report, including
references from omitted generations, malformed-reference reporting and unchanged recovery
state. This completes the scoped read-only storage/history diagnostic sequence; future
retention, raw-content sharing or ranking changes need a separate prospective contract.
[Task 058](tasks/058-loredock-readme-sections.md) returns to source orientation with
bounded original README section navigation. [Task 059](tasks/059-loredock-readme-boundary.md)
verifies twenty full-budget READMEs with exact section/original-part and historical identity.
[Task 060](tasks/060-loredock-linked-reading.md) adds same-repository linked-document
reading with original citations, explicit gaps and fair use of remaining document budgets.
[Task 061](tasks/061-loredock-inventory-flow-contract.md) audits the gap between durable
code facts and the bounded graph, including correction and answer dependencies. Its
[design](docs/loredock/DURABLE_FLOW_DESIGN.md) specifies an offline parity/wider-input
comparison; it does not change production selection or graph budgets.
[Task 062](tasks/062-loredock-durable-flow-comparison.md) executes that comparison: serialized
parity holds, but wider reading retains seven critical facts and admits only three required
nodes in the 365-file case. Naive wider selection is rejected; parser-cap and harness failures
remain recorded. Next, freeze support-aware admission and ambiguity handling on fresh cases
before changing production behavior.
[Task 063](tasks/063-loredock-connected-admission.md) qualifies a separate connected-admission
prototype on fresh inputs: 306/306 checks, seven required nodes retained in both distraction
and multiple-dense-file cases, with global ambiguity and incomplete-source guards. Whole
paths fit unchanged display caps; other roots/branches remain explicitly omitted. The next
step is a separate integration/provenance/root-navigation contract and larger-universe
qualification. Existing application/answer/correction behavior remains unchanged.
[Task 064](tasks/064-loredock-connected-integration-contract.md) specifies the
[integration sequence](docs/loredock/CONNECTED_PATH_INTEGRATION.md): first qualify indexed,
cooperative resolution on fresh larger inputs, then add separate protected reads and a
collapsed path browser with four-entry-point pages. Generation identity and late-response
fences preserve originals and historical consumers. This is a design, not an available UI
or a replacement for current answer/review derivations. Scale qualification is next.
[Task 065](tasks/065-loredock-connected-scale.md) executes that fresh qualification with
indexed cooperative resolution: full reads of 9,975 code files meet the declared resource
bounds, but useful-path/root/branch conditions fail (605/628 checks). Unrelated constant-only
TypeScript gaps suppress imports and Java bindings under the conservative whole-source
rule. [All first-run results](docs/fixtures/loredock-connected-scale/README.md) remain frozen;
production promotion is rejected. Next, specify and independently qualify completeness for
each binding search, retaining unknown/truncated target blockers and existing history fences.
[Task 066](tasks/066-loredock-binding-completeness.md) specifies that
[completeness contract](docs/loredock/BINDING_COMPLETENESS.md): exact import target-path domains,
conservative same-source Java domains and separate ambiguity/incompleteness diagnostics.
Source path omissions and opaque boundaries remain blockers. A saved-tree proof must precede
absence claims, with bounded metadata and no projection Git calls. Next: freeze and execute
fresh useful-path, adversarial, tree-integrity and resource qualification before backend work.
[Task 067](tasks/067-loredock-binding-coverage-qualification.md) passes that fresh offline
qualification: 1,031/1,031 checks, independent saved-tree proof, conservative binding domains
and seven critical nodes/two writes through 9,975 code files. All first/repeat resource
thresholds pass; metadata, cancellation, scope, ambiguity and lifecycle failures remain
explicit. [Retained evidence](docs/fixtures/loredock-binding-coverage/README.md) permits the
separately scoped typed backend/protected-read phase, then simple browser integration.
It does not switch current graph/answer/review consumers or establish semantic acceptance.
[Task 068](tasks/068-loredock-connected-path-reads.md) implements the separately versioned
typed service and protected path/four-entry-point reads, with complete bounded envelopes,
original support, generation identity and cooperative busy/cancel/shutdown handling.
Existing consumers and storage remain unchanged.
[Task 069](tasks/069-loredock-connected-path-browser.md) adds the collapsed browser,
explicit page/root selection, inventory publication/eviction handling and stale-response/
evidence fences. Fifteen fresh Chrome checks cover desktop/narrow layouts and request
lifetimes.
[Task 070](tasks/070-loredock-path-consumer-contract.md) defines Phase D's
[consumer/provenance contract](docs/loredock/CONNECTED_PATH_CONSUMERS.md): qualify immutable
path receipts offline before adding durable consumers. Default display paths do not select
question context or repositories. History survives fact eviction only with complete saved
support and authorization dependencies. Next: freeze fresh receipt/lifecycle cases and
bounds, then run that separate model-free qualification. No production consumer changes
or new semantic acceptance follow from this design alone.
[Task 071](tasks/071-loredock-path-receipt-qualification.md) implements that separate offline
receipt experiment. Its frozen gate fails: 86/88 cases pass; a business-specific `orderTopic`
requirement drops the useful event hop, and a harness label-only lookup prevents the
changed-alternative history check. [First outcomes](docs/fixtures/loredock-path-receipts/README.md)
are retained without reruns. Receipt/history integrity and resource checks are useful but
do not permit production promotion.
[Task 072](tasks/072-loredock-event-topic-evidence.md) defines the separately versioned
[topic-evidence contract](docs/loredock/EVENT_TOPIC_EVIDENCE.md): exact bounded direct Java
literals, complete consumer/contract evidence, explicit dynamic-expression abstention and
no inferred JSON-setting binding. Next: freeze fresh useful-path, ambiguity, support and
receipt-lifecycle cases, then qualify that offline successor with typed observer identities
and raw observations journaled before assertions. Existing production adapters stay intact.
[Task 073](tasks/073-loredock-literal-topic-qualification.md) passes that fresh offline
qualification: 134/134 cases, 10,793 assertions, complete write-ending paths in eleven
positive variants, explicit dynamic abstention and typed alternative-history checks.
[All first observations](docs/fixtures/loredock-literal-topics/README.md) are retained with
the observer's unknown-gap limitation and readback. Small-family resource checks pass;
next qualify twenty-source/near-limit costs on fresh prospective inputs before a separate
production integration. This does not switch consumers or overturn old semantic gates.
[Task 074](tasks/074-loredock-capture-resource-contract.md) defines the
[complete capture budget](docs/loredock/CAPTURE_RESOURCE_CONTRACT.md): one internal deadline
and shared work counter with distinct path/receipt subtotals, preserving local caps and
publication fences. Next: freeze fresh twenty-source/near-limit useful paths and aggregate
exhaustion cases before implementing the separate offline successor. Fixed source shares
include documentation/configuration, and negative cases must assert the relevant reason.
The user demo and feedback stay separate from these checks; broader semantic synthesis
and question-context changes remain open.
[Task 075](tasks/075-loredock-capture-scale-qualification.md) implements the separate shared
budget and runs the fresh twenty-source family once. The
[first resource gate](docs/fixtures/loredock-capture-scale/README.md) is rejected: first
complete captures pass through 9,980 files, but repeated large captures exceed heap growth
and later history/small variants exceed process RSS. Keep every first outcome and all bounds;
next separately diagnose memory ownership, transient allocations and process/preparation
effects before qualifying a changed successor. Production consumers remain unchanged.
[Task 076](tasks/076-loredock-capture-memory-diagnosis.md) records the source ownership audit
and [fresh diagnostic boundary](docs/loredock/CAPTURE_MEMORY_DIAGNOSIS.md). Bounded phase,
query and owner observations must distinguish preparation/process effects and instrumentation
from read allocations. Same-process behavior remains mandatory; reopening or forced collection
cannot waive it. Next: freeze fresh inputs and execute that diagnostic before selecting one
optimization and a separate uninstrumented resource qualification. No production switch.
[Task 077](tasks/077-loredock-capture-memory-diagnostic.md) runs that fresh diagnostic once.
The [retained outcome](docs/fixtures/loredock-capture-memory/README.md) is rejected: sixteen
same-process operations preserve integrity, but six exceed memory and four fresh-process
arms stop at a prototype-sensitive source-header assertion. Thirty-two operations and all
cross-process parity remain unexecuted/unavailable. Next: fix and regression-test the entire
diagnostic process/JSON boundary before fresh attribution. No optimization is selected.
[Task 078](tasks/078-loredock-memory-runner.md) repairs that boundary in a separate
offline runner. Complete scalar-column comparison preserves source guards while an
independent three-process regression covers all 24 capture/page/history operations,
exact cross-arm bytes and changed-header refusal. Old experiments remain exhausted.
Next: freeze a new attribution family using the repaired runner; resource and semantic
acceptance remain separate from this functional process regression.
[Task 079](tasks/079-loredock-memory-attribution.md) completes the repaired paired
diagnostic on fresh inputs: 48/48 integrity passes and four exact process comparisons,
but only 39/48 resource passes. Large first captures exceed heap growth in all three
arms; history exceeds RSS after replacement analysis. Phase/count evidence cannot
apportion allocation causes, so no optimization is selected. Next: one targeted
allocation profile with a separate fresh-input protocol, then one evidence-backed
candidate and fresh uninstrumented qualification. The broad diagnostic is exhausted.
[Task 080](tasks/080-loredock-allocation-profile.md) completes that single targeted
profile with correct receipt content and complete sample references. Inspectable
snapshot stacks support one candidate: stream complete header validation and the
identical manifest hash input, retaining parsed IDs and all final fences. Profiled
allocation weights do not establish live-memory savings or resource acceptance.
Implement independently, then qualify on fresh uninstrumented capture/history
lifecycles without changing limits. No production promotion or old-family rerun.
[Task 081](tasks/081-loredock-streaming-snapshot.md) implements that opt-in candidate.
Real SQLite differential cases preserve the full snapshot and its refusal boundary;
all 24 independent process operations retain exact receipt/projection bytes and
shared work. Full strict checks, 519 tests and builds pass. Next: a separately frozen
uninstrumented resource qualification, including history RSS, before any integration.
[Task 082](tasks/082-loredock-streaming-qualification.md) executes that fresh family
once and rejects qualification. Its authored consumer name is outside the documented
profile, leaving useful paths truncated; large same-process isolated heap growth
and history RSS also fail. All first bytes/scores remain. Next: repair compatibility
review and independent raw/history evaluation, then choose remaining memory work
from evidence. No promotion, raised limits or rerun of this observed family.
[Task 083](tasks/083-loredock-qualification-recovery.md) defines that recovery:
review authored paths against pinned adapter prerequisites before freeze, and
evaluate raw artifacts/support/usefulness/history/parity/resources independently
with explicit dependent states. Next implement the offline assessment workflow
on tiny independent inputs, then scope the remaining memory decision. All old
failures and production boundaries remain intact; see
[ADR 0054](docs/decisions/0054-loredock-qualification-recovery.md).
[Task 084](tasks/084-loredock-qualification-assessment.md) implements the independent
offline assessment with bounded pure decoding and tiny positive/negative child
regressions. It retains raw comparisons/history after source or usefulness failures
and rejects any required failure or blocked dependency. Next: record the remaining
memory decision from retained ownership/allocation evidence before another resource
experiment. No exhausted corpus rerun or candidate integration is implied.
[Task 085](tasks/085-loredock-memory-ownership-decision.md) selects a targeted
terminal ownership diagnostic after reviewing saved allocation/close endpoints
and source lifetimes. Prepare bounded heap export/parsing on tiny inputs before
freezing a new positive family. Exactly two snapshots follow the normal long-lived
sequence; collection/export effects remain outside acceptance. No cache, payload
compaction or production promotion is selected; see
[ADR 0055](docs/decisions/0055-loredock-terminal-memory-ownership.md).
[Task 086](tasks/086-loredock-terminal-ownership.md) implements the bounded terminal
export/process/parser helpers on tiny independent objects. Weak/runtime/native
uncertainty stays explicit; snapshots never supply resource acceptance. Next:
separately author/freeze one compatible positive family and complete protocol before
the single terminal diagnostic. No prior measured code or input is reused as a run.
[Task 087](tasks/087-loredock-terminal-memory.md) completes one fresh twenty-source
terminal diagnostic. Full paths/originals/history pass; four operation resource
gates fail. Selected service instances disappear after release; the remaining
schema/database/statement matches have runtime-template structure. Next: one
request-local compact-payload candidate, preserving every validated fact/gap/domain
and final fence, proved first on independent regressions. A new uninstrumented
complete qualification remains mandatory; streaming is not promoted.
[Task 088](tasks/088-loredock-compact-payloads.md) implements that opt-in compact
entry representation and proves tested byte/work/refusal equivalence. No new
resource family or memory improvement is claimed. Next: freeze a fresh supported
complete-path uninstrumented qualification with both preparer/reopened lifecycles,
independent assessment and unchanged gates before any production promotion.
[Task 089](tasks/089-loredock-compact-qualification.md) executes that fresh two-arm
qualification once. All sixteen content/scope/observation checks and exact parity
pass, but only 11/16 resource gates pass: the long-lived preparer exceeds RSS five
times. The reopened arm passes all eight. No candidate is promoted. Next: one
bounded request-local prepared-read-statement reuse candidate, first proving fresh
execution and complete semantic/fence equivalence on independent tiny inputs.
Existing preparation/allocation evidence supports a hypothesis, not native ownership.
[Task 090](tasks/090-loredock-prepared-reads.md) implements bounded prepared-statement
reuse within one asynchronous path read. Independent SQLite and complete capture
tests preserve fresh values, exact bytes/work and all tested refusals/fences while
reducing preparation calls. No resource claim or production promotion follows.
Next: freeze and execute a fresh compatible complete uninstrumented qualification
for both required lifecycles, keeping every original content/resource gate.
[Task 091](tasks/091-loredock-prepared-qualification.md) executes that frozen
qualification once. Complete content, support, scope, history and raw parity pass;
resources pass 15/16. Reopened history starts over RSS after two inventory replacements.
Keep the failed gate and all bounds. Next: one focused source/query-count audit of
replacement preparation on independent tiny inputs before choosing another change.
The endpoints do not identify an allocation owner; no production promotion follows.
[Task 092](tasks/092-loredock-inventory-preparation.md) completes that independent
source/count audit. Each tiny replacement worker prepares 520 reads across ten SQL
identities; complete original validation and writes remain necessary. Next test
bounded prepared-read reuse within one asynchronous inventory worker, preserving
all lifecycle/freshness/fence behavior. This hypothesis requires independent semantic
proof and a fresh complete resource qualification.
[Task 093](tasks/093-loredock-worker-reads.md) implements that offline candidate
through an explicit pinned worker-method seam, retaining the original scheduler
and shared ownership guard. Independent stopped copies compare exact execution,
inventory and receipt identities, with lifecycle/fence/overlap regressions.
[Task 094](tasks/094-loredock-worker-qualification.md) completes a fresh frozen
two-process qualification: all complete content and cross-process bytes pass;
resources fail 15/16 because reopened isolated-path RSS reaches 398.035 MiB against
384. Next: one bounded source/representation audit of request-local facts and their
domain/gap/original consumers on independent tiny inputs before selecting a change.
[Task 095](tasks/095-loredock-path-representation.md) completes that audit: all five
paired selections match exactly; 24 fact-free files hold an identical 183-byte
fact/range shape while every file/domain remains necessary. Next test one immutable
request-local canonical pair after full validation, bounded to 4 KiB with exact
equality/fallback and unchanged evidence, coverage, work and fences. No optimization
or memory attribution is implemented by the audit.
[Task 096](tasks/096-loredock-canonical-facts.md) implements that bounded offline
representation. Exact-value immutability/fallback and complete tiny captures,
history, work/read counters and fences pass with 596 full-check tests/builds.
Next: separately freeze and execute a fresh complete two-process qualification.
No production promotion or reinterpretation of previous failed gates follows.
[Task 097](tasks/097-loredock-canonical-qualification.md) completes that fresh
qualification once: all sixteen content/scope/observation/resource gates and seven
exact cross-process comparisons pass on 9,960 files. Maximum operation RSS is
363.961 MiB against 384. Next: a separate production integration review of the
complete composed candidate, with typed ownership, all callers/fences, rollback and
qualification of the final composition. No automatic promotion or L5 claim follows.
[Task 098](tasks/098-loredock-production-integration.md) completes that source review.
The qualified reader also changes topic semantics/identities and offline receipt
accounting. Integrate representation into v1 separately from a versioned producer/
receipt migration; preserve explicit historical test controls and qualify the final
compiled composition. Next [Task 099](tasks/099-loredock-typed-resource-primitives.md)
implements only three typed internal resource primitives without wiring services.
[Task 099](tasks/099-loredock-typed-resource-primitives.md) implements those helpers
with twelve direct behavioral comparisons and 609 full-check tests/builds. All 415
measured dependencies remain unchanged. Next
[Task 100](tasks/100-loredock-independent-integration-reference.md) preserves the
minimal portable independent store/analysis test control before production wiring.
[Task 100](tasks/100-loredock-independent-integration-reference.md) preserves that
control and passes 612 full-check tests/builds. Source review corrects the earlier
fingerprint assumption: analysis implementation changes invalidate derived inventories
and generation IDs, requiring explicit reanalysis/rollback tests. Next
[Task 101](tasks/101-loredock-v1-resource-integration.md) integrates representation
into v1 while preserving independent controls and existing semantic boundaries.
[Task 101](tasks/101-loredock-v1-resource-integration.md) completes that integration:
629 tests/builds and fifteen compiled-browser checks pass. Old fingerprints require
explicit reanalysis; originals and recorded history survive backward reopen. No new
resource family or scale claim follows. Next
[Task 102](tasks/102-loredock-final-qualification-boundary.md) resolves the compiled
v1 versus shared-capture qualification contract before freezing a fresh family.
[Task 102](tasks/102-loredock-final-qualification-boundary.md) rejects a schema-only
adapter: v1 does not supply the required topic witnesses, exact shared work or native
capture/history. The revised order implements an internal native versioned producer
and typed complete capture before final qualification, with all existing gates intact.
Next [Task 103](tasks/103-loredock-versioned-path-producer.md) ports the internal v2
reader; the browser remains on v1 until the complete compiled composition qualifies.
[Task 103](tasks/103-loredock-versioned-path-producer.md) completes that internal
typed producer with native identities, literal witnesses, exact shared work and one
catalog owner across versions. Twelve native cases, 641 tests/builds and an independent
compiled smoke pass. Next
[Task 104](tasks/104-loredock-native-capture-ownership.md) decides native capture
storage, authorization/purge and recovery before publication/history implementation.
[Task 104](tasks/104-loredock-native-capture-ownership.md) selects catalog-owned,
UUID-bound immutable receipts with bounded capacity and mandatory purge/recovery.
Next [Task 105](tasks/105-loredock-native-receipt-codec.md) implements the pure strict
codec, then [Task 106](tasks/106-loredock-native-receipt-storage.md) wires storage and
schema-10 ownership. Native async capture/history and independent assessment follow
before the unchanged complete final-composition qualification gates.
[Task 105](tasks/105-loredock-native-receipt-codec.md) completes the strict pure codec:
79 focused cases/subcases, 720 full-check tests/builds and a compiled restart/eviction
smoke pass. All first failures remain retained. Next
[Task 106](tasks/106-loredock-native-receipt-storage.md) implements the already scoped
schema identity and catalog-owned publication/purge/recovery foundation.
[Task 106](tasks/106-loredock-native-receipt-storage.md) completes schema-10 identity,
owned native files and mandatory purge/recovery with 49 focused cases, 741 full-check
tests/builds and a compiled publication/restart/revocation smoke. Next
[Task 107](tasks/107-loredock-native-capture-history.md) connects the actual async
capture/history authorization boundary before independent assessment and the unchanged
final compiled qualification gates.
[Task 107](tasks/107-loredock-native-capture-history.md) completes the internal authorized
service, including shared budgets, complete source/original checks, guarded publication,
stop/cancellation and exact evicted history. Next
[Task 108](tasks/108-loredock-native-independent-assessment.md) implements offline native
assessment before the final compiled worker/coordinator and fresh qualification.
[Task 108](tasks/108-loredock-native-independent-assessment.md) completes functional
native assessment with separate integrity, shape, source support, usefulness and raw
history/comparison gates. Next
[Task 109](tasks/109-loredock-native-compiled-qualification-driver.md) drives the actual
compiled two-process lifecycle before freezing a fresh final family.
[Task 109](tasks/109-loredock-native-compiled-qualification-driver.md) completes that
driver with exact stopped snapshots/runtime identities, independent complete paths,
raw parity and resource/counter/lifecycle gates. Next
[Task 110](tasks/110-loredock-native-final-composition-qualification.md) freezes and
runs the single fresh final compiled native family before consumer integration.
Preserve all failed evaluations;
independent/private-pilot acceptance still precedes the bridge.
Source recall, agent scoring and merging do not establish L5 readiness.
Broader synthesis, adapters, semantic/AI refresh and scale acceptance remain separate.
[Tasks 111–114](docs/loredock/PLAN.md) preserve the failed resource outcomes, isolate
bounded analysis writes, verify compiled upgrades and pass one fresh final qualification.
Tasks 115–117 expose native reads, save/history APIs and the browser workflow. PR #121
head `3be8a26` passed push 41910682631 and pull-request 41910691383 CI and merged with an
identical tree at `4ab902b`.
[Task 118](tasks/118-loredock-saved-path-discovery.md) adds bounded saved-path discovery
with full-capacity/restart and browser validation. After its exact-head acceptance,
[Task 119](tasks/119-loredock-native-question-context-contract.md) returns to project
question context: audit native connection/evidence admission and specify an offline
comparison before changing production answers. Deletion/repair is not a prerequisite.
PR #122 completed Task 118 at `c59a792` after push 41916361811 and pull-request
41916371049 passed (identical-tree merge `883b589`). Task 119's
[contract](docs/loredock/NATIVE_QUESTION_CONTEXT.md) and
[ADR 0058](docs/decisions/0058-loredock-native-question-context.md) freeze a fresh
six-source mechanical relevance/support comparison, preserving production retrieval and
model behavior. [Task 120](tasks/120-loredock-native-question-context-feasibility.md)
completes that separate comparison with 44/44 required cases passing. The family is now
exhausted; production answers remain unchanged. [Task 121](tasks/121-loredock-prepared-question-lifecycle.md)
completes the [immutable preparation/witness design](docs/loredock/PREPARED_QUESTION_LIFECYCLE.md)
under [ADR 0059](docs/decisions/0059-loredock-prepared-question-lifecycle.md). [Task 122](tasks/122-loredock-question-read-selection-seams.md) adds production
scoped lexical accounting and native selection seams, preserving public/legacy behavior.
[Task 123](tasks/123-loredock-prepared-question-owner.md) owns one bounded transient
prepared snapshot. [Task 124](tasks/124-loredock-answer-owned-witness-storage.md)
adds atomic durable ownership, accepted through identical-tree merge `c1f6c37` after both
CI events at `a9c9cde`. [Task 125](tasks/125-loredock-prepared-answer-admission.md)
integrates internal prepared answer admission/publication with exact input and shared
ownership, accepted through identical-tree merge `b0c89df` after both CI events at
`9c21c17`. [Task 126](tasks/126-loredock-prepared-question-http-ui.md) connects protected
HTTP and the review flow behind a server experiment switch. Next
[Task 127](tasks/127-loredock-prepared-flow-qualification-contract.md) freezes fresh complete
resource and semantic qualification before changing the answer pilot default. Its
[contract](docs/loredock/PREPARED_FLOW_QUALIFICATION.md) and owned twenty-source inputs
precede [Task 128](tasks/128-loredock-prepared-flow-resource-qualification.md), a separately
sealed model-free full-flow run. Task 126 was accepted through PR #130 after both
final-head CI events at `480764d`, with identical-tree merge `0985f2c`.
The single Task 128 [reserved result](docs/fixtures/loredock-prepared-flow-result/README.md)
fails after the committed execution seal is accepted through PR #160. The family is
consumed; semantic continuation and adoption remain closed. After result acceptance,
[Task 129](tasks/129-loredock-partial-inventory-diagnosis.md) diagnoses terminal partial
inventory preparation on ordinary inputs. Its four first controls pass: the current
public API retains useful original-backed paths over the two observed partial variants.
No product change is justified for those gaps. [Task 130](tasks/130-loredock-cold-start-pause.md)
attributes the measured first-interval pause and removes redundant ESM compiler-loading
work. The corrected ordinary completed control improves from 320 to 202 ms, still
failing 100 ms; useful context remains intact. [Task 131](tasks/131-loredock-prepared-history-list-work.md)
introduces an explicit metadata-only summary boundary with one page budget. Its first
ordinary controls reduce twenty-row list work from 3,168,560 to 257,241 units at both
history sizes, preserving full detail and source fencing. After CI acceptance,
[Task 132](tasks/132-loredock-native-context-size.md) diagnoses the retained ordinary
native-size failure: 7,099 native bytes plus 1,268 legacy bytes and one separator.
Three repeated components offer a conditional 287-byte saving; the missing complete
historical item prevents claiming a repair from arithmetic alone.
[Task 133](tasks/133-loredock-native-context-factoring.md) implements versioned lossless
factoring. Its fresh full production path occupies 8,081 derived bytes and expands to
the exact 7,099-byte v1 item, preserving all eight required originals. Twenty existing
v1 answers and their prompts remain exact; one controlled v2 answer passes restart,
replay, browser display and source purge. These ordinary controls repair the observed
size failure without increasing limits. Startup, near-limit heap and browser RSS remain
unresolved; repaired qualification needs a new prospective family.
[Task 134](tasks/134-loredock-browser-memory-attribution.md) attributes the browser
excess without changing application bytes. Fresh thirty-second controls all fail raw
summed RSS, including a blank browser at 1.312 GB; UI controls reach 1.384–1.387 GB.
The current browser environment therefore fails the existing ceiling independently
of loading LoreDock. Diagnostic PSS and process roles do not replace that gate or prove
an application leak. Future browser qualification needs an explicit environment/contract
decision; no limit is relaxed and no default is activated.
[Task 135](tasks/135-loredock-compiler-isolation-design.md) audits both eager parser
paths and selects a staged owned file-parser thread in
[ADR 0062](docs/decisions/0062-loredock-owned-file-parser.md). Synchronous legacy
projections, answer validation, lexical accounting and transaction boundaries must
migrate before adoption; moving only durable analysis would leave startup blocking.
[Task 136](tasks/136-loredock-file-parser-adapter.md) implements the unwired adapter
with bounded ownership, actual exit joining and exact parser parity on pinned and
minimum Node versions. Its first ordinary lifetime yields eight exact results, but
delayed/missing external heap samples prevent memory qualification. The 139 existing
emitted modules and production entry behavior remain unchanged.
[Task 137](tasks/137-loredock-async-legacy-consumers.md) migrates legacy consumers and
accounting to explicit asynchronous phases while retaining the direct parser. Eight
prospective baseline cases preserve exact graph/context/review/prompt bytes and twenty-one
saved answers; delayed-parser tests enforce cancellation, write epochs and synchronous
commit fences. After exact-head checks and merge,
[Task 138](tasks/138-loredock-production-file-parser.md) first tests transport compatibility
before adoption. Two successful direct graphs fail the proposed 512-KiB wire limit even
with sources below 32 KiB, so production adoption is deferred without changing application
bytes. [Task 139](tasks/139-loredock-lossless-parser-transport.md) repairs repeated-string
transport with exact fact round trips and unchanged bounds. Its first candidate preserves
all three original graphs; the two failing replies now occupy 143,742 and 29,747 bytes
under the unchanged 524,288-byte limit. After exact-head checks and merge,
[Task 140](tasks/140-loredock-production-parser-adoption.md) adopts the owner in native and
legacy paths with asynchronous initialization, whole-operation admission and actual-exit
shutdown. Eleven ordinary catalog comparisons retain exact results and all 21 saved answers.
[Task 141](tasks/141-loredock-parser-observer-coverage.md) audits startup and parent/worker
coverage with unchanged application bytes. Both small lifecycle controls pass, but source
loading has a 324.833-ms parent interval and both modes have incomplete heap coverage.
[Task 142](tasks/142-loredock-resource-observation-decision.md) decides the supported
measurement boundary before another near-limit gate. It retains the worker architecture,
unchanged limits and blocked daemon heap/startup qualification; no narrower coverage
contract is adopted. [Task 143](tasks/143-loredock-pinned-browser-eligibility.md) independently
pins an official standalone browser for one fresh blank-page environment control. Neither
an eligible empty page nor a new binary repairs the old browser or full-flow failure.
That first control remains ineligible: 1,937,039,360 bytes summed RSS and a 103.099-ms
actual sampling gap exceed unchanged bounds, despite complete samples and clean shutdown.
[Task 144](tasks/144-loredock-browser-environment-decision.md) designs an independent
environment and sampling headroom before another single-use control. The read-only audit
selects the existing local Docker server and a digest-pinned Python base; no runtime
compatibility or eligibility is assumed. [ADR 0066](docs/decisions/0066-loredock-independent-browser-container.md)
defines durable exact container ownership, a kernel owner below PID 1, unchanged security
and browser flags, and a 50-ms nominal timer under the same 100-ms actual limit.
[Task 145](tasks/145-loredock-container-browser-eligibility.md) builds/freezes that environment,
tests ownership first and runs one blank control only if its prerequisites pass.
Its first image build succeeds, but the first preflight rejects an empty AppArmorProfile
on the unstarted created object. No container process or browser runs; the failure remains.
[Task 146](tasks/146-loredock-container-security-lifecycle.md) corrects the distinction
between requested security and applied runtime metadata on a fresh declared control,
requiring the default profile and actual enforcement before child execution.
All three lifecycle/security preflights pass. Its first launch attempt then fails browser
input verification before Chrome starts: an empty directory copied as root retains `0700`.
[Task 147](tasks/147-loredock-container-input-readability.md) fixes ownership and checks
complete directory metadata and non-root readability before a new prospective control.
Its image/input/lifecycle prerequisites pass and the blank lifetime completes, but the
first resource result remains failed: 1,309,532,160 bytes summed RSS and three incomplete
samples; cadence and actual exits pass. [Task 148](tasks/148-loredock-resource-gate-feasibility.md)
reviews feasibility and the acceptance boundary before another environment experiment.
Its [decision](docs/decisions/0067-loredock-resource-gate-feasibility.md) retains v1 and stops
undirected environment trials. [Task 149](tasks/149-loredock-observable-resource-contract-design.md)
designs a separately versioned observable resource contract for explicit review, without
adopting new metrics, rescoring old failures or authorizing another execution.
Its [v2 draft](docs/loredock/OBSERVABLE_RESOURCE_CONTRACT.md) proposes hierarchical
charged-memory envelopes and explicit heap diagnostics, with a complete v1 comparison
and prerequisite failure cases. Next [Task 150](tasks/150-loredock-resource-contract-review.md)
decides adoption and secure executor feasibility before any implementation or new run.
No application-page or full-flow gate is opened by these diagnostics.
See the [result and limits](docs/loredock/NATIVE_QUESTION_CONTEXT_RESULT.md).
On 2026-10-31 the owner authorized autonomous review, merging after successful checks,
and continuation through the planned development sequence. Keep each implementation
bounded, review the complete diff and verify CI for the exact PR head before merging.
Agent verification/merge does not constitute independent product or knowledge-quality acceptance.

Tasks 012–013 delivered the [UX simplification](docs/ux-simplification-plan.md).
The original v0.1 sequence below is retained as delivery history.
This document replaces the initial discussion plan. REVIEW.md explains findings;
ADR 0004 records architecture decisions. Original task numbers are preserved.
All project artifacts, documentation, code comments and commit/PR descriptions
must be written exclusively in English, regardless of conversation language.

## Sequence and demonstrable outcomes

| Order | Tasks | Work | Exit criteria |
| --- | --- | --- | --- |
| 1 | 001 | Prepare a checkout of the target remote and import the scaffold without the ZIP/local data; establish Node 22.12+, pnpm 10.15.0, lockfile, checks and local API foundations. | Clean install/typecheck/build; working dev and production UI; JSON API 404; rejected unauthorized origins. |
| 2 | 000 — early spike | Validate real Codex CLI against synthetic history: profile, read-only policy, two repositories, artifact access, JSONL/schema, failure and cancellation. | Record compatible CLI/configuration and limitations; obtain structured output without modifying source files. Resolve critical adapter limitations before production integration. |
| 3 | 002 → 003 | SQLite/migrations/directories, then Workspace, AI Connection, ModelProfile and minimal UI. | Settings survive restart; cross-connection profiles are rejected; repeated initialization/migration is safe. |
| 4 | 004 → 005 | Register existing/cloned repositories and implement explicit fetch. Start validation with a local fixture, then clone. | Registration/sync work; dirty checkout, index and HEAD are preserved; actionable Git errors. |
| 5 | 006 → 007 | Task, immutable artifacts, minimal StageRun/input manifest, then detached worktrees. | Prepare a two-repository task with an artifact through the UI; retry/failure does not duplicate or corrupt state. |
| 6 | 008 → 009 | Runtime adapter and first complete investigation workflow with validated evidence locators. | Real task → worktrees → investigation → root cause flow; deterministic FakeRuntime covers the same workflow in tests. |
| 7 | 010 | Challenge/constraint, result history and stale dependencies. | v2 records the revision; v1 remains inspectable; failed revision preserves the prior report; constraints carry forward. |
| 8 | 011 | Stabilization, Markdown export, Linux documentation and three acceptance investigations. | Release criteria pass, including restart/cancel/retry/challenge; record the verified release state. |

Demonstrate a persisted workspace after step 3, a prepared task after step 5,
a useful report after step 6 and human revision after step 7. Avoid polishing full
CRUD/UI before the first complete report. Create a small smoke fixture in Task 000,
reuse it throughout development, and complete three substantial release cases in 011.

## Delivery rules

- Keep one task or explicitly bounded task segment per branch/change. Link task,
  commits and validation evidence. Multiple commits are fine when review fixes
  make them clearer than an artificial one-commit rule.
- Before implementation, make the task's acceptance criteria concrete. Implement
  the smallest complete result, validate it and update status/documentation.
  Record significant architectural departures in an ADR.
- Track `not started`, `in progress`, `verified`, `accepted` and remaining limitations.
  Verification requires relevant checks and scenario evidence; user acceptance
  is recorded separately. A scaffold or passing typecheck is not a working feature.
- Follow the user's assigned scope: stop after a single assigned task; continue
  an explicitly authorized sequence without requesting approval at every task.
  Discuss material product changes separately.
- Establish reproducible checks in 001. CI uses source code and synthetic fixtures,
  without Codex credentials or real investigation data.
- Declare workspace package dependencies and keep core infrastructure-independent.
  Do not introduce a generic workflow platform, service queue or event sourcing.

## Minimum contracts

- JSON HTTP APIs validate external inputs and return stable error codes.
  File access resolves registered entity IDs rather than arbitrary file paths.
- Persist StageRun and its input snapshot before execution; the daemon owns the
  process. Start returns a run ID; SSE sends persisted events with sequence IDs.
  Reconnecting reads retained events; closing a browser does not cancel the run.
- v0.1 permits one active AI run per task and one AI process per daemon.
  Additional starts return explicit busy rather than entering a hidden queue.
  Serialize Git mutations by common git-dir; reject a second daemon for a data root.
- AIRunRequest includes connection/profile selection, instructions, repository/
  artifact manifest and read roots, schema version and cancellation signal.
  Provider-specific launch arguments remain inside the adapter.
- One AI invocation returns both investigation and root cause; validate and publish
  the pair atomically. INVESTIGATION_READY is an internal intermediate transition,
  not a requirement for a separate successful AI call.
- Retry creates a new StageRun. Restart marks unfinished runs failed/interrupted;
  explicit retry is available. Automatic paid retries or CLI session resume are
  not required for v0.1.

## Validation and release

For each task, run typecheck and relevant behavioral tests; run build when changing
application/build/package integration. At checkpoints, validate a clean installation,
full build and browser smoke. Select and record test tooling in 001; avoid tests
that only mirror implementation details.

Required scenarios include unavailable Git/CLI, invalid JSON, process failure,
interrupted streams, cancel vs completion, restart during an operation, duplicate
requests, disk-full import, stale inputs, incorrect profiles, dirty worktrees,
unavailable artifacts and nonexistent evidence locators.

Release fixtures cover a single-repository regression, a two-repository interaction,
and an incomplete/incorrect initial conclusion corrected through challenge and
constraint. Each has known history, expected evidence and a manual review rubric.
Assess reasoning and evidence rather than exact generated text or a confidence
number. Insufficient evidence is a valid outcome; an invented proven cause is not.

Run real Codex smoke separately through an explicitly selected local connection;
ordinary tests require no AI requests. Release evidence includes three investigations,
restart persistence, version history, valid Markdown export and a reproducible
Linux demo. Test platform path conventions without claiming full macOS/Windows
support before validating those systems.
