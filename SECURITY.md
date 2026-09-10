# Security and Data Boundaries — v0.1

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
