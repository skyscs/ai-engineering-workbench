# Task 014 — LoreDock scope, evaluation corpus and feasibility

Status: implemented and locally verified on 2026-09-28; checkpoint review pending.
Runtime read/write isolation is explicitly unresolved and blocks L2 real-model runs,
not this task's recorded-boundary acceptance. See [the roadmap](../docs/loredock/PLAN.md).

## Objective

Make the first source-to-knowledge-to-cited-answer slice concrete using the confirmed
Java/JavaScript/TypeScript, Vue/Dojo, Kafka and MongoDB stack, with README-led documentation.
Preserve the working Workbench application, data and regression suite.

## Deliverables

1. Record a baseline and reuse ADR: separate LoreDock data ownership and entry points,
   narrow Git/runtime reuse, source-read boundaries, and the reason not to reuse task
   storage/orchestration as a knowledge-build framework. Record actual versions and
   capability evidence; do not add unverified CLI flags or a direct provider dependency.
2. Define the first adapters. Inspect explicitly supplied build manifests/module
   conventions; do not infer a Java framework, Kafka wrapper or Dojo generation from
   the stack name alone. Missing specifics are explicit assumptions in synthetic fixtures.
3. Create a small reproducible synthetic system: Vue/TS client, Java API publishing a
   Kafka message, and Java worker consuming it and accessing MongoDB. Include a Dojo
   module sample and README/config evidence for both known and ambiguous links.
   It must be readable statically; no broker, database, dependency installation or
   execution of project commands is required to ingest it. Keep all fixture prose English.
4. Write 20 evaluation questions before analysis. Record acceptable answers, exact source
   locators, required abstentions, local/prod distinctions and known contradictions.
   Add 10 incident-routing cases with required repository sets, useful candidate bounds
   and expected gaps; no results or quality scores are claimed until measured.
5. Define a source manifest and proposed minimal entities: project, source revisions,
   spans, build, claims/relations and work units. Include policy, revision vector,
   extraction coverage, unsupported material and deployment-coherence status.
6. Run a narrowly bounded synthetic feasibility probe only through an explicitly selected
   permitted connection when authorized for implementation. Check structured evidence IDs,
   scope/write restrictions, source-instruction handling, process cancellation and restart
   bookkeeping. Verify FTS availability in the chosen Node/SQLite runtime. Record unknown
   usage as unknown and ambiguous external completion as interrupted.
7. Produce the precise L1/L2 task split, provisional local budgets, the Context Pack outline
   and a list of any runtime boundary blockers. Do not scaffold all later milestones.

## Acceptance

- The corpus and expected answers are reproducible without corporate inputs or credentials.
- A reviewer can follow one UI → Java API → Kafka → Java worker → MongoDB flow from the
  fixture evidence and identify the deliberately unresolved alternatives.
- Every expected citation has a stable revision and range; no model answer defines its
  own correctness oracle. Include absent rationale, unknown external behavior, a wrong
  README, dynamic topic configuration and misleading source instructions.
- The runtime boundary is demonstrated with synthetic canaries or explicitly recorded as
  unresolved. “Read-only” and “copied input directory” alone cannot satisfy this criterion.
- Proposed jobs specify duplicate request handling, pause versus cancel, explicit resume,
  completed-unit reuse and recovery after uncertain external execution.
- The planned first implementation can persist sources and produce one useful cited answer
  without implementing an entire knowledge platform or modifying Workbench behavior.
- All current Workbench tests relevant to any extracted shared utility continue to pass.
  A docs/fixture-only change does not require application migrations or user-data access.

## Non-goals

No production LoreDock UI or full build engine in this task; no automatic repository
routing in Workbench; no corporate crawling; no embeddings, graph database, connectors,
advanced personalized onboarding, execution of runbooks or code changes in analyzed repos.
No new public repository, license choice, automatic model fallback or unbounded paid run.

## Next checkpoint

Review the measured fixture/probe outcome, then implement L1–L2. The broader roadmap is
not an instruction to bypass this checkpoint or treat planned capabilities as delivered.

## Outcome

- [ADR 0018](../docs/decisions/0018-loredock-foundation-and-runtime-gate.md) records separate
  ownership, narrow reuse and the installed CLI qualification gate.
- [The corpus](../fixtures/loredock/README.md) provides three reproducible Git repositories,
  18 admitted files, nine excluded canaries, 20 source-backed questions and ten routing
  incidents. Expected answers are outside source roots and no model defined the oracle.
- [Contracts](../docs/loredock/CONTRACTS.md) specify manifests, evidence, coverage, work-unit
  recovery, provisional budgets and the later Context Pack boundary.
- [Feasibility](../docs/loredock/FEASIBILITY.md) records FTS5, structured-ID rejection,
  SQL checkpoint recovery and process cancellation. CLI 0.158.0 is outside the existing
  supported set. Read/write isolation and real-model instruction resistance are unresolved.
- `pnpm check` passed 145 tests, strict typechecks and production builds. No application
  source, migration, user data, selected connection or CLI version was changed. Zero
  real model requests were made; model quality and provider usage are not measured.
- [Task 015](015-loredock-source-catalog.md) and [Task 016](016-loredock-cited-answer.md)
  define the next bounded implementation checkpoints. They have not started.
