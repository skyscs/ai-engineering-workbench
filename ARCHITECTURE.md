# Architecture — v0.1

This document describes Workbench. LoreDock now has separate daemon/web entry points,
port 4244, its own data directory and SQLite schema. Its committed-text catalog is
specified in [ADR 0019](docs/decisions/0019-loredock-local-catalog.md); it does not
reuse Workbench task storage. The opt-in answer workflow and independent text runtime
are specified in [ADR 0020](docs/decisions/0020-loredock-bounded-answers.md). See the
[LoreDock guide](docs/loredock/USER_GUIDE.md) for the implemented source/evidence boundary.
The model-free declaration projection and its bounds are described in
[ADR 0022](docs/decisions/0022-loredock-declaration-map.md).
The separate bounded code/flow projection, parser profiles and candidate-hop semantics
are described in [ADR 0023](docs/decisions/0023-loredock-static-code-flows.md).
Schema 4 adds a separate human correction overlay and affected-flow review state;
see [ADR 0024](docs/decisions/0024-loredock-engineer-corrections.md). Source projection
contracts and Workbench storage remain unchanged.
Schema 5 adds a fixed update baseline, validated extraction reuse and bounded inventory
comparison; see [ADR 0025](docs/decisions/0025-loredock-incremental-refresh.md).
Schema 6 records explicit correction reapplication with immutable original-version
lineage; see [ADR 0026](docs/decisions/0026-loredock-correction-reconciliation.md).
The model-free README orientation and reading guide reuse saved original evidence
without another schema; see [ADR 0027](docs/decisions/0027-loredock-project-orientation.md).
Orientation v3 / adapter v4 also exposes bounded README sections and same-repository
linked-document reading while preserving root-document priority and source budgets;
see [ADR 0047](docs/decisions/0047-loredock-readme-sections.md) and
[ADR 0048](docs/decisions/0048-loredock-linked-reading.md).
Answer contexts now freeze bounded matching engineer notes and their source dependencies;
see [ADR 0028](docs/decisions/0028-loredock-answer-review-context.md). Source citations,
human review and saved-answer freshness remain separate.
Schema 7 adds atomic bulk-registration receipts and persisted source shares for new
indexes; twenty-source baseline orientation is described in
[ADR 0029](docs/decisions/0029-loredock-bulk-source-baseline.md).
LoreDock schema 8 adds a bounded disposable per-file code inventory with original
validation, parser fingerprints, interruption/resume and two-generation retention.
Task 045 provides the service; Task 046 connects new publications to automatic local
analysis, protected controls and code-coverage browsing. Task 047 adds bounded exact-symbol
lookup over the matching published inventory with original revalidation and a final scope
fence; existing sampled graph and answer selection remain separate. See
[ADR 0042](docs/decisions/0042-loredock-exact-symbol-search.md).
Task 049 adds exact short Java name aliases at query time under response version 2,
retaining full identities and the same saved parser facts; see
[ADR 0043](docs/decisions/0043-loredock-short-java-symbols.md).
The source-build synthetic demo launcher prepares an owned twenty-source catalog and
inventory, releases service/store ownership, then starts the normal compiled daemon with
isolated data and model mode off. See [ADR 0044](docs/decisions/0044-loredock-isolated-synthetic-demo.md).
The separate connected-path read service verifies saved path trees and complete binding
domains over that inventory. Protected reads return bounded paths and four-entry-point
pages with generation identity, original support and cooperative request ownership.
Task 115 connects the existing HTTP/browser consumer to actual CodePathsV2 after the
complete native resource gate. Startup, requests and shutdown share one explicit path
owner. Native topic/accounting identities are returned directly; recognized shared-budget
outcomes are translated at the protected HTTP boundary. The browser shows direct-topic
witnesses without changing static/candidate uncertainty. Existing graph/answer/review
consumers keep their adapter; saved native receipt workflows remain separate. See
[ADR 0049](docs/decisions/0049-loredock-connected-path-reads.md) and the
[native read API](docs/loredock/CODE_PATHS_API.md).
Task 116 exposes authorized native capture/history through protected POST/GET routes.
The daemon injects one NativeCaptures service sharing the same CodePathsV2 owner and
stops capture/history before paths, analysis and storage. Query-only capture selection
reuses strict path validation; history accepts only the issued content-addressed ID.
Fixed boundary errors keep private native faults generic. Saved content is returned
without rederivation, with current authority revalidated and applicability unchecked;
per-read metrics remain separate. See the [capture API](docs/loredock/NATIVE_CAPTURE_API.md).
Task 117 adds a pinned explicit browser save and a separate recorded view addressed by
a local receipt-ID link. Shared presentation renders paths and gaps; history originals
come from the authorized saved response, without current path/fact/evidence requests.
Project authority/published-index changes and refresh failures fence the view; reopening
is explicit. Saved-link navigation remains independent of inventory retention. No new
daemon/core, storage or schema change is involved. See the
[saved-path workflow](docs/loredock/SAVED_PATH_BROWSER.md).

