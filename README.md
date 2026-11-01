# AI Engineering Workbench

A local application for investigating software defects across Git repositories,
reviewing evidence and revising AI conclusions with human feedback.

The repository also contains **LoreDock**, the new local source catalog that will
provide system context for future Workbench investigations. Its first implementation
connects up to twenty local Git repositories through one reviewed path list, indexes
committed text with equal source budgets and opens exact
source citations. **Project overview** shows original README context or an explicit gap for
each repository; **Guide me** provides a short route through source context, interfaces,
one partial flow and coverage. A declaration map shows scoped routes, contracts and
configuration comparisons. Two bounded static flow outlines connect supported Vue/TypeScript and
Dojo client code to Java interface calls, with candidate hops and unresolved wiring.
**HTTP header bindings** compares literal client names with declared handler bindings,
including candidate links outside those outlines, and opens the original evidence.
Engineers can dispute/clarify those links, record environment scope and retain review
history; affected outlines are marked for review. **Update knowledge** reuses validated
unchanged text and shows committed file changes while retaining earlier indexes.
After an update, compare earlier engineer corrections with the new evidence and explicitly
reapply eligible notes; each new review retains its exact origin and separate history.
Indexing, source search and map review
need no Codex configuration or model calls.

**Where should I look?** suggests a small set of repositories for a problem or source
clue, with original evidence and inspectable **Other matches**. It works in the default
model-free mode. The shortlist needs review and leaves the broader answer context intact.

