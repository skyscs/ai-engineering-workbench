# Development status

## Task 028 — Question-aligned completeness diagnosis

Implemented and locally verified, 2026-10-31. Task 027 reached main through PR #31
(`7258f5d`) after both exact-head CI runs passed. This phase preserves all raw runs,
scores and the failed expanded semantic gate. A review of all twenty original questions
separates direct obligations, necessary qualifications and optional wider context;
unsupported claims remain failures regardless of answer length.

The evaluator-only benchmark freezes twelve intents with development/reserved wordings
before measurement: twenty-four questions total. It includes narrow/contextual pairs for
topic, route, projection and cursor behavior, plus production, identity, schema/publisher
and migration controls. Original corpus/oracle and historical result/review hashes are
pinned. Only question strings enter the unchanged production retriever and prompt.

Two fresh twenty-source generations retrieve the complete recorded evidence basis for
**12/12 development and 10/12 reserved cases**, with no changed selection/requirement
results. h02 omits the shared StockReserved JSON contract at lexical rank 36; h04 omits
the Reservations method body at lexical rank 23. Common identifier expansion competes
with direct matches for the thirty-span allowance. The h02 handler record already supplies
the message fields, so a missing chosen reference does not establish answer impossibility.
Maximum observed input: 30 spans / 8,429 text bytes / 31,993 prompt bytes; caps are unchanged.

Historical diagnosis confirms that s04's contract/README were supplied, s07/s19 cited
passages without preserving every old-rubric limitation, and r04's speculative v7
convergence claim lacked implementation prerequisites. This investigation does not
retroactively reclassify their original gate results as passing.

Verification: full `pnpm check` passes **310 tests** (153 LoreDock, 22 script checks),
strict typechecks and builds. New checks pin the benchmark and historical files,
resolve original evidence, distinguish alternative/all-required reference groups,
reject wrong ownership/revision/blob/hash/ranges and test production query/oracle
separation across regeneration. No runtime preparation or model calls; no UI/product,
prompt, schema, retrieval, connection or budget changes. Owned sources are unchanged
and removed. All prospective semantic-review boxes remain unchecked.

See [Task 028](../tasks/028-loredock-answer-completeness.md),
[full question alignment and next implementation](loredock/ANSWER_COMPLETENESS.md),
[prospective rubric](../fixtures/loredock-completeness/RUBRIC.md) and
[measurement](fixtures/loredock-completeness/README.md). Reserved wordings were authored
after earlier failures by the same agent and inspected for retrieval; they are not a
blind independent corpus. Next: bounded literal-reference expansion/candidate admission,
then a separately budgeted answer experiment. Task 027's failed semantic gate, independent
review, framework coverage, retention and private-pilot requirements remain open.

## Task 027 — Expanded answer and engineer-review qualification

Evaluation completed, 2026-10-31; **expanded semantic qualification is blocked**.
Task 026 reached main through PR #30 (`7fc97bb`) after both exact-head checks passed.
Two complete runs use the explicit personal CLI 0.166.0 connection, text-only-v2,
gpt-5.6-terra / medium, unchanged twenty-source corpus/oracle and four review cases
frozen before model dispatch. The runner preserves complete prompts, originals,
raw responses, immutable attempts and usage; expectations never enter model input.

Agent assessment: v7 scores 17/20 expanded questions plus 3/4 review cases; v8 scores
18/20 plus 4/4. Prompt v8 clarifies declaration/contract/port boundaries and documented
limitations and rejects tentative reliability claims without prerequisites. v8 removes
the unsupported convergence inference found in v7 r04, but s04 still omits the message
contract/live-subscription distinction and s14 omits unresolved plugin/build wiring.
The zero-missing-required-uncertainty gate fails despite meeting the numeric threshold.
No cross-run answer selection, rubric weakening or independent approval is recorded.

Verification: full `pnpm check` passes **307 tests** (152 LoreDock, 20 script checks),
strict typechecks and production builds. Fake-runtime tests cover the complete case
sequence, source/oracle separation, durable dispatch checkpoints, raw failure retention,
output-directory refusal and no retries. Offline reconstruction checks all **1,352 input
span occurrences**, 204 claim assessments and 333 citation references against original
revision/blob/range/SHA-256 data. Both runs verify restart, exact replay with no new
call, immutable historical notes after withdrawal and revocation/purge of 24 answers.
Chrome regression passes with four fake calls, zero models and a 390px layout.

The budget is exhausted at **48 application attempts**, with 821,558 reported input
tokens, 20,184 output tokens and no reported cached input. All attempts report usage;
CLI-internal request counts remain unobserved. No private/corporate sources, authentication
store reads, model/account fallback or direct API. Source checkouts are unchanged and
removed; SQLite ledgers remain local. Exported synthetic review files retain evidence
independently of application revocation.

See [Task 027](../tasks/027-loredock-scale-answer-quality.md),
[ADR 0031](decisions/0031-loredock-expanded-answer-evaluation.md) and
[complete outputs, review sheets and remaining blockers](fixtures/loredock-scale-answer-quality/README.md).
Next: bounded completeness investigation with predeclared held-out paraphrases and
question/rubric alignment review before any further paid evaluation. Framework coverage,
retention, independent review and an eligible private pilot still precede the bridge.

## Task 026 — Twenty-source bounded question retrieval

Implemented and locally verified, 2026-10-31. Task 025 was agent-reviewed and merged
through PR #29 (`c5e8082`) after both exact-head CI runs passed under the owner's
standing authorization. Retrieval v6 adds bounded first-span samples for complete
normalized repository names, stable saved-source ordering for ties and a round-robin
zero-hit sample covering twenty-source opportunities. Longer identifiers do not match
name prefixes; duplicate display names preserve every identity. Cross-source lexical
and identifier-expanded evidence remains eligible.

The source limit stays thirty whole spans / 64 KiB; the complete prompt cap stays
96 KiB. Byte metadata is checked before original-file reads. Preview shows actual
represented-source counts, and gaps identify sources without passages without declaring
absence or irrelevance. Existing source/policy/review fences, immutable saved answers,
prompt v7, output schema v3, database schema 7 and runtime privileges are unchanged.

Verification: full `pnpm check` passes **303 tests** (150 LoreDock, 18 script checks),
strict typechecks and production builds. The expanded frozen oracle improves from
19/20 complete required-evidence sets to 20/20, repeated with fresh source IDs; the
original pilot remains 20/20. All twenty expanded selections and zero-hit locator
orders are stable across regeneration. The no-hit sample represents twenty repositories
instead of eighteen. Maximum expanded prompt size observed is 30,812 bytes.

Chrome verifies the twenty-source preview, named-source route citation, focus, mobile
layout, revocation and reload with zero runtime preparations/answer attempts. The
existing answer/review browser regression also passes with four fake calls and zero
real models. Tests separately cover ambiguous/prefix names, oversized/missing documents,
sample/candidate/byte bounds, refresh/history, restart and authorization.
See [Task 026](../tasks/026-loredock-scale-retrieval.md),
[ADR 0030](decisions/0030-loredock-scale-retrieval.md) and
[measurements and browser artifacts](fixtures/loredock-scale-retrieval/README.md).

No private source access or real model calls. These are recall and boundary checks,
not semantic answer, uncertainty-compliance, routing or L5 acceptance. Next: expanded
actual-answer and engineer-dispute qualification through an eligible explicit connection;
independent review, framework coverage and private-pilot gates remain separate.

## Task 025 — Bulk local sources and fair baseline orientation

