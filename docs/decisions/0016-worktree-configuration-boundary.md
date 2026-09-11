# ADR 0016 — Worktree configuration discovery boundary

## Status

Implemented as a post-v0.1 correction, 2026-09-11. Supersedes the ancestor
configuration rejection rule in [ADR 0011](0011-codex-runtime-execution.md).

## Context

With the default Linux data directory under the user's home, preflight walked
from a prepared worktree to `/` and rejected the user's `~/.codex` directory even
when the saved connection selected `~/.codex-plus`. This blocked investigation
before any CLI subprocess. Acceptance fixtures under `/tmp` missed this layout.

Skipping a directory named `.codex` at a presumed home is insufficient: the CLI's
project-root markers can be customized in the selected configuration. The adapter
needs a defined discovery boundary shared by preflight and execution.

## Decision

Pass `-c project_root_markers=[]` in the shared restrictions for `features list`,
profile-aware `mcp list` and `exec`. Codex documents that an empty marker array
makes cwd the project root and skips parent discovery. The version-only diagnostic
does not load project configuration and needs no override. See the
[official project-root documentation](https://learn.chatgpt.com/docs/config-file/config-advanced#project-root-detection).

Keep cwd bound to a canonical declared worktree. Reject any `.codex` entry at
every selected read root before diagnostics and again before exec, including
secondary repositories, files and dangling symlinks. Do not exempt an entry
because it also equals the selected configuration directory. The CLI still loads
cwd-local project configuration with the marker override, so this guard remains
necessary. No recursive source scan or project configuration support is added.

Continue binding the saved `CODEX_HOME` for every subprocess, with no fallback,
and preserve named-profile validation, MCP/tool restrictions, metadata checks,
read-only execution and explicit retry. Neither the failed run nor the selected
connection is rewritten. No personal/corporate directory naming convention is
required by the implementation.

## Verification and consequences

`scripts/runtime-config-boundary-probe.mjs` uses a synthetic home and detached Git
worktree nested below it. A disabled MCP canary proves the control actually loads
an ancestor layer. The override excludes it while retaining the selected base or
named profile, even with custom markers. A malformed ancestor cannot break the
restricted diagnostics. A cwd-local canary remains visible to the CLI and is
rejected by the adapter. This probe passed on CLI 0.153.4 and 0.154.0 without model
requests or access to real account files; see the
[recorded results](../fixtures/runtime-adapter/config-boundary-result.json).

Process-fixture tests verify restrictions on every configuration-reading command,
the saved home under a conflicting ancestor, all read-root entry types and a
project layer appearing between preflight and exec. Ordinary checks remain
independent of a Codex installation and authentication.

Ancestor project layers and instructions outside cwd are excluded from project
discovery. Trusted user/system configuration and user instructions remain CLI
concerns; this setting does not provide a filesystem read allowlist or certify
account identity. Configuration metadata checks retain their existing concurrent
mutation limitations.
