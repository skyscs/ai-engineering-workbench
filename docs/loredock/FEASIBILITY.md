# LoreDock L0 feasibility record

Date: 2026-09-28. Scope: [Task 014](../../tasks/014-loredock-scope-and-fixtures.md).
This records a synthetic corpus and bounded mechanical experiments. LoreDock ingestion,
answer generation and UI are not implemented. Workbench behavior and user data are
unchanged. No real model request or account/configuration-secret access was used.

## Measured results

The [reproducible probe](../../scripts/loredock-feasibility.mjs) and
[recorded JSON](../../fixtures/loredock/feasibility-result.json) establish:

| Check | Observed result | What it does not establish |
| --- | --- | --- |
| Runtime baseline | Node 22.23.2; SQLite 3.51.3; selected installed CLI reports 0.158.0. | Account identity, CLI compatibility or permission boundary. |
| SQLite full-text search | FTS5 indexed 18 fixture files; the quoted local topic query returned the expected three files. | Question retrieval quality or 20-repository scale. |
| Corpus | Three deterministic commits, 20 questions and ten routing cases; exact hashes/ranges resolve. | Co-deployment or correctness of real source adapters. |
| Structured evidence | Issued IDs accepted; invented IDs, malformed structures and extra action fields rejected. | Semantic truth; a false statement with valid IDs can pass this validator. |
| SQL checkpoint experiment | Unique submission constraint rejects duplicates; completed output survives close/reopen; running attempt becomes interrupted. | A production scheduler, race handling or exactly-once external execution. |
| Process cancellation | Existing AI process helper stopped a synthetic Node child on abort. | Cancellation behavior of the newly installed CLI or provider billing. |
| Source state | Generated repositories stayed clean before/after the probe. | A sandbox preventing all source writes or outside reads. |
| Source instructions | Adversarial text is copied/indexed as data; no instruction is executed. | A real model's resistance to prompt injection. |

Focused tests also verify the shared local event contract, preserved README conflict,
dynamic override sites, excluded binary/symlink/policy canaries, oracle separation and
reproducible revision/span baselines. The full `pnpm check` passed strict typechecking,
145 tests (17 Git, 14 AI adapter, 43 storage, 57 HTTP/service and 14 script tests) and
production builds. Subprocess checks required execution outside the development
sandbox because it rejected child Git execution with `EPERM`; this is not evidence of
the proposed LoreDock runtime boundary.

## Runtime blockers and qualification work

The current adapter allowlist in `packages/ai/src/preflight.ts` contains 0.153.4 and
0.154.0. The installed 0.158.0 is unqualified. No allowlist, application connection or
installed CLI was changed. A separate local `codex sandbox linux --help` diagnostic
failed under the development sandbox with an app-server socket-directory constraint;
an approved outside-sandbox retry exited 101 with `Failed to execvp linux`. These
results do not demonstrate a functioning sandbox, supported flags or canary denial.

The [official developer command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
documents a sandbox helper. Documentation is background evidence, not proof that this
specific installation behaves as required. Diagnose the local discrepancy and verify
actual capabilities before selecting invocation flags or expanding supported versions.

Outside-input read isolation, source-write isolation, tool/network restrictions and
real-model source-instruction handling remain **unresolved**. No credentials or corporate
source were supplied to a model to investigate them. L1's local catalog can proceed
without this dependency; L2 real-model execution is gated by synthetic qualification
in [Task 016](../../tasks/016-loredock-cited-answer.md). Keep model execution disabled if
the gate cannot be met. Do not downgrade the boundary to a prompt convention.

## Quality and next checkpoint

No question or routing model score exists. Zero model calls were made; provider usage
is `null` because it was not measured, rather than an invented token/cost report.
The human-authored oracle is a development acceptance set, not proof of generalization.
Before a real pilot, add owner-reviewed cases from permitted representative sources
and keep them separate from prompt tuning. Actual Java frameworks, Kafka wrappers,
Mongo access conventions and Dojo variants remain unknown.

The next concrete slice is [Task 015](../../tasks/015-loredock-source-catalog.md): one
project, three local sources, immutable indexing, visible coverage and searchable exact
evidence, with no model. [Task 016](../../tasks/016-loredock-cited-answer.md) then delivers
one bounded cited-answer workflow plus a separately budgeted corpus evaluation after
runtime qualification. Full relationship extraction and automatic Workbench routing
remain later milestones.