Implemented and locally verified, 2026-10-31. Task 024 was agent-reviewed and merged
through PR #28 (`be29bca`) after both exact-head CI runs passed under the owner's
standing authorization. Task 025 adds one reviewed list of explicit local paths,
canonical duplicate/error previews, atomic registration, twenty active sources and
schema-7 retry receipts. Changed identities/registry revisions conflict; replay after
restart or revocation cannot create duplicates or restore removed sources.

New indexes persist equal path/byte shares with README/manifest priority, retaining
legacy admission on older builds. At twenty sources the default share is 500 paths /
2.5 MiB; unused shares stay reserved and omissions remain explicit. Overview v2 gives
all twenty sources original context or a gap, with 640 KiB input / 512 KiB output.
Maps, flows, answer/review/model budgets remain unchanged. Large connected-source lists
collapse so indexing stays reachable on mobile.

Verification: full `pnpm check` passes **299 tests** (146 LoreDock, 18 script checks),
strict typechecks and production builds; the final source-list UI adjustment also
passes its typecheck/build. Tests cover batch rollback, concurrent/changed identities,
replay/revocation, schema-6 upgrade and legacy resume, fixed allocation recovery,
10,010 extra first-source paths/large files and twenty 32 KiB README documents.
All three Chrome suites pass: twenty-source mobile onboarding, the existing source/
review workflow and the optional-answer fake runtime (four fake calls, zero real calls).
The production twenty-source measurement indexes 79 files / 16,869 bytes, excludes
sixty canaries and exposes twenty README contexts. Unchanged refresh reuses all 79
files. Two generations retain 33,738 raw bytes; these are small synthetic measurements,
not production performance or retention guarantees.

See [Task 025](../tasks/025-loredock-bulk-onboarding.md),
[ADR 0029](decisions/0029-loredock-bulk-source-baseline.md),
[capacity result](../fixtures/loredock-scale/onboarding-result.json) and
[browser scenarios](fixtures/loredock-bulk-onboarding/README.md).
No model calls or private-source access. Semantic answer quality and L5 readiness
remain unevaluated by this slice. Next: measure wider retrieval against the independent
twenty-question oracle before changing model payloads or returning to Workbench.

## Task 024 — Heterogeneous system corpus and capacity baseline

Implemented and locally verified, 2026-10-31. Task 023 was agent-reviewed and merged
through PR #27 (`586bff3`) after both CI runs passed under the owner's authorization.
An independent scale corpus now contains twenty distinct repository roles, 79 text files,
sixty excluded canaries and twenty frozen question/evidence/uncertainty cases. The original
pilot commits and oracle are unchanged. New sources include application/library/deployment/
data/documentation distinctions, multiple applications in one repository, an additional
consumer, same-name database collections, rename evidence and unresolved external behavior.

The generator creates only owned static Git fixtures. A compact baseline freezes the
revision vector and complete manifest/oracle hashes; tests reopen every evidence locator,
regenerate identical inputs and exclude all evaluator material from source trees. The
production probe records `SOURCE_LIMIT` for the fourth source without bypassing it; three
sources index eighteen text files, with sixteen more sources unattempted. Fixture creation
timing is distinct from indexing. Twenty-source latency/storage/quality remain unmeasured.

Verification: full `pnpm check` passes **293 tests** (140 LoreDock, 18 script checks),
strict typechecks and production builds. No product source/UI/runtime changed; prior
Task 023 browser artifacts remain the current UI verification. Zero model calls, no
private source access or modification of normal checkouts. See
[Task 024](../tasks/024-loredock-scale-corpus.md),
[fixture and measured baseline](../fixtures/loredock-scale/README.md) and the
[capacity audit](loredock/SCALE_READINESS.md).

A CI failure also exposed an existing ownership-test lifetime bug. The held child used
an empty timer and could lose its unreferenced SQLite handle to GC before SIGKILL.
Explicit collection reproduced the failure; retaining storage in the callback fixes it.
The existing recovery test now requests collection before asserting ownership exclusion.
No product locking code changed. Full checks include this deterministic regression.

Next: bulk local-path onboarding and fair baseline orientation, including store/UI/source
limits, source-balanced budgets, integrity/recovery and twenty-source browser scenarios.
This small topology is not a production load benchmark, private-pilot acceptance or L5.

## Task 023 — Engineer review in answer context

Agent-reviewed and merged through PR #27 (`586bff3`) after both CI runs passed,
2026-10-31. The owner authorized agent review,
merging after successful checks, and continuation to the next bounded phase. This
authorization does not substitute agent scores for independent product acceptance.

Ask Project now freezes latest matching disputes/clarifications alongside original
source spans, preserving exact versions and distinct human/source scope. Selection uses
evidence overlap with explicit unmatched/omitted counts; at most ten whole notes and
16 KiB of note JSON enter the separately labeled prompt context. Notes remain untrusted,
human and unverified. Source-only citation validation and runtime permissions are unchanged.

Review revision participates in context hashing and pre-dispatch/publication checks.
Changed review rejects pending work without replacing the last successful answer or
automatically regenerating it. Saved answers show independent current/changed/legacy
review state and retain their original bytes across edits, withdrawal and restart.
Every admitted note's dependency scope joins answer dependencies for revocation/purge.
Browser source/index/publication/review guards fence obsolete previews and detail responses.

Full `pnpm check`: **290 tests** (139 LoreDock), strict typechecks and production builds.
Chrome verifies prompt notes, escaped hostile text, saved history/scope, review-change
notice, withdrawal, original citations, restart, late-response boundaries and 390px
layout, retaining conflict/abstention/failure/cancel checks. Existing source/map/flow/
correction/reapplication/refresh browser regression passes. Production retrieval v5
retains **20/20** complete expected evidence sets. Four fake invocations, zero real
model calls; no schema change or modification of normal source checkouts/Workbench.
See [Task 023](../tasks/023-loredock-answer-review-context.md),
[ADR 0028](decisions/0028-loredock-answer-review-context.md) and
[recorded checks](fixtures/loredock-answer-review/README.md).

Prompt v7's semantic treatment of disputes has not been evaluated with a real model.
Evidence overlap is incomplete relevance matching; global review invalidation may
require a new preview after unrelated edits. Broader adapters, system synthesis,
20-repository scale and Workbench integration remain separate milestones.

## Task 022 — Project orientation and a first reading guide

Accepted through the owner's merge of PR #26 (`76fdde3`), 2026-10-31. Task 021
was accepted through the owner's merge of PR #25 (`b4cd66e`). A new Project overview
shows each authorized saved repository's original README context or an explicit gap,
selected revision and coverage. A collapsed Guide me route opens source context, the
declaration map, first partial flow and selected-index coverage with keyboard focus.
Unavailable/loading steps are explained. No additional setup or model call is required.

The versioned read projection preserves exact original lines and every overlapping
issued evidence span, using complete-file integrity checks after byte/span admission.
It recognizes one unambiguous supported root README and optional root package/Maven
reading links. Missing, ambiguous, excluded, code-only and limited material remains a
gap; failed/truncated inventories cannot establish absence. README attempts across all
sources precede optional manifests. Input/output and whole-line UTF-8 excerpt budgets
are explicit. The original outdated API topic description remains visible instead of
being rewritten to agree with configuration. Documented context remains unverified.

Historical context reconstructs from saved source after updates/restart. New registrations
outside the selected index appear separately; revoked sources/citations disappear and
old-policy content is fenced. Source/index/publication guards prevent late responses
from restoring old text. No new schema, durable derivative, Git command, source execution
or model invocation is introduced by orientation; LoreDock remains schema 6. Workbench
storage/runtime and normal source checkouts remain unchanged.

