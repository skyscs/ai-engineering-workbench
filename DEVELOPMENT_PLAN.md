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
Next: compact the related-source reading UI without changing selection or evidence.
Preserve all failed evaluations;
independent/private-pilot acceptance still precedes the bridge.
Source recall, agent scoring and merging do not establish L5 readiness.
Broader synthesis, adapters, semantic/AI refresh and scale acceptance remain separate.
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