Task 118 adds catalog-owned ID enumeration and bounded discovery on that same native
operation owner. Each page inspects at most four receipts under one actual budget,
reauthorizes every dependency/original and returns summaries only. A digest pins the
catalog, sorted ID vector and source/index epoch; final rechecks prevent mixed pages.
Policy-fenced records contribute only to unavailable counts. Other integrity/storage
failures abort the page. The browser stores one transient page and uses explicit refresh
or one-record fallback; no persistent client index is added. The native closure now has
39 modules: two extended modules and one addition, with every preexisting emitted class
member and the other 36 modules unchanged. This does not extend the earlier resource
qualification claim. See [saved-path discovery](docs/loredock/SAVED_PATH_DISCOVERY.md).

Native question-context integration is not yet a current answer dependency.
[Task 120](docs/loredock/NATIVE_QUESTION_CONTEXT_RESULT.md) passes the sealed 44-case offline
comparison with unchanged production modules. Its compact item preserves already-issued
original support, uncertainty and the existing prompt/derived limits.
[ADR 0058](docs/decisions/0058-loredock-native-question-context.md) requires an offline
complete-resolution selection/support comparison before consumer changes. Current
lexical retrieval and legacy interface validation remain intact. A future asynchronous
prepared-answer owner must pin the reviewed input and retain a trusted native witness
across inventory eviction; it cannot choose current defaults at model completion or
automatically populate user-saved history on preview.
[ADR 0059](docs/decisions/0059-loredock-prepared-question-lifecycle.md) specifies one transient
reviewed snapshot, synchronous atomic promotion to answer-owned witness storage and
versioned validation of the issued input. Task 124 implements schema 11 and witness quotas; prepared answer dispatch and public
adoption remain separate. Task 122 adds actual synchronous per-store lexical accounting and typed complete-resolution
selection within the existing shared budget/owner, preserving unselected outputs. These
[internal seams](docs/loredock/QUESTION_READ_SELECTION.md) precede prepared ownership,
HTTP/UI and model integration; see the [lifecycle](docs/loredock/PREPARED_QUESTION_LIFECYCLE.md).
Task 123 adds an internal [prepared-question owner](docs/loredock/PREPARED_QUESTION_OWNER.md):
one bounded transient snapshot, monotonic expiry, cancellation, synchronous promotion
capabilities and exact original-based witness validation after inventory eviction. It adds
no application consumer or persistence. Task 124 adds an internal
[answer-owned witness store](docs/loredock/ANSWER_WITNESS_STORAGE.md), atomic attempt/source/
witness admission, immutable byte/version binding, separate quotas and transactional source
purge/recovery. Legacy answer readers refuse unsupported prepared input. All original
parser/preparation modules stay unchanged; answer dispatch and HTTP/UI integration follow.
Explicit storage accounting and offline compaction use separate maintenance commands,
preserving logical history and normal job recovery. Compaction acquires daemon
ownership and rewrites physical SQLite pages only when free pages exist; see
[ADR 0045](docs/decisions/0045-loredock-offline-storage-maintenance.md).
Schema 9 uses original spans as external literal-search content, with a stable integer
mapping, atomic legacy migration and explicit transactional writes/purge. Question search
and parser facts are unchanged. Maintenance accepts schemas 8 through 11; storage/compaction version 3 and history
version 2 additionally report answer witness retention and ownership without text. Logical
search text remains distinct from its stored copy. See
[ADR 0046](docs/decisions/0046-loredock-external-literal-search.md).
The separate history diagnostic shares the maintenance read-only snapshot boundary and
reports bounded generation payload/dependency counts without application recovery or
deletion eligibility. See the [retention contract](docs/loredock/RETENTION_DESIGN.md).
See [ADR 0040](docs/decisions/0040-loredock-durable-code-inventory.md) and
[ADR 0041](docs/decisions/0041-loredock-code-coverage-workflow.md).
Bounded question-context sampling across twenty sources, stable selection and explicit
source representation are described in [ADR 0030](docs/decisions/0030-loredock-scale-retrieval.md).
Answer inputs can also retain bounded, separately versioned static interface comparisons
whose complete support is already retrieved. Prompt construction and full-prompt fitting
share one pure renderer; publication rechecks the derivation. See
[ADR 0035](docs/decisions/0035-loredock-answer-interface-context.md).