After the shared installation/build steps below, run `pnpm loredock` and open
**http://127.0.0.1:4244**. Follow the [LoreDock guide](docs/loredock/USER_GUIDE.md)
for indexing, project orientation/Guide me, the declaration map, static flow outlines, engineer corrections, search, updates, coverage,
storage and the synthetic demo.
To explore without supplying repositories, run **`pnpm loredock:demo`** after dependency
installation. It builds and prepares an isolated twenty-repository example with model
calls disabled. Open the printed URL after **Demo ready**; Ctrl+C stops the server and
retains the example. See [demo usage and reopening](docs/loredock/USER_GUIDE.md#try-the-synthetic-system).
For storage diagnosis, `pnpm loredock:storage --data-dir /absolute/loredock-data` reports
aggregate SQLite, payload and history-dependency sizes without modifying the catalog.
See [storage and backup](docs/loredock/USER_GUIDE.md#local-storage-and-backup).
The [answer-stage checkpoint](docs/loredock/ANSWER_FOUNDATION.md) records internal
retrieval and real-model evaluation results. An **opt-in cited-answer pilot** is now
available with `LOREDOCK_ANSWERS=1 pnpm loredock`; follow the guide's
[answer setup](docs/loredock/USER_GUIDE.md#ask-a-question-opt-in-pilot). The bounded answer
slice is [owner-accepted](docs/loredock/L2_ACCEPTANCE.md). Default startup remains
model-free; cited answers use an explicitly selected connection.
Answer previews show how many indexed repositories supply passages and can use explicit
repository names as bounded context hints. Matching engineer disputes/clarifications are
included separately from source
evidence. Saved answers retain those exact notes and show when engineer review changes.
**Interface comparisons in this context** separately shows bounded static header checks
whose complete original support is already among the retrieved passages. The reviewed
comparisons are included in new answer inputs and preserved in answer history.
Development now has a [heterogeneous twenty-repository fixture](fixtures/loredock-scale/README.md)
and a [capacity baseline](docs/loredock/SCALE_READINESS.md). A separate
[larger synthetic measurement](docs/fixtures/loredock-capacity/README.md) indexes 3,679
files across twenty sources and reuses all text files on refresh. Required original
context is retained, but candidate scope and the 100-file code projection remain limited.
[Expanded real-model evaluation](docs/fixtures/loredock-scale-answer-quality/README.md)
scores 18/20 under agent review but still fails the required-completeness gate;
private-project and full-system semantic readiness remain unverified.
The [completeness investigation](docs/loredock/ANSWER_COMPLETENESS.md) separates direct
answers from wider context. [Improved literal-reference retrieval](docs/fixtures/loredock-reference-retrieval/README.md)
now supplies the recorded reference basis for all twenty-four new wordings, preserving
both earlier 20/20 retrieval baselines within the same limits. The separate
[prospective answer run](docs/fixtures/loredock-prospective-answers/README.md) passes 23/24
cases under agent review, but one extra claim invents tenant-header propagation between
incompatible declarations. The map now exposes literal header comparisons as review clues;
new prompt v9 also supplies fully supported comparisons as derived clues. Saved answers
remain unchanged. The [single v9 qualification run](docs/fixtures/loredock-interface-answers/README.md)
passes 8/14 under agent review and fails its gate: missing specific qualifications,
repository-scope overstatements and incomplete per-claim citations remain recorded.
The [new prospective qualification design](fixtures/loredock-interfaces/README.md)
freezes fourteen fresh freight-system questions before model outputs; all required
original references are available, with the derived-comparison limit disclosed.
The [incident-context baseline](docs/fixtures/loredock-incident-context/README.md) finds
all required source owners but returns 11–17 repositories per incident. The separate
[candidate preview](docs/fixtures/loredock-source-candidates/README.md) narrows the primary
list to 1–4 in that diagnostic, retaining 18/22 required repository occurrences; four
remain in Other matches. Optional [related-source clues](docs/fixtures/loredock-candidate-links/README.md)
recover 21/22 when combined with the primary list, but widen scope to 1–8 repositories.
They stay in a separate collapsed reading section. Autonomous routing and the Workbench bridge remain planned,
with independent/private-pilot acceptance pending.
An [offline precision comparison](docs/fixtures/loredock-link-precision/README.md) reduces
those lists but loses one useful configuration clue; it has not replaced production behavior.
[Dojo object-export support](docs/fixtures/loredock-dojo-exports/README.md) subsequently
adds the missing stock caller/route clue under code adapter v3. The small-corpus default
page retains 22/22 critical occurrences, while five candidate scopes remain too broad.
This remains a reading aid.
Related sources use [compact expandable cards](docs/fixtures/loredock-compact-related-sources/README.md):
scan the relationship subject first, then open its complete original evidence and limits.
Use **Next repositories** and **Previous repositories** to inspect remaining eligible
sources in pages of four, retaining the original default order and citations.
The separate [full code-inventory experiment](docs/fixtures/loredock-code-inventory/README.md)
examines all 3,621 synthetic code files with reproducible facts and explicit syntax gaps.
The [durable inventory foundation](docs/decisions/0040-loredock-durable-code-inventory.md)
persists bounded per-file facts with validated restart/resume and source purge.
New indexes now start local code analysis automatically. **Code coverage** shows progress
and syntax gaps; expand its file pages to inspect facts and original sources. Existing
indexes can be analyzed explicitly. In **Explore the sources**, an exact name such as
`Orders.accept` also searches the compatible code inventory and opens its original lines.
Symbol coverage and limits are visible; original text search remains independently available.
Packaged Java methods also accept short names such as `StockProjection.accept`; results
retain full qualified names, original ranges and every admitted ambiguous match.
A separate [larger lookup qualification](docs/fixtures/loredock-symbol-qualification/README.md)
checks all 3,621 retained synthetic code files per query, with original verification and
recorded local timings. Broader framework and semantic acceptance remain open.

## What v0.1 does

Workbench runs a browser UI and a local daemon. You describe a problem, select
repositories and optional text files, and start an investigation in one action.
Workbench saves your draft, checks the selected setup and prepares isolated
worktrees automatically. A Codex
CLI invocation investigates committed source and history and produces a versioned
investigation/root-cause report. You can inspect its evidence, save persistent
constraints, challenge the conclusion and export a chosen version to Markdown.

Earlier reports survive revisions, failures and cancellation. The application
preserves your normal checkout's working files and uses pinned commits for tasks.
Model selection is manual: choose a workspace model profile or the selected CLI
connection's defaults for each run.

The v0.1 implementation was accepted through PR #12. See the [release acceptance](docs/release-acceptance.md)
and [reviewed example reports](docs/fixtures/release/README.md) for verified behavior.

## Requirements

- **Linux:** the verified runtime platform. macOS/Windows path conventions are
  tested, but their complete runtimes are not accepted.
- **Node.js 22.23.2:** pinned in `.nvmrc` and `.node-version`; minimum 22.13.0.
- **pnpm 10.15.0** and **system Git**. Git authentication must already work for
  repositories you intend to clone or fetch.
- **Codex CLI for Workbench AI runs:** the adapter accepts versions 0.153.4 and 0.154.0.
  Use an existing authenticated configuration and explicitly select its directory
  in the application. Other CLI versions are rejected until compatibility is verified.
  See [runtime requirements](docs/codex-runtime.md#supported-configuration).
  The separate LoreDock answer pilot qualifies CLI 0.166.0; see its
  [setup guide](docs/loredock/USER_GUIDE.md#ask-a-question-opt-in-pilot).

Installing, starting the UI, preparing worktrees and running ordinary tests make
no model requests. **Investigate**, **Run investigation again** and **Revise report** invoke the
configured CLI and can consume the selected account's allowance.

## Quick start

With nvm installed, run:

```bash
git clone git@github.com:skyscs/ai-engineering-workbench.git
cd ai-engineering-workbench
nvm install
nvm use
```

Ensure pnpm 10.15.0 is installed for the selected Node environment, then:

```bash
pnpm install --frozen-lockfile
pnpm build
AEW_OPEN_BROWSER=0 pnpm start
```

Open **http://127.0.0.1:4242**. Keep the terminal running; stop with Ctrl+C.
Omit `AEW_OPEN_BROWSER=0` to allow automatic browser opening. Use the exact address;
the daemon binds loopback and reports an error if port 4242 is occupied. The
experimental SQLite warning on the pinned Node release is expected.

This is a source-build distribution. There is no installer, background service,
npm publication or network-facing mode. See [Linux installation and operations](docs/linux-demo.md)
for data directories, isolated demos, backup and upgrades.

## Your first investigation

1. Enter a local **Repository path or Git URL** and describe **What is going wrong?**
2. Optionally **Add files** or drop UTF-8 logs, text or Markdown into the composer.
   Saved files are included in full automatically; use **Exclude** to keep a file
   without supplying it to the model.
3. Choose the intended **Codex setup** once. Select an existing project or its
   configuration directory; executable/profile overrides are under **Advanced setup**.
4. Click **Investigate**. Workbench checks the setup, resolves source, saves context,
   prepares isolated code and starts analysis. You can close the page and return.
5. Review **What we found**, open evidence and use **Revise report** to reconsider
   the conclusion. **Report version** and **Export Markdown** preserve access to
   earlier results.

Drafts and files are saved locally before launch. **Copy to a new investigation**
reuses composer inputs with newly resolved code; running the same investigation
again retains its pinned commits. **Advanced settings** opens the original detailed
controls, including multiple repositories, model profiles and explicit text ranges.

The [user guide](docs/user-guide.md) explains the primary workflow, recovery,
storage locations and the optional advanced walkthrough.

## Limits and data handling

- Workbench stores state, imported files and reports locally. Codex can transmit
  exposed source and supplied context to its configured provider; Workbench has
  no exact outbound-payload audit or verified account-identity claim.
- Explicit configuration-directory selection separates workspace launch settings.
  Creating the first task locks those settings. An executable name alone does
  not select a personal or corporate account.
- Investigations use committed revisions. Uncommitted changes are excluded;
  fetching or preparing again does not move an existing task's pin.
- The composer accepts up to 32 nonempty UTF-8 text/Markdown/log files. Description
  and all saved files share a 1 MiB budget, or a lower configured storage limit.
  Advanced settings supports explicit text ranges and larger original artifacts.
  Images, PDFs and videos are not analyzed in v0.1.
- Only one AI invocation runs per daemon. Cancellation and retry are explicit;
  failures preserve the last successful report. Interrupted runs do not resume
  paid CLI sessions automatically.
- CHALLENGE and CONSTRAINT are available. ASK, ADD_CONTEXT and OVERRIDE, automatic
  model selection, code implementation, automated fix verification, integrations
  and additional runtime providers are deferred. Task edit/delete and repository
  removal are not exposed in the current UI.
- Export omits configuration paths and raw diagnostics and redacts known patterns;
  it is not a complete secret scanner. Review reports before sharing.

Use trusted repositories and CLI configuration. See [security boundaries](SECURITY.md)
and [known issues](docs/open-issues.md). Back up the complete stopped data directory
and external registered repositories; Markdown export is not a backup.

## Documentation and development

| Need | Document |
| --- | --- |
| Learn the application and troubleshoot a run | [User guide](docs/user-guide.md) |
| Install, operate, back up or upgrade | [Linux guide](docs/linux-demo.md) |
| Configure a connection or model profile | [Workspace settings](docs/workspace-settings.md) |
| Register, fetch or prepare repositories | [Registry](docs/repository-registry.md), [synchronization](docs/repository-synchronization.md), [worktrees](docs/task-worktrees.md) |
| Understand artifacts, reports and human revision | [Artifacts](docs/tasks-and-artifacts.md), [investigation](docs/investigation.md), [interventions](docs/interventions.md), [export](docs/report-export.md) |
| Integrate with the local HTTP API | [Session and transport](docs/local-api.md), then feature API tables |
| Inspect validation and development history | [Release acceptance](docs/release-acceptance.md), [development status](docs/development-status.md) |
| Use the LoreDock source catalog | [LoreDock guide](docs/loredock/USER_GUIDE.md), [browser acceptance](docs/fixtures/loredock-catalog/README.md) — local indexing and cited source search implemented |
| Review the next development direction | [LoreDock-first roadmap](docs/loredock/PLAN.md), [answer pilot](docs/loredock/ANSWER_FOUNDATION.md), [draft review](docs/loredock/REVIEW.md) — basic README orientation/reading guide, declaration clues, partial flows, engineer corrections, validated file refresh and explicit review reapplication are available; broader synthesis, semantic/AI refresh, scale and Workbench integration remain planned |
| Inspect the earlier interaction prototype | [Interaction prototype](prototypes/investigation/README.md), [UX plan](docs/ux-simplification-plan.md) — sample data, no model calls |

For development, `pnpm dev` rebuilds internal packages and starts the UI on
`http://127.0.0.1:5173` with the daemon on port 4242. Restart it after internal
package changes. Vite also requires its exact port to be free.

```bash
pnpm check
```

This runs strict typechecks, behavioral tests and production builds. CI runs the
same checks from a frozen-lockfile installation, without model requests. Optional
browser and real acceptance procedures are described in the release guide.

The monorepo contains Workbench's `apps/web` and `apps/daemon`, LoreDock's
`apps/loredock-web` and `apps/loredock`, and packages for core types,
storage, Git, AI runtime, workflow and shared transport. Read [AGENTS.md](AGENTS.md),
[PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md)
and [WORKFLOW.md](WORKFLOW.md) before changes. Tasks 000–011 in
[the original development plan](DEVELOPMENT_PLAN.md) document the completed v0.1
sequence; they are not onboarding steps to execute again. Keep new work bounded
and all project artifacts in English.
