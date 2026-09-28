# ADR 0018 — LoreDock foundation and runtime qualification

Date: 2026-09-28
Status: accepted for Task 014; runtime qualification remains open.

## Context

Workbench knows explicitly selected task repositories. The owner needs persistent
context across approximately 20 repositories before an investigation can select its
scope. The confirmed technologies are Java, JS/TS, Vue, Dojo, Kafka and MongoDB;
documentation is mainly README files. Frameworks and deployment conventions are unknown.

The [roadmap](../loredock/PLAN.md) puts this foundation before further Workbench stages.
Task 014 supplies reproducible inputs and acceptance criteria, not a production service.

## Decision

Keep LoreDock in this repository, with separate application entry points, a separate
data directory and SQLite schema/migrations. Workbench remains independently runnable.
Do not add LoreDock tables to Workbench's database or translate builds into Task/StageRun
records. Source snapshots initially have separate ownership and object stores; existing
in-process repository locks cannot coordinate two applications.

Use immutable committed Git objects and a source revision vector. A vector is not a
deployment manifest. Index bounded UTF-8 content with SQLite FTS5; represent typed
relations in ordinary tables. Introduce embeddings only if evaluated retrieval gaps
justify their operational cost. Link claims to application-issued evidence spans;
locators, semantic support, freshness and human review are distinct checks.

First implement README sections, Git identity, package/Maven metadata and explicitly
supported source constructs. The synthetic fixture uses Java 17 Maven metadata,
application-specific Java transport interfaces, Vue script-setup/TS and Dojo AMD.
These are fixture assumptions, not claims about the owner's repositories. Kafka and
MongoDB links require wrapper/config evidence; matching names alone are candidates.

Reuse only proven infrastructure seams:

| Existing component | Decision |
| --- | --- |
| Git object reading and path/regular-file validation | Reuse after an ownership/concurrency audit; keep LoreDock snapshots separate. |
| AI process supervision and JSONL parsing | Candidate for narrow reuse; the process helper is exercised by the L0 probe. |
| `AIRunRequest.contextManifest` | Task-specific `RunInputSnapshot`; define a small LoreDock request boundary in L2 rather than inventing a Workbench task. |
| Runtime preflight/configuration binding | Preserve explicit executable/configuration selection and fail-closed behavior; qualify the actual CLI before reuse. |
| Workbench storage, Task/StageRun state machine and routes | Do not reuse as a knowledge-build framework. |
| Web styles and small presentation components | Optional later reuse; no shared application state or speculative design-system project. |

## Runtime gate

The local no-model probe observed Node 22.23.2, SQLite 3.51.3 with FTS5 and Codex CLI
0.158.0. Existing runtime preflight supports only 0.153.4 and 0.154.0. A version string
does not establish authentication identity, CLI capability or safe execution. Do not
extend the allowlist without qualification or silently use another account/runtime.

Neither an input copy nor read-only write policy proves an outside-root read boundary.
Before an L2 real-model run, qualify the explicitly selected installation using
synthetic inside/outside read and write canaries, ancestor configuration, symlinks,
source instructions, available tools, subprocesses and network behavior. Document
what is permitted for model transport separately from source-controlled network access.
If the runtime cannot enforce the intended scope, constrain it with a separately
verified execution boundary or keep model execution disabled. Never claim that prompt
instructions implement filesystem permissions. Corporate sources remain outside the
pilot until the selected connection and boundary pass this gate.

## Consequences

L1 can proceed without a model or corporate access. L2 depends on runtime qualification
and must show a useful, bounded, cited answer before broad graph extraction. L0 measured
mechanical feasibility only; the 20-question and 10-incident quality baselines have no
model scores yet. See [feasibility evidence](../loredock/FEASIBILITY.md), the
[proposed contracts](../loredock/CONTRACTS.md), [Task 015](../../tasks/015-loredock-source-catalog.md)
and [Task 016](../../tasks/016-loredock-cited-answer.md).