Verification: full `pnpm check` passes **282 tests** (131 LoreDock), strict typechecks
and production builds. Production-service evaluation records resolving original hashes/
locators, original/changed revision vectors, changed/missing documentation, pinned
historical context, restart and revoked-scope exclusion. Chrome verifies original
citations/focus, all guide navigation, an unavailable flow step, literal hostile text,
history/refresh/restart, late-response revocation fences and 390px rendering alongside
all previous source/map/flow/correction/reapplication scenarios. Existing answer-browser
acceptance uses four fake invocations; zero real model calls. See
[Task 022](../tasks/022-loredock-project-orientation.md),
[ADR 0027](decisions/0027-loredock-project-orientation.md) and
[recorded orientation evidence](fixtures/loredock-orientation/README.md).
This is basic source orientation, not semantic architecture synthesis or complete
L2/L3/L4/L5 acceptance. Broader terms/rationale/Guide me, production adapters,
answer-review integration, semantic/AI refresh, 20-repository scale/retention and the
Workbench bridge remain open. Owner acceptance remains separate from agent verification.

## Task 021 — Explicit review of earlier engineer corrections

Accepted through the owner's merge of PR #25 (`b4cd66e`), 2026-10-31. Task 020
was accepted through the owner's merge of PR #24 (`ff1cb6f`). An update now offers a
separate comparison of earlier engineer corrections with the selected index. It never
changes active review state by loading. A unique relationship with identical semantics,
properties and complete supporting file/span hashes/ranges can receive a new correction
only after explicit review and application. Changed, missing, ambiguous, unsupported and
already-reviewed targets are blocked; a current withdrawal is protected too.

The panel defaults to the fixed previous index. An optional older recorded ancestor
recovers a skipped review without silently resurrecting older decisions. Discovery is
bounded at 20 ancestors; one chosen index contributes at most 20 latest active notes and
512 KiB of details, with explicit omissions. Original/current evidence and wider source
revisions remain visible. Matching support does not prove that a human statement is
still correct in the new scope. Human scope remains unverified.

Schema 6 preserves earlier evidence/answer/correction bytes and atomically publishes a
new index-local version, exact original-version lineage, source-dependency union, fresh
affected flows and global review revision. Exact replay survives supersession without
reactivating a note. Source/target review edits, new publication and authorization changes
invalidate pending comparisons. Later source-note withdrawal does not delete an independent
new decision. Revocation fences/purges dependent text/snapshots; opaque provenance remains
authorized. Damage to an older index's evidence does not prevent withdrawing a valid new
note. Source projections and answer-model input remain unchanged.

Verification: full `pnpm check` passes **265 tests** (114 LoreDock), strict typechecks
and production builds. Chrome passes explicit application, both dependent flows, exact
origin/history, current-target protection, restart, skipped/older selection, changed
support, historical isolation, delayed-preview revocation fencing and 390px rendering,
alongside previous source/flow/correction/refresh acceptance. The existing answer-browser
regression uses four fake invocations. Production evaluation records original/changed
revision vectors, immutable histories and resolving original/new evidence. Zero real
model calls; normal checkouts and Workbench data remain unchanged. See
[Task 021](../tasks/021-loredock-correction-reconciliation.md),
[ADR 0026](decisions/0026-loredock-correction-reconciliation.md) and
[review evidence](fixtures/loredock-reconciliation/README.md).
Full L3/L4, broader orientation, semantic/AI refresh, answer-review integration,
production-framework qualification, 20-repository scale/retention and the Workbench bridge
remain open. Implementation-agent verification is separate from owner acceptance.

## Task 020 — Validated refresh and committed-inventory changes

Accepted through the owner's merge of PR #24 (`ff1cb6f`), 2026-10-31. Task 019
was accepted through the owner's merge of PR #23 (`5491545`). The first bounded L4
slice adds a fixed prior-index baseline, validated same-source extraction reuse and a
protected inventory comparison. Every current repository is still freshly snapshotted
and inventoried, including newly registered sources and added consumers.

On the unchanged frozen corpus, 18 text files are reused and Git file reads fall from
21 to three (the binary canaries). Changing one file, adding a packaged consumer and
removing a client reuses 16 files with five reads; the new consumer is visible in the
code projection and historical evidence stays pinned. Each new index owns fresh file,
span and search identities. No model or semantic-result cache was introduced.

Schema 5 preserves source evidence, saved answers and human correction history. Cache
eligibility includes policy/extractor/source/path/mode/blob/size; integrity checks cover
raw/Git hashes, complete spans and metadata fingerprints. Legacy checkpoints require
full extraction validation. Damaged cache falls back to pinned Git reads with explicit
rejection counters. Current limits run before reuse; cancellation, rollback and restart
retain publication/authorization fencing. A wholly failed update retains the previous
published index; partial/failed inventory cannot establish file absence.

The primary button becomes Update knowledge after publication. A selected-index summary
shows content/coverage changes and bounded source-balanced file details, with original/
selected citations. Diagnostics stay in details. Revoked scopes are excluded from both
sides; policy and late-response fences cover the new view. Old answers and engineer
corrections remain attached to their original index; no implicit review transfer occurs.

Verification: full `pnpm check` passes 245 tests (94 LoreDock), strict typechecks and
production builds. Tests cover corruption, key/policy/identity isolation, new consumers,
limits/preview bounds, partial failure, pause/cancel/restart, rollback, legacy migration
and protected transport. Chrome passes unchanged/changed updates, previous/current
citations, history/correction isolation, source/policy/restart and 390px layout. Existing
answer-browser acceptance passes with four fake invocations. Production evaluation
records 21/3/5 read attempts, original/changed revision vectors and source checkout
preservation. Zero real model calls. See [Task 020](../tasks/020-loredock-incremental-refresh.md),
[ADR 0025](decisions/0025-loredock-incremental-refresh.md) and
[recorded refresh evidence](fixtures/loredock-refresh/README.md).
At this checkpoint, full L3/L4 acceptance, broader orientation, semantic/AI refresh, correction reconciliation,
production-framework qualification, 20-repository scale and the Workbench bridge remain open.

## Task 019 — Engineer relationship corrections and review invalidation

Accepted through the owner's merge of PR #23 (`5491545`), 2026-10-31.
Task 018 was accepted through the owner's merge of PR #22 (`25032fd`). A separate
human/unverified overlay now supports disputing/clarifying declaration comparisons
and code links, optional engineer environment scope, append-only history and withdrawal.
Original source facts, map/flow v1 contracts and answer-model input remain unchanged.

Schema 4 preserves earlier catalog/answer bytes and adds correction versions, source
dependencies, affected flow IDs and a monotonic review revision. Exact normalized
request replay, optimistic concurrency, immutable-row triggers, atomic dependency
publication and byte/version/target limits protect history. A corrected shared code
edge invalidates both original pilot outlines for human review. Declaration corrections
conservatively invalidate flows sharing their supporting spans. Human scope cannot
become observed deployment evidence. New indexes require their own review.

All sources in the recorded index conservatively fence list/history/replay. Existing
resumable source purge removes every dependent note/scope/target snapshot, including
withdrawn versions. Inline controls retain drafts during review changes, require
explicit reconciliation of a newer target and reject late responses across source/index
boundaries. Browser testing also exposed an inherited grid sizing issue when long JSON
evidence was open at 390px; the workspace column now contains that scrolling content.