The model-free candidate preview ranks original passages from the existing answer context
without narrowing that context or storing an approved investigation scope. The default UI
exposes original support, other matches and uncertainty; see
[ADR 0036](docs/decisions/0036-loredock-source-candidate-preview.md).
The separate related-source projection adds bounded one-hop code/declaration clues with
both original endpoints, full support and coverage. It does not change the lexical
shortlist or answer input; symmetric comparisons retain their original sides while
sorting independently of them. See [ADR 0037](docs/decisions/0037-loredock-candidate-links.md).
Code adapter v3 adds bounded literal Dojo AMD object exports with distinct operation
ownership and conservative binding guards. Old v2 answer inputs remain readable; earlier
code corrections cannot implicitly cross adapter versions. ES named-import resolution
excludes AMD exports. See [ADR 0038](docs/decisions/0038-loredock-dojo-object-exports.md).

## Architectural style

Review baseline: ADR 0004 and DEVELOPMENT_PLAN.md refine execution, recovery and
task sequencing. These describe intended v0.1 behavior, not current scaffold capabilities.

The product is a **local-first application with a web UI**.

```text
Browser
   |
   | localhost
   v
Local daemon
   |-- Task / workflow API
   |-- Storage
   |-- Git integration
   |-- Artifact access
   |-- AI runtime adapter
   |
   +--> SQLite
   +--> Local filesystem
   +--> System git
   +--> Codex CLI
```

The browser never accesses repositories or arbitrary local files directly. The daemon owns privileged local operations.

## Technology baseline

### Web

- React
- TypeScript
- Vite

### Daemon

- Node.js 22.13+ (tested and pinned to 22.23.2)
- TypeScript
- Hono

### Persistence

- SQLite for structured state and metadata
- Built-in `node:sqlite`, isolated inside `packages/storage`; see ADR 0005
- Filesystem for repositories, worktrees, uploaded/copied artifacts, and generated reports

### Package management

- pnpm workspaces

### Git

- system `git` executable
- existing SSH agent / Git Credential Manager / credential helper
- application must not ask for repository passwords when system Git already works

### AI — first runtime

- Codex CLI subprocess
- existing Codex authentication and config are reused
- corporate proxy/model rules remain outside the Workbench when already configured in Codex

## Package boundaries

```text
apps/daemon
  HTTP transport, process lifetime, browser launch, API wiring

apps/web
  user interface only; no direct filesystem or Git access

packages/core
  entities, IDs, enums, domain invariants, dependency rules

packages/storage
  SQLite repositories, migrations, filesystem layout, artifact persistence

packages/git
  repository validation, clone, fetch, status, refs, worktree creation/removal

packages/ai
  AIRuntime abstraction, CodexCliRuntime, model profiles, event normalization

packages/workflow
  task state machine, stage runs, versioning, intervention handling, invalidation

packages/shared
  transport-safe DTOs and shared utility types
```

