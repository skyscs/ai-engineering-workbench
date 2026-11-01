# Security and Data Boundaries — v0.1

## LoreDock source catalog

LoreDock's first slice is a separate model-free application on loopback port 4244.
It stores admitted committed source bytes locally, without fetching repositories,
executing source commands or configuring Codex. It uses its own exact Host/Origin,
session/CSRF boundary, escaped text UI and data-directory ownership lock. Read
[ADR 0019](docs/decisions/0019-loredock-local-catalog.md) and the
[source policy guide](docs/loredock/USER_GUIDE.md#policy-and-removal) before indexing.
Default exclusions are not a secret scanner; Git metadata/installations remain
trusted local inputs. Source revocation fences live search/evidence before logical
purge; backups and prior external copies are outside that purge.

The opt-in answer pilot sends a reviewed bounded context to the selected Codex
connection. Its capability restrictions, trusted-CLI assumptions and qualification
limits are recorded in [ADR 0020](docs/decisions/0020-loredock-bounded-answers.md).
Production execution disables model filesystem/network tools; it does not claim the
strict filesystem namespace demonstrated separately by the sandbox-helper probe.
Global agent instructions and enabled MCP servers block preflight. Configuration
selection is not proof of account identity. Source revocation also fences and purges
dependent saved answer/context text. Cancellation cannot guarantee provider-side
cancellation or zero usage. Generated claims require semantic review even when every
citation mechanically resolves.

The declaration map is a bounded read projection over authorized stored source bytes.
It adds no execution privileges or external calls. Labels and properties render as escaped
text; candidate comparisons are not runtime evidence. Source/policy changes fence map
reads and late UI responses. See [ADR 0022](docs/decisions/0022-loredock-declaration-map.md).
The code-flow projection parses stored text in memory, without compiler plugins, project
configuration, filesystem/package resolution or source execution. It retains original
evidence and the same fencing. Static/candidate links do not establish runtime behavior;
see [ADR 0023](docs/decisions/0023-loredock-static-code-flows.md).
The internal durable code-inventory service validates stored originals, Git blob hashes,
parser fingerprints and bounded file checkpoints before reuse within an interrupted run.
It adds no Git/model/source execution. Registry/policy changes atomically fence inventories
and clear file derivatives; existing revocation purge also covers every dependent generation.
Two bounded inventories are retained, independently of raw index history; see
[ADR 0040](docs/decisions/0040-loredock-durable-code-inventory.md). Task 046 enables analysis
for new current index publications. Protected APIs preserve Host/Origin/session/CSRF and
original ownership checks; manual starts bind expected source/policy versions. Startup does
not resume or retry old attempts. Project, summary, page/file and original-response fences
prevent late data from restoring an obsolete scope. See
[ADR 0041](docs/decisions/0041-loredock-code-coverage-workflow.md).
Exact-symbol lookup uses the same protected read boundary. Literal queries cannot become
SQL, regular expressions or executed source. Bounded manifest/checkpoint validation and
original-file validation precede use; an asynchronous scan rechecks scope/run identity
before returning. Corruption fails visibly. Query edits and source/index/policy changes
invalidate pending text, symbol and original responses. See
[ADR 0042](docs/decisions/0042-loredock-exact-symbol-search.md).
The optional `pnpm loredock:demo` command accepts no source/data-path arguments and
registers only freshly generated synthetic source roots. It checks port availability,
uses isolated retained data, releases preparer ownership before daemon startup and forces
answer/development mode off despite inherited LoreDock settings. Signals target owned
work/processes; an occupied port does not authorize stopping another application. See
[ADR 0044](docs/decisions/0044-loredock-isolated-synthetic-demo.md).
The explicit storage-report command opens only an existing schema-8 catalog read-only,
without daemon ownership, migrations or recovery. It exports aggregate counts/bytes,
not source text, paths or connection settings. Fixed database/sidecar paths must be regular
files. Read-only SQLite can maintain shared-memory bookkeeping; this is not a forensic
acquisition or secure-erasure claim. See [storage accounting](docs/fixtures/loredock-storage-audit/README.md).
Engineer corrections retain explicit human/unverified provenance. Bounded notes matching
retrieved passages are previewed and sent separately to the answer model as untrusted
assertions, never instructions or source citation IDs. Answers inherit their complete
source dependency scopes; revocation fences and purges saved note text too. Review edits
invalidate pending publication, without automatically starting another model call. See
[ADR 0028](docs/decisions/0028-loredock-answer-review-context.md).
Derived interface comparisons are untrusted static-analysis clues with no independent
citation authority. They can enter an answer only with every original supporting span
already supplied; publication rechecks their source support and adapter provenance.
They inherit the answer's source/policy fencing and purge. See
[ADR 0035](docs/decisions/0035-loredock-answer-interface-context.md).
All sources in the recorded index conservatively fence correction
history/replay; revocation purges dependent note text, environment and target snapshots,
including withdrawn versions. SQL/HTTP and late-response boundaries are described in
[ADR 0024](docs/decisions/0024-loredock-engineer-corrections.md).
Refresh cache reuse is restricted to the same source/path/Git object and policy/extractor,
with raw/span/metadata integrity checks and fresh repository inventory. Comparison APIs
omit revoked scopes and fence old policies. Purge clears all copied byte/span generations
and extraction fingerprints. See [ADR 0025](docs/decisions/0025-loredock-incremental-refresh.md).
Project orientation quotes authorized original README lines and links saved manifests.
It executes no setup instructions, HTML, Git command or model call. Current-policy,
source revocation and late-response fences cover cards, reading links and citations;
new registrations remain separate from historical content. See
[ADR 0027](docs/decisions/0027-loredock-project-orientation.md).

Source candidate previews use the same protected API and authorized original context.
They accept only a question and optional published build ID; no model, arbitrary source
input or investigation is executed. Lexical suggestions and negative mentions remain
unverified reading clues. Question/source/policy/index/review changes fence cached UI
previews and pending original-evidence responses. See
[ADR 0036](docs/decisions/0036-loredock-source-candidate-preview.md).
Related-source previews additionally validate both endpoints and auxiliary originals
from the same authorized build. They retain projection provenance, omissions and
unverified status; extra references never become answer-input evidence implicitly.
Overlapping engineer notes remain human assertions. Existing response and citation fences
cover the entire preview. See [ADR 0037](docs/decisions/0037-loredock-candidate-links.md).
Code adapter v3 inspects at most 100 literal Dojo object exports without execution or
module resolution. Unsupported shapes and uncertain bindings remain gaps; AMD properties
cannot be treated as ES named exports. Adapter upgrades do not rewrite saved answer/review
bytes or implicitly reapply old notes. See [ADR 0038](docs/decisions/0038-loredock-dojo-object-exports.md).

Bulk path previews and confirmations use the same session/CSRF boundary. Registration
revalidates canonical identities and the registry before atomic insertion; persisted
receipts cannot reauthorize revoked sources. No directory scan or source execution is
introduced. See [ADR 0029](docs/decisions/0029-loredock-bulk-source-baseline.md).

The sections below describe Workbench's existing AI investigation boundary.

## Goal

The Workbench must be usable with corporate source code without requiring repositories and artifacts to be uploaded to a Workbench cloud service.

The application itself is local-first, but an AI runtime may still transmit selected data externally. The UI must not describe such a configuration as “fully local” unless the model runtime itself is local.

## Workspace data boundary

Every Workspace is bound to an AI Connection.

The connection represents an approved data boundary. A task created in a corporate Workspace must not silently switch to a personal ChatGPT/Codex connection for a retry or a different model.

Changing a Workspace's AI Connection or its launch settings after tasks exist is
out of scope for v0.1. Use a new connection/workspace for a changed data boundary.
The only exception is binding a previously unset configuration directory once,
before any AI run history exists and while no StageRun is active. Migration never
infers this directory from the environment or rewrites historical snapshots.

A configured profile is a user-declared connection, not verified corporate account
isolation. External configuration may change; do not claim provider/account identity
unless CLI evidence supports it. Never silently fall back to another connection.

## Credentials

### Git

Prefer system Git authentication:

- SSH agent
- Git Credential Manager
- system credential helper
- corporate certificate/configuration already used by `git`

Do not persist Git passwords or private SSH keys in the application database.

### Codex CLI

Reuse existing Codex CLI authentication and configuration.

The Workbench should not parse or copy Codex OAuth/session tokens merely to execute Codex. It should spawn the CLI and let Codex own its authentication lifecycle.

If separate corporate/personal Codex profiles are used, store only the profile/config selector necessary to launch the desired CLI configuration.

The connection explicitly stores a canonical configuration directory (`configHome`).
Every Codex subprocess receives it as `CODEX_HOME`; missing settings or redirected
directories fail without fallback. Known inherited OpenAI credential/routing
overrides are rejected before spawning. The executable, external configuration,
custom provider environment and credential store remain trusted: selecting a path
does not prove account identity. See [ADR 0012](docs/decisions/0012-explicit-codex-configuration-home.md).

## Repository mutation

- synchronization uses `git fetch --all --prune`;
- do not automatically `pull` a user's normal checkout;
- investigation must use a verified read-only execution policy, not only a prompt;
- task-specific mutations happen in Workbench-created worktrees only in future implementation stages.

## Artifact storage

Artifacts are copied into the local task directory or referenced according to a clearly documented policy. v0.1 should prefer copying so task state is reproducible.

Store at minimum:

- original filename
- MIME type
- byte size
- content hash
- local stored path
- created/imported timestamp

Original artifacts are immutable after import.

Import does not imply analysis capability. Text/Markdown/log context is supported;
images require verified runtime support. PDF/video storage does not promise OCR,
extraction or video understanding in v0.1. Display excluded inputs before a run.
Enforce bounded streaming uploads and generated storage names; resolve downloads
by task/artifact ID and reject canonical-path/symlink escapes. Serve untrusted
attachments as downloads with nosniff; render Markdown without executable HTML.

## Local HTTP and process boundaries

Before privileged APIs are introduced, restrict Host/Origin to configured local
endpoints, establish an HttpOnly SameSite=Strict browser session and require a
session CSRF token on mutation requests. Protect sensitive read routes with the
session as well. No wildcard CORS, tokens in URLs/logs, or arbitrary-path APIs.
Treat DNS rebinding and cross-origin browser requests as threats to local file/Git APIs.

Spawn Git/Codex through argument arrays, validate option-like inputs, and keep
arbitrary model-profile arguments out of v0.1. Redact credentials from URLs/errors;
preserve command status and useful diagnostics without dumping environment/config.

Worktrees are not process sandboxes. Read-only shell policy does not automatically
constrain every inherited MCP tool, hook or provider. Validate the selected runtime
configuration in Task 000 and reject configurations that cannot meet the documented
investigation restrictions. Never enable bypass/automatic privilege escalation to
make an incompatible run succeed. Repositories/configuration are trusted local
inputs in v0.1; the product does not promise safe execution of hostile Git hooks.

## Codex CLI outbound visibility limitation

When Codex CLI owns the model interaction, the Workbench does not necessarily control or observe the exact HTTP payload sent by Codex to its provider.

Therefore v0.1 may truthfully display:

- which task/worktree was exposed to Codex;
- which artifacts/instructions were supplied by the Workbench;
- which runtime/profile/model was requested;
- normalized CLI events and final output where available.

It must **not** claim to provide an exact byte-level outbound audit.

A future direct API runtime can provide stronger outbound controls and auditability because the Workbench itself will own tool calls and provider payload construction.

## Policy model — future-compatible

The domain model should leave room for workspace policies such as:

```yaml
allow_full_files: false
max_snippet_lines: 200
require_approval_for:
  - video
  - conversation
deny:
  - "**/.env"
  - "**/*.pem"
  - "**/secrets/**"
```

Policy enforcement is not required for the first end-to-end v0.1 investigation, but security-sensitive code must not be architected in a way that makes such enforcement impossible later.