Verification: `pnpm check` passes strict typechecks, production builds and 229 tests
(78 LoreDock). Browser acceptance covers dispute/scoped clarification, two affected
outlines, concurrent edits/draft retention, history/withdrawal, escaped human text,
restart, new-index isolation, historical review and delayed-response revocation fencing,
alongside earlier source/map/flow scenarios. The existing answer-browser regression
passes with four fake invocations. Synthetic service evaluation records identical
source projections, original revision vector and source checkout preservation; zero
real model calls. See [Task 019](../tasks/019-loredock-engineer-corrections.md),
[ADR 0024](decisions/0024-loredock-engineer-corrections.md) and
[review evidence](fixtures/loredock-corrections/README.md).
Broader orientation, real-framework adapters, refresh/reconciliation, scale and the
Workbench bridge remain separate; full L3 acceptance is not implied by these tests.

## Task 018 — Code links and partial static flows

Accepted through the owner's merge of PR #22 (`25032fd`), 2026-10-30. Task 017
was accepted through the owner's merge of PR #21 (`a551f3c`). A separate model-free
projection now links supported TS/Vue and Dojo client syntax to declared routes,
unique Java handlers and source-declared publisher/subscriber/document-write interface
calls. The original three-repository corpus produces two partial outlines (10 and nine
steps), four candidate code links and ten resolving original evidence records.

Local syntax links and candidate HTTP/delivery/dispatch hops have separate statuses.
Matching complete supported record/contract shapes and one scoped topic clue never
establish shared broker, runtime config binding, encoding, dispatch or concrete database
selection. Those gaps remain visible; active environment/deployment coherence remain
unknown. Different records/contracts/environments, contradictory literal topics and
ambiguous names suppress links. Real production framework adapters remain unqualified.

The new protected endpoint and view retain complete-file original evidence, bounded
parsing/output, revocation/policy fencing, historical selection and deterministic restart.
The already locked compiler is now a runtime dependency; no new package, schema migration,
model call, source command or source-checkout mutation was added. Declaration-map v1,
answer retrieval and Workbench behavior remain unchanged. Citation reads now use a
separate latest-selection guard after Chrome exposed clicks dropped by the old shared
busy mutation handler; delayed older responses cannot replace a newer selection.

Verification: full `pnpm check` passes 216 tests (65 LoreDock), strict typechecks and
production builds. Browser acceptance covers both outlines, write evidence, candidate/gap
labels, deliberately reordered citation responses, historical/current indexes, source
removal, policy/reindex/restart and 390px layout. Existing answer-browser acceptance
passes with four fake invocations and zero real model calls. See
[Task 018](../tasks/018-loredock-static-flows.md),
[ADR 0023](decisions/0023-loredock-static-code-flows.md) and
[recorded flow evidence](fixtures/loredock-static-flows/README.md).
Engineer-supplied scope corrections and derivative invalidation follow in Task 019;
full L3, 20-repository scale acceptance and the Workbench bridge are not claimed complete.

## Task 017 — Declaration map, first L3 slice

Accepted through the owner's merge of PR #21 (`a551f3c`), 2026-10-30.
A model-free read projection exposes
repository/package identities, declared HTTP routes and unresolved handler references,
flat event contracts and configuration values, with original source citations. The
frozen corpus produces three repository identities, 16 declarations and two candidate
cross-repository clues. Equal names/text never merge entities or prove runtime connections;
different explicit environments are not compared. The map stays partial.

The protected API and browser view use an authorized pinned index, current policy and
source registry. Unsupported/oversized input and graph limits are explicit. Entire
documents must have complete original span coverage before any field is mapped. The
view persists no new derived text, needs no migration or Codex setup, and recomputes
identically after restart. Old/new index selection, revocation and late-response fencing
preserve the existing boundary. Code-flow ownership and human corrections remain later L3 tasks.

Verification: `pnpm check` passes 197 tests, strict typechecks and production builds;
all 46 LoreDock tests also pass after the final missing-span guard. Chrome verifies
route/contract evidence, candidate labels, hostile metadata as escaped text, historical
selection, removal/policy/reindex/restart and 390px layout. The existing answer-browser
regression passes with four fake invocations. Zero real model calls and unchanged
normal source checkouts. See [Task 017](../tasks/017-loredock-declaration-map.md),
[ADR 0022](decisions/0022-loredock-declaration-map.md) and
[recorded map evidence](fixtures/loredock-declaration-map/README.md).

## Task 016 — Bounded cited-answer slice owner-accepted

Owner-accepted on 2026-10-30 after PR #20 merged (`474cec1`) and the owner's completion
acknowledgement. The original 20/20 agent assessment, 162 resolving citation references
and 289 checked span occurrences remain agent evidence; no separate human numeric score
or individually signed per-question checklist was supplied. See the
[acceptance record](loredock/L2_ACCEPTANCE.md). Historical agent snapshots and failure
runs remain unchanged rather than being rewritten as human scores.

The accepted scope is the three-repository source-to-cited-answer workflow, with exact
issued locators, scope/conflicts/unknowns and durable failure/cancellation/restart behavior.
The first L3 declaration map follows it. Cited answers remain an explicitly selected mode
through `LOREDOCK_ANSWERS=1`; model-free catalog/map use needs no Codex configuration.
Scale, broader Overview/Guide Me, code flows, routing and the Workbench bridge retain
separate milestones. See the [answer checkpoint](loredock/ANSWER_FOUNDATION.md) and
[original complete evaluation](fixtures/loredock-answer-quality/README.md).

## Task 015 — LoreDock source catalog

Implemented and locally verified on 2026-09-28; merged through PR #18 (`769c652`),
confirmed on 2026-09-30. Separate
LoreDock daemon/web apps provide local repository registration, committed-text indexing,
coverage, FTS5 search and exact persisted source evidence. Schema 1 owns its data and
single-writer lock; no Workbench database or runtime changes were made.

Durable file units implement explicit pause/cancel/resume, interruption recovery,
request replay, checkpoint validation and atomic publication. Policy changes and source
revocation fence access immediately; pending content purge resumes after restart.
The reader avoids checkout/fetch and source hooks/filters, preserves original bytes,
and reports unsupported content and limits explicitly. Full source/read failure retains
the last published index. See [ADR 0019](decisions/0019-loredock-local-catalog.md) and
the [LoreDock guide](loredock/USER_GUIDE.md).

Verification: `pnpm check` passed 162 tests (the existing 145 plus 17 LoreDock tests),
strict typechecks and production builds. Chrome passed the three-source flow with
18 indexed files, nine exclusions, three topic matches, opened evidence, keyboard
focus, 390px layout, revocation, policy fencing, reindex and persisted restart. Inputs
were synthetic and zero real model calls were made. See
[browser evidence](fixtures/loredock-catalog/README.md).

The owner merged PR #16 to main and PR #17 into its former UX base. This iteration
includes that already-reviewed L0 branch so both L0 and L1 reach main together.
Task 016 is now in progress and retains the CLI qualification gate.

## LoreDock-first direction — Task 014 foundation verified

The owner requested a shift on 2026-09-28: keep Workbench available and prioritize
persistent system context for approximately 20 repositories. The confirmed stack is
Java/JavaScript/TypeScript, Vue/Dojo, Kafka and MongoDB, with README-led documentation.
The [roadmap](loredock/PLAN.md) sequences knowledge ingestion, a cited-answer slice,
system relationships, reliable refresh and scale acceptance before the Workbench bridge
and automatic investigation scope. The [review](loredock/REVIEW.md) maps the supplied
draft to actual code and records reuse limitations and unresolved boundaries.

[Task 014](../tasks/014-loredock-scope-and-fixtures.md) is accepted through PR #17.
The [synthetic corpus](../fixtures/loredock/README.md)
contains three deterministic repositories, 20 questions and ten routing cases.
[Measured feasibility](loredock/FEASIBILITY.md) covers FTS5, issued evidence validation,
persisted interruption and cancellation using an existing process helper. `pnpm check`
passed 145 tests, strict typechecks and production builds. Zero real model calls were made.