Dependencies should generally point inward toward `core`; `core` must not depend on UI, Hono, SQLite, Codex, or Git implementations.

## Local data layout

The root directory is resolved using platform conventions and can later be configurable.

Example on Linux:

```text
~/.local/share/ai-engineering-workbench/
  workbench.db
  .owner.db             # Dedicated SQLite ownership lock; never unlink while running
  repositories/
    <repository-id>/
  tasks/
    <task-id>/
      artifacts/
      generated/
  worktrees/
    <task-id>/
      <repository-id>/
  logs/
```

Equivalent platform application-data directories should be used on macOS and Windows.

## Repository strategy

### Registration

A repository can be:

- an existing local Git checkout; or
- cloned into the Workbench-managed repository directory.

### Synchronization

Use:

```bash
git fetch --all --prune
```

Do **not** run `git pull` automatically.

The product must not mutate the user's normal working checkout as part of synchronization.

### Task isolation

Each task creates one Git worktree per selected repository from a chosen base ref.

```text
worktrees/<task-id>/<repository-id>/
```

This makes later agent-driven implementation safer and prevents parallel tasks from contaminating each other.

For v0.1, resolve the chosen ref to a commit SHA and create detached worktrees.
Record the source SHA and retain an app-owned pin ref while results depend on it.
Worktrees isolate task checkout contents, not process permissions or credentials.
Git operations are serialized by common git-dir. Cleanup refuses dirty, unknown
or active worktrees and uses Git's worktree lifecycle rather than force deletion.

## AI runtime abstraction

```ts
interface AIRuntime {
  run(request: AIRunRequest): AsyncIterable<AIEvent>;
}
```

Conceptual request fields:

```ts
interface AIRunRequest {
  workspaceId: string;
  taskId: string;
  stageRunId: string;
  aiConnectionId: string;
  workingDirectory: string;
  contextManifest: RunContextManifest;
  instructions: string;
  modelProfileId?: string;
  outputSchemaVersion: string;
  accessMode: "read" | "write";
  signal: AbortSignal;
}
```

This is an internal conceptual interface, not a browser DTO. The manifest records
selected repository IDs, canonical read roots and commit SHAs, artifact IDs/hashes,
included/excluded context and active constraint snapshots. The adapter must make
all selected roots readable using verified CLI capabilities. A single cwd or
symlink does not by itself establish access. Reject accessMode="write" in v0.1.

Persist an immutable snapshot of requested connection/profile settings, input
manifest and prompt/schema/CLI versions before execution. Do not persist credentials.
CLI flags remain adapter-private, and raw extra arguments are not model-profile fields.

v0.1 ships only `CodexCliRuntime`.

Future runtimes may include:

- direct OpenAI Responses API;
- OpenAI-compatible corporate endpoints;
- local models;
- additional coding-agent CLIs.

The workflow package must not know how a provider authenticates.

## AI connection vs model profile

These are deliberately separate.

### AI Connection

Defines **where data is allowed to go** and how the runtime is reached.

Examples:

- Corporate Codex CLI profile
- Personal Codex CLI login

A Workspace is bound to one AI Connection in v0.1.

The connection saves the executable selector, a canonical configuration directory
(`configHome`) and optional named CLI profile. The adapter passes the saved
directory as `CODEX_HOME` to every subprocess, regardless of the daemon's inherited
home. Missing settings block AI use. Schema 8 leaves earlier connections unbound;
the narrow one-time binding exception and immutable history rules are recorded in
[ADR 0012](docs/decisions/0012-explicit-codex-configuration-home.md).

### Model Profile

Defines the requested model/execution profile for an individual stage run.

Examples:

- Corporate Terra
- Corporate Sol
- Deep Investigation
- Fast Classification

A user may override the model profile for a run only within the Workspace's AI Connection.

## Workflow result versioning

Important AI-derived artifacts are append-only versions, not mutable blobs.

Example:

```text
Investigation v1
Root Cause v1

User challenges conclusion

Investigation v2
Root Cause v2
```