The installed CLI 0.158.0 is outside the adapter's verified versions. Read/write isolation
and real-model source-instruction handling remain unresolved; qualification gates Task 016.
[Task 015](../tasks/015-loredock-source-catalog.md) subsequently delivered the model-free
catalog, recorded above; [Task 016](../tasks/016-loredock-cited-answer.md) remains proposed.
L0 itself made no production application, Workbench migration or user-data change;
Workbench's delivery history below is preserved.

## Task 013 — Primary investigation workflow

Implemented and locally verified on 2026-09-28. The accepted composer is now the
primary UI; `/advanced` retains detailed workspace/task controls and existing data.
One explicit launch checks the chosen setup, resolves committed source, persists
context, prepares worktrees and invokes the existing investigation runtime.

Schema 11 adds durable drafts, bounded text uploads and idempotent launch records.
Cancellation during preparation cannot start a model; restart retains inputs and
requires an explicit new attempt. Local paths resolve current HEAD for a new task,
managed remote URLs reuse and refresh their clone, and existing tasks retain pins.
Retries preserve context edits made through Advanced settings. Reports, evidence,
revisions and Markdown export use actual existing services.

Verification: `pnpm check` passed 141 tests (17 Git, 14 adapter, 43 storage,
57 HTTP/service and 10 script tests), strict typechecks and production builds.
Tests cover optimistic writes, UTF-8/budget validation, upload and launch replay,
interrupted operations, current HEAD with a dirty checkout, remote reuse, setup
failure before task locking, cancellation before model claim and preserved legacy
context. The primary Chrome workflow passed with three synthetic invocations and
zero real model calls. The full `/advanced` browser regression also passed with
nine synthetic attempts. Existing manual data upgraded from schema 10 to 11 after
a complete stopped backup; original workspace/task/run/report rows remained byte-for-byte
unchanged and SQLite integrity passed. The built daemon is available for manual use.
See [browser evidence](fixtures/primary-investigation/README.md).

Documentation now starts with the primary workflow and keeps the detailed advanced
walkthrough. This branch includes the earlier configuration-boundary fix and static
prototype; it does not require those PRs to be merged separately first. Subsequent
UX changes should follow actual use. Composer support remains bounded UTF-8 text;
large originals and explicit ranges remain in Advanced settings.

## Task 012 — Investigation UX prototype

Implemented and browser-verified on 2026-09-28; direction accepted by the owner.
The accepted [simplification direction](ux-simplification-plan.md) starts with an
isolated [static prototype](../prototypes/investigation/README.md). It covers a
single composer, one-time sample setup selection, attachments, progress, failure,
cancellation, evidence, revision/history and sample Markdown export.

The browser smoke passed, including preserved inputs after setup failure, retained
reports after failed revision, explicit setup choice, keyboard dialog behavior,
escaped filenames and desktop/mobile layout. It verified zero API/model requests
and browser-storage writes. See [Task 012](../tasks/012-investigation-ux-prototype.md)
and [recorded results](fixtures/ux-prototype/browser-result.json).

The standalone prototype uses page memory and fixed sample results. The owner
subsequently requested production integration, recorded in Task 013 above.

## Post-v0.1 correction — configuration discovery boundary

Status: verified locally, merge acceptance pending. Scope: AEW-004; see
[ADR 0016](decisions/0016-worktree-configuration-boundary.md).

The default Linux data layout exposed a false preflight rejection: an unrelated
user `.codex` ancestor blocked a saved alternative configuration directory. The
adapter now pins CLI project discovery to cwd and retains `.codex` rejection at
every selected worktree root, including secondary roots and symlink entries.

Validation: `pnpm check` passed with 133 tests (17 Git, 14 adapter, 40 storage,
52 HTTP/service and 10 script tests), strict typechecks and production builds.
The synthetic boundary probe passed on Codex CLI 0.153.4 and 0.154.0 for base and
named profiles, custom markers, malformed ancestors and retained project-local
rejection. A local saved-run preflight also passed with the selected configuration;
the idle manual daemon was restarted with the build and its failed-run history
remained unchanged. These checks made zero model requests; a new investigation
remains an explicit user action. Browser UI code and database schema are unchanged.

## Current baseline

Tasks 000–011 are accepted. PR #12 merged v0.1.0 into main as `9e39d3c`.
For current usage, see the [user guide](user-guide.md); for verified scope, see
[release acceptance](release-acceptance.md). The task sections below preserve
historical implementation and verification notes; their descriptions of next steps
refer to the stage at which those notes were recorded.

## Task 001 — Bootstrap local shell

Status: accepted through the user's merge of PR #1 into main (aa56532).
The P2 navigation finding remains open; see [open issues](open-issues.md).

Implemented: pinned Node/pnpm baseline, dependency lockfile, recursive workspace
build, test/CI commands, local session and CSRF protection, exact Host/Origin
checks, JSON API fallback, strict Vite port, graceful daemon shutdown.

Verification completed so far:

- Node 22.23.2 and pnpm 10.15.0 installation; official Node archive SHA-256 checked.
- Strict typecheck across all eight packages/apps, seven passing HTTP behavior
  tests, and complete production build.
- Real production HTTP health response and headless Chrome rendering
  `Local daemon connected.` with session bootstrap.
- Second daemon exits with status 1 and an actionable occupied-port error.
- Clean source copy: frozen-lockfile installation from the package store,
  full typecheck, all seven tests and production build passed.
- Headless Chrome loaded the development UI through Vite proxy and rendered
  `Local daemon connected.` with the protected session endpoint.
- SIGTERM closed the production daemon with exit status 0.

GitHub Actions run 34364370559 passed for f7359a9. The shell's system Node 18
was not changed; verification used an isolated Node 22.23.2 toolchain. Developers
must select the pinned Node version before running project commands.

## Task 000 — Runtime feasibility

Status: accepted through the user's merge of PR #2 into main (6b9a967).

The user selected the current Codex CLI configuration, `gpt-5.6-terra`, with
reasoning effort `medium`. Do not ask for this selection again on resumption.

Confirmed: CLI 0.153.4, synthetic fixture generation, read access to both repositories
and the artifact, and denied writes (EROFS) in all three fixture directories.
The initial invocation failed at the account usage limit. After resumption, a real
investigation completed and correctly identified the cross-repository timeout-unit
regression with evidence from both repositories and the log.

Explicit cancellation and timeout probes passed with unchanged fixtures and no
remaining owned process group. Both returned CLI exit code 0, so the requested
stop reason must take precedence over the process code. Recoverable connection
error events were also observed before a successful turn.

The raw CLI accepted a nonexistent profile. The spike now checks profile-file
existence/readability and CLI parsing before exec; missing profiles cannot fall
back to the default connection. A local canary confirmed named file loading.
Unsupported-option returned the expected error. Isolated `codex login status`
confirmed missing-login detection without accessing user credentials or calling
a model; expired-token failures during exec remain synthetic test coverage.

The selected configuration has no enabled MCP servers, and the restricted feature
flags were confirmed through CLI diagnostics. Enabled MCP configurations are
rejected before exec. External notification commands are disabled per invocation.
A fresh real investigation passed after these launch changes, with unchanged
sources/Git state and no remaining owned process group.

Validation: `pnpm check` passed, including strict typechecking, seven HTTP tests,
seven runtime tests and the production build. Opt-in local negative probes passed.

See [runtime compatibility and evidence](runtime-feasibility.md) for commands,
supported restrictions and Task 008 obligations.

## Task 002 — Local storage foundation

Status: accepted through the user's merge of PR #3 into main (d8d4bf2).

Implemented: platform data-root resolution with `AEW_DATA_DIR`, private managed
directories, built-in SQLite, foreign keys, WAL, bounded busy timeout, transactional
versioned migrations with checksums and newer-schema refusal. A separate SQLite
ownership lock rejects another daemon and releases on process death.

The daemon initializes storage before listening, releases it on bind failure and
shutdown, and exposes session-protected `GET /api/storage` without local paths.
ADR 0005 records the driver choice and future file-operation recovery contract.
Node 22.23.2 remains pinned; the minimum version is now 22.13 for `node:sqlite`.

Validation: strict typecheck and production build passed; 11 SQLite/path/
process tests, 8 HTTP tests and 7 runtime tests passed. Production-to-development
restart smoke preserved migration history; same-root startup was rejected and an
occupied-port failure released storage ownership. Graceful SIGTERM exited 0.
Clean source installation from the frozen lockfile and local package store passed
the complete `pnpm check` (26 tests). Headless Chrome with a fresh profile rendered
`Local daemon connected.`. No test used the normal application data directory.

The P2 navigation issue AEW-001 remains tracked separately; no change to its
behavior is included in Task 002.

## Task 003 — Workspaces and AI connection metadata

Status: accepted through the user's merge of PR #4 into main (8134f14).

Implemented: domain validation, schema version 2, workspace/owned-connection and
model-profile persistence, protected CRUD API and browser forms. Connection/profile
ownership cannot be reassigned. A persisted boundary lock prevents launch-setting
changes and workspace deletion; Task 006 must integrate it atomically with
first-task creation. ADR 0006 resolves one connection per workspace and documents
the later repository/task deletion requirements.

The UI distinguishes configured metadata from a verified runtime. No Codex
subprocesses, credential reads or model invocations are introduced. Model IDs stay
opaque; optional settings explicitly select CLI defaults.

Validation: a clean source copy installed from the frozen lockfile and local
package store passed the complete `pnpm check`: strict typecheck, 18 storage tests,
11 HTTP tests, 7 runtime tests and the production build. Tests include rollback of
the connection after an injected workspace-insertion failure and upgrade from
schema version 1 with its migration record preserved. Real Chrome checks passed for creation,
connection/profile edits, rename, persistence through production-to-development
daemon restart, a 390px viewport and workspace deletion confirmation/cancellation.
The [browser result](fixtures/workspaces/browser-result.json) contains synthetic
fixture outcomes only. No test used the normal application data directory.

## Task 004 — Repository registry

Status: accepted through the user's merge of PR #5 into main (9dadec4).

Implemented: system Git adapter, schema version 3, protected registration/clone
APIs, repository list/detail forms, persisted clone lifecycle and restart recovery.
Canonical checkout/common git-dir identities are recorded; ownership and duplicate
checks protect workspace boundaries. Workspace deletion is blocked while repository
records exist. ADR 0007 documents process/authentication limits and managed cleanup.

Existing checkouts are inspected without modifying HEAD, index, working files or
configuration. Managed clones use staged directories without checkout, templates
or shared objects. Failures preserve redacted stderr/status. Graceful shutdown
stops owned Git processes; abrupt restart retains recorded paths for inspection.
No fetch or task-worktree behavior is introduced.

Validation: a clean source copy installed from the frozen lockfile and local
package store passed strict typecheck, all 50 tests (7 Git, 20 storage, 16 HTTP,
7 runtime) and the production build. Git 2.53.0 / Node 22.23.2 were used locally.
The transport/SSH regression confirms protocol restrictions after URL rewriting
and invocation of a configured SSH command with noninteractive options.
Chrome on the clean build passed registration, successful and failed clone,
dirty-state preservation, restart persistence, mobile layout and blocked workspace
deletion. No test used normal application data or an AI invocation.
The [browser result](fixtures/repositories/browser-result.json) uses synthetic data.

A separate [real SSH clone](fixtures/repositories/remote-clone-result.json) of
`git@github.com:skyscs/ai-engineering-workbench.git` through the new service reached
`ready` at merged main 8134f14 in an isolated data root. It used the session's
existing `ssh -F /dev/null` override; no SSH configuration or credentials were
changed. HTTPS authentication was not exercised against a real remote.

AEW-001 remains open and
unchanged. Repository removal and non-Linux process/durability support remain
outside the verified Task 004 scope.

## Task 005 — Repository synchronization

Status: accepted through the user's merge of PR #6 into main (be6cc72).

Implemented: explicit protected sync endpoint, persisted running/terminal states,
separate attempt and successful-fetch timestamps, UI action/status/diagnostics,
no-remote metadata refresh and startup interruption handling. Git validates
canonical paths, all remote refspecs and supported symbolic refs before fetch;
common git-dir locks cover linked checkouts and registrations across workspaces.
ADR 0008 records the conservative supported configuration and partial-failure rules.

Validation: a clean source copy installed from the frozen lockfile and local store
passed strict typecheck, all 59 tests (11 Git, 22 storage, 19 HTTP, 7 runtime) and
the production build. Fixtures verify dirty files/index/HEAD/FETCH_HEAD, local
branches/tags/task pins, upstream advances/prune, dangerous mappings, redirected
paths, partial remote failure, linked-checkout contention, shutdown and schema
version 3 upgrade. No normal application data or external credentials were used.

The browser scenario passed no-remote refresh, fetch/prune, a later fetch failure,
preserved last-success time and restart persistence, with no horizontal overflow
at 390px. See the [recorded browser result](fixtures/synchronization/browser-result.json).

AEW-001 remains unchanged. Tags/custom refspecs and automatic retries are outside
the supported sync policy; interrupted attempts require inspection before retry.

## Task 006 — Tasks, immutable artifacts and stage run foundation

Status: accepted through the user's merge of PR #7 into main (bf3cef4).

Implemented: schema version 5, task creation with owned repository associations,
atomic workspace boundary lock, protected API and browser task forms. Streamed
file imports use generated paths, exact byte counts/SHA-256, configurable quotas,
durable staging and recorded recovery. Downloads reject redirected paths and use
attachment disposition/nosniff. Explicit UTF-8 byte ranges preserve originals;
unsupported files and unverified images remain excluded from analysis.

Minimal internal StageRun storage persists immutable task/context/profile snapshots,
ownership, busy guards, normalized failures and lifecycle timestamps. Profile edits
preserve historical inputs; referenced profiles cannot be deleted. Startup interrupts
unfinished runs. ADR 0009 records implementation decisions and integration duties
for worktree/runtime/result tasks. There is no public AI execution endpoint yet.

Validation: a clean source copy installed from the frozen lockfile and local store
passed strict typecheck, all 73 tests (11 Git, 34 storage, 21 HTTP, 7 runtime) and
the production build. Fixtures cover schema version 4 upgrade, task/lock rollback,
cross-workspace selection, immutable snapshots, terminal transitions, duplicate
and traversal filenames, missing sources, quota violations, disconnects, injected
disk-full writes, SIGKILL during upload, staging/rename recovery and file/link
integrity. No normal application data or model invocations were used.

Chrome acceptance creates a task with two repositories, imports a log and PDF,
saves explicit text context, removes source files and downloads preserved bytes.
Production-to-development restart preserves task/artifact/context metadata and
the boundary lock. The 390px viewport has no horizontal overflow. See the
[browser result](fixtures/tasks/browser-result.json).

At acceptance, the next task was 007 — detached task worktrees and durable repository pins. Initial
repository metadata is not yet a prepared worktree. Task edit/delete, image runtime
integration and investigation execution remain deferred. AEW-001 is unchanged.

## Task 007 — Isolated task worktrees

Status: accepted through the user's merge of PR #8 into main (9e233e1).