Old versions remain inspectable and become superseded only after successful
replacement. Content is immutable; status is lifecycle metadata. Track freshness
separately so an active result can be stale without a successful replacement.

One v0.1 invocation returns the investigation/root-cause pair. Validate both and
publish them in one transaction; a failed revision preserves the previous pair.

## Execution and local recovery

StageRun storage is introduced in Task 006, before the runtime adapter in 008.
Allow one active AI run per task and one AI process per daemon; reject additional
starts with busy. Persist events for bounded SSE replay. The daemon owns process
lifetime; browser disconnection does not cancel a run. On restart, mark interrupted
runs failed with an interruption reason and offer explicit retry as a new run.

SQLite/file operations use durable operation state, staging and reconciliation,
not a claimed cross-resource transaction. Each feature supplies recovery when
introduced; Task 011 verifies those guarantees. See ADR 0004 for lifecycle rules.

## Dependency and invalidation model

Stage results record the upstream versions they depend on.

When an upstream result is revised, downstream results become stale/invalid rather than silently remaining “valid.”

Future example:

```text
Root Cause v1
  -> Plan v1
  -> Implementation v1

Root Cause v2 created
  => Plan v1 STALE
  => Implementation v1 STALE
```

The dependency mechanism should exist in the v0.1 domain model even before implementation stages are added.

## Deterministic vs AI responsibilities

### Deterministic application code

- state transitions
- persistence
- filesystem paths
- repository synchronization
- worktree lifecycle
- credential boundaries
- policy enforcement
- schema validation
- version/invalidation bookkeeping

### AI responsibilities

- interpreting task/artifact content
- finding likely relevant code
- reconstructing history
- forming hypotheses
- explaining evidence
- revising conclusions after human feedback

If a result can be computed exactly, compute it in code rather than asking a model.

Task 009 implements this lifecycle with one immutable report-pair aggregate and
state derived from durable runs/publications. Evidence resolves selected Git objects
at the retained pin or an available ancestor, and immutable selected artifact ranges.
See [ADR 0013](docs/decisions/0013-investigation-pairs-and-evidence.md).

Task 010 stores intervention/run provenance and dependency edges. Context changes
invalidate dependent results transitively in the same SQLite transaction. Previous
report links are revision provenance, while freshness follows current task inputs.
See [ADR 0014](docs/decisions/0014-human-interventions-and-invalidation.md).

Task 069 exposes those reads in the collapsed **Browse connected paths** browser.
It owns expanded-only inventory polling, serializes selection reads and fences responses
by component scope, inventory/generation and request sequence. It shares original evidence
with the app, clearing pending originals on navigation/lifetime changes. Historical status
follows the map index. Existing answer, candidate and review adapters remain separate.

[ADR 0050](docs/decisions/0050-loredock-connected-path-consumers.md) defines the next
consumer boundary, without implementing it: qualify immutable receipts offline before
persisting connected-path context. Historical readability, current applicability and
question relevance are separate contracts. Existing consumer adapters stay authoritative.

[ADR 0051](docs/decisions/0051-loredock-literal-event-topics.md) scopes a fresh offline
event candidate from direct topic literals after the receipt experiment exposed a fixed
configuration-key assumption. It retains complete contract/consumer evidence and unknown
runtime scope, with new derivation identities. Production matching and consumers remain
unchanged pending qualification and a separate integration decision.

[ADR 0052](docs/decisions/0052-loredock-capture-resource-budget.md) defines a shared internal
capture deadline/work budget for the next offline scale qualification. Existing local caps
and publication fences remain, with explicit path/receipt subtotals. No public budget option
or production adoption follows from the small-family experiment.

[ADR 0056](docs/decisions/0056-loredock-qualified-composition-integration.md) follows
Task 097's passing complete resource qualification. It separates typed transient
ownership integration into existing connected-path v1 services from the later
literal-topic/receipt identity migration. Preserve independent historical test
controls and qualify the final production composition; experimental factories and
private emitted-method overrides are not production dependencies.