Implemented: schema version 6, editable unresolved base refs, detached task
worktrees with immutable resolved SHAs and retained app-owned revision pins,
persisted preparation/cleanup StageRuns, protected API and readiness UI.
Only fully prepared tasks expose `CONTEXT_READY`. Investigations require ready
members and snapshot their worktree paths, pins and commits.

Synchronization and worktree operations share the same common Git directory
lock. Retries reuse verified completed members after partial failure. Cleanup
requires a canonical owned, registered, detached and clean worktree with no active
run. Modified/untracked/ignored files, hidden index flags, redirected paths,
unknown directories and mismatched pins are refused. Cleanup retains revision
pins and never force-deletes or globally prunes. Startup reconciles recorded state
without creating or deleting worktrees. ADR 0010 documents the lifecycle.

Validation: a clean source installation from the frozen lockfile passed strict
typecheck, all 88 tests (17 Git, 36 storage, 28 HTTP, 7 runtime) and production
build on Node 22.23.2 / Linux. Tests cover dirty source preservation, tasks sharing
a branch base, retained pins after cleanup and GC, partial failure/retry, ownership,
stale operations, version 5 upgrade, completed creation/removal with pending
metadata, and shutdown during preparation or startup reconciliation.

CI exposed inherited system checkout filters in its runner. The adapter now
honors an explicit `GIT_CONFIG_NOSYSTEM=1` while continuing to reject arbitrary
config injection. A synthetic system-config regression verifies isolated fixtures
and confirms that ordinary configured filters still trigger the supported-policy
error.

Chrome acceptance passed two-repository preparation, base-ref failure/correction,
dirty cleanup refusal, clean cleanup, pin retention, recreation, restart persistence
and a 390px viewport. See the [browser result](fixtures/worktrees/browser-result.json).
No normal application data or AI invocation was used.

At acceptance, the next task was 008 — the production Codex CLI runtime adapter, including the Task 000
compatibility and no-fallback requirements. Automatic submodule initialization,
custom checkout filters, task revision changes and force repair remain outside
Task 007. AEW-001 remains unchanged.

## Task 008 — Codex CLI runtime adapter

Status: accepted through the user's merge of PR #9 into main (4936d85).

Implemented: AIRuntime, production Codex CLI adapter, deterministic FakeRuntime,
verified-version/profile/tool preflight, read-only launch and owned process
supervision. CLI 0.154.0 was installed when this task resumed; its compatibility
was checked independently of the earlier 0.153.4 spike. Named profiles fail closed,
MCP configuration is checked without executing servers, and project configuration
that could override routing is rejected. Configuration metadata is fingerprinted;
credentials and raw configuration output are not read or persisted.

Schema 7 stores immutable launch metadata, monotonic bounded events and atomic
validated preview publication. Protected start/detail/cancel/SSE endpoints support
reconnect and explicit retry. The browser exposes model selection, diagnostics,
cancellation and the preliminary result. Task state remains CONTEXT_READY; Task 009
supplies the evidence-backed investigation/root-cause workflow. ADR 0011 records
this boundary and delivery of selected UTF-8 ranges through stdin.

Review added an explicit canonical `configHome` per connection (schema 8, ADR 0012).
Every diagnostic/model subprocess receives that directory as `CODEX_HOME`, with
no inherited/default fallback. Missing or redirected directories and known ambient
OpenAI credential/routing overrides fail before spawning. Old connections migrate
as unbound; one-time binding requires no AI history and no active StageRun.
Snapshots remain immutable. The UI displays the directory before launch and blocks
AI until it is saved. No additional model request was made for this review change.

The initial implementation passed a clean frozen-lockfile installation and full
check (103 tests). After the directory review, `pnpm check` passed strict typecheck,
108 tests (17 Git, 11 adapter, 38 storage, 35 HTTP, 7 spike) and production build on
Node 22.23.2 / Linux. New coverage verifies selected versus inherited homes in every
subprocess, pre-spawn rejection, schema 7 upgrade, one-time binding, SQL boundary
enforcement and preserved historical snapshots. Existing tests include
chunked UTF-8, malformed/truncated JSONL, schema failures, nonzero exits, recoverable
errors, output limits, missing/linked/changed profiles, enabled MCP, timeout,
separate-session descendant cancellation, selected artifact ranges, protected SSE,
reconnect, duplicate starts, cancellation/publication races, transaction rollback
and persisted restart interruption.

A real adapter invocation before the directory review completed through RuntimeService
using `codex`, the inherited `.codex-plus` configuration home, gpt-5.6-terra and medium.
The recorded safe configuration fingerprint matched that home rather than `.codex`;
this does not establish authentication/account identity. It identified the
synthetic cross-repository seconds/milliseconds mismatch, cited both histories and
used the selected log. Source/Git snapshots were unchanged. Local 0.154.0 negative
probes and read-only write-denial probes also passed. See the
[reviewed runtime evidence](fixtures/runtime-adapter/real-result.json).

Chrome passed the two-repository task path with a synthetic executable through the
production adapter: model selection, preview, redacted failure diagnostics,
cancellation, retry, retained prior output, event replay, production-to-development
restart and 390px layout. No model request was used by automated/browser tests.
The browser check was repeated after the directory review and also passed unbound
run blocking, one-time binding, saved-directory display/locking and run snapshot
persistence. See the [updated browser result](fixtures/runtime-adapter/browser-result.json).

GitHub CI runs the same checks on the task PR; the browser and real CLI evidence
are separate opt-in acceptance checks.
AEW-002 is mitigated by the production preflight; AEW-001 remains unchanged.
Next task: 009 — investigation workflow and validated evidence locators.

## Git handoff

- Initial artifacts: `main`, commit `d51b051`.
- Task 001: `task/001-bootstrap`, f7359a9, merged through PR #1 as aa56532.
- Task 000: `task/000-runtime-feasibility`, e37635d, merged through PR #2 as 6b9a967.
- Task 002: `task/002-local-storage`, c8ca418, merged through PR #3 as d8d4bf2.
- Task 003: `task/003-workspaces`, 4d07a77, merged through PR #4 as 8134f14.
- Task 004: `task/004-repository-registry`, 3aae7ec, merged through PR #5 as 9dadec4.
- Task 005: `task/005-repository-sync`, 137c495, merged through PR #6 as be6cc72.
- Task 006: `task/006-tasks-and-artifacts`, aec25bd, merged through PR #7 as bf3cef4.
- Task 007: `task/007-isolated-worktrees`, 7c48eff, merged through PR #8 as 9e233e1.
- Task 008: `task/008-codex-cli-runtime`, 62abf01, merged through PR #9 as 4936d85.
- Task 009: `task/009-investigation-and-evidence`, 257bb98, merged through PR #10 as af4c820.
- Task 010: `task/010-human-intervention-and-revision`, fc17306, merged through PR #11 as 18e621f.
- Task 011: `task/011-v01-hardening-and-dogfood`, 6982e84, merged through PR #12 as 9e39d3c.

## Task 009 — Investigation and evidence

Status: accepted through the user's merge of PR #10 into main (af4c820).

Implemented: the versioned workflow prompt/schema, paired investigation/root-cause
output, deterministic evidence validation, schema 9 immutable report aggregates,
atomic output/success publication and durable workflow-state projections. Protected
investigation/report/evidence APIs reuse the existing runtime cancellation and SSE.
The UI renders safe prose, timeline, root cause, unresolved questions, evidence
sources and selectable versions. Context changes mark reports stale; failures and
restart interruption preserve earlier content. Legacy previews remain unchanged.

A clean frozen-lockfile installation passed strict typecheck, 116 tests (17 Git,
11 adapter, 39 storage, 42 HTTP/service, 7 spike) and production build on Node
22.23.2 / Linux. Tests cover malformed pairs, missing references, path traversal,
foreign repositories/artifacts, unavailable/future commits, ancestor history,
invalid line/UTF-8 ranges, changed artifact hashes, symlinks/binary files, retained
pins after cleanup, cancellation, publication rollback, restart and schema 8 upgrade.

Chrome on the clean build passed two versions, prior-report preservation after
invalid evidence/failure/cancellation, retry, pinned source navigation, unsafe
HTML/link handling, configuration binding, event replay, restart and 390px layout.
No model request was used by automated/browser tests. See the
[browser result](fixtures/investigation/browser-result.json).

One real Codex CLI 0.154.0 invocation explicitly bound the selected personal
configuration directory and used gpt-5.6-terra with medium effort. It correctly
identified the seconds/milliseconds contract mismatch across two synthetic
repositories, published version 1 at ROOT_CAUSE_READY and reopened all five evidence
locators (files, commits and the selected incident log). Source/Git snapshots stayed
unchanged. Account identity is not certified by selecting a directory. Reviewed
[evidence](fixtures/investigation/real-result.json) excludes local configuration
paths, fingerprints, credentials and raw diagnostic payloads.

Persistent constraints/challenges and richer revision history are implemented in
Task 010 below. Markdown export and the three release investigations remain Task 011. AEW-001 is
unchanged. Locator validity does not prove the model's causal explanation.

See [ADR 0013](decisions/0013-investigation-pairs-and-evidence.md) for publication,
state, locator and rendering contracts.

## Task 010 — Human intervention and revision

Status: accepted through the user's merge of PR #11 into main (18e621f).

Implemented: protected challenge/constraint APIs and UI, schema 10 persistent
interventions and constraints, exact previous-report snapshots, immutable run
provenance and atomic revision publication. Constraints apply to every subsequent
run; saving/deactivation starts no AI and marks dependent results stale. Duplicate
submission IDs, obsolete context revisions, superseded targets and concurrent runs
are rejected. Failed/cancelled revisions retain the last successful report. History
shows the triggering text, attempt diagnostics and resulting versions.

Persisted dependency edges and recursive, task-scoped invalidation cover report and
root-cause results. Synthetic downstream nodes verify transitive invalidation and
cycle termination without implementing future workflow stages. Migration preserves
schema 9 snapshots and reports, with null provenance for earlier runs.

A clean frozen-lockfile installation passed strict typecheck, 125 tests (17 Git,
11 adapter, 40 storage, 50 HTTP/service, 7 spike) and production build on Node
22.23.2 / Linux. Coverage includes constraint carry-forward and limits, duplicate
submissions, ownership, rollback, failed/cancelled publication, restart interruption,
immutable history, deactivation, transitive invalidation and schema 9 upgrade.

Chrome on the clean build passed constraint saving without a run, failed and
cancelled challenges, successful revision with exact prior-report/context snapshots,
constraint deactivation, unchanged earlier versions, restart persistence and 390px
layout. The browser fixture explicitly waits for the terminal UI refresh and a new
run ID before testing retry/cancellation. See the reviewed
[browser result](fixtures/interventions/browser-result.json). Nine synthetic runtime
attempts were exercised; no real model request was made for Task 010.

ASK, ADD_CONTEXT and OVERRIDE remain reserved domain types and return an explicit
unsupported-action error. Constraints are model instructions, not filesystem
permissions. The three real release investigations and Markdown export remain
Task 011. AEW-001 is unchanged.

See [ADR 0014](decisions/0014-human-interventions-and-invalidation.md) for
submission, provenance, constraint and dependency contracts.

## Task 011 — Hardening and release acceptance

Status: accepted through the user's merge of PR #12 into main (9e39d3c).

Implemented: chosen-version Markdown export with original run/context provenance,
evidence locators and source-availability checks, escaped/redacted prose and protected
attachment responses. AEW-001 safe top-level navigation is fixed with API/frame/
mutation regression coverage. Private package and health versions are 0.1.0. The
Linux source-build demo, backup/restore constraints, release rubric and three generated
histories are documented; no installer, registry publication or release tag is created.

A clean offline frozen-lockfile installation passed strict typecheck, 130 tests
(17 Git, 11 adapter, 40 storage, 52 HTTP/service, 10 fixture/spike) and production
build on Node 22.23.2 / Linux. New tests cover export ownership, headers, chosen
versions, provenance, redaction/escaping, unavailable sources, protected navigation,
and executable reproduction of all three known historical defects. Earlier recovery,
cancellation, rollback and boundary tests remain the release regression gate.

Chrome on the clean build passed the full workspace/task/revision path, actual
Markdown downloads for v1 and a challenged v3, escaped unsafe prose, retained history,
restart and 390px layout. Nine synthetic runtime attempts used no real model calls.

Three real acceptance cases completed through production services with CLI 0.154.0,
the explicitly selected personal configuration directory, gpt-5.6-terra and medium:

- Single repository: correctly identified premature price rounding and excluded a
  later documentation change.
- Two repositories: identified the producer's milliseconds-to-seconds change and
  unchanged consumer's millisecond interpretation.
- Human revision: v1 separated a real tenant-isolation defect from unverified incident
  causality; after new log context, a persistent constraint and challenge, v2 explained
  the observed cross-tenant cache hit and resolved the earlier uncertainty.

These were four successful real model invocations. All 25 published evidence locators
reopened, source hashes and checkout state stayed unchanged, and report persistence
and SQLite integrity/foreign-key checks passed. The first launch configuration attempt
failed at executable validation before a model call; no silent fallback or automatic
paid retry was used. Quality review was performed by the implementation agent against
known history; user acceptance remains separate. See the [reviewed reports and results](fixtures/release/README.md).

Limitations: Linux and the two supported CLI versions only; trusted local repositories
and CLI configuration; no verified account identity or exact outbound audit; export
redaction is not complete secret detection. Backup/restore requires external sources
and the same canonical paths. No automatic session resume, implementation stages or
reserved ASK/ADD_CONTEXT/OVERRIDE actions. AEW-002 remains mitigated by preflight.

See [release acceptance](release-acceptance.md), [Linux demo](linux-demo.md),
[report export](report-export.md) and [ADR 0015](decisions/0015-report-export-and-release-acceptance.md).

## v0.1 documentation follow-up

Status: locally verified, awaiting PR review and merge, 2026-09-11.
Branch: `docs/v01-readme-and-user-guide`, based on `9e39d3c`.

The README now describes implemented capabilities and prioritizes a production
quick start. A separate user guide covers exact UI controls, expected outcomes,
synthetic examples, revision, export, recovery and troubleshooting. START_HERE and
Linux operations link to that guide; current feature references distinguish legacy
previews from full reports and remove obsolete next-iteration claims. API session
mechanics moved from the README into a dedicated reference. Historical acceptance
artifacts remain unchanged. AEW-003 records the task-state display issue separately;
this documentation update changes no application behavior.

Verification: the documented `pnpm build` passed on Node 22.23.2; all three
release-fixture behavior tests passed; 178 local links and anchors across 60
Markdown documents resolved. UI labels and workflow assertions were checked against
the current forms, runtime and storage code. The production Chrome scenario
`AEW_SMOKE_RELEASE=1 node scripts/workspace-smoke.mjs` passed setup, context saving,
worktree preparation, report/evidence review, constraint/challenge, failure/cancel/
retry, restart, historical Markdown downloads and the 390px layout. It used nine
synthetic runtime attempts and no real model calls. Historical release evidence
was not regenerated or rewritten.
