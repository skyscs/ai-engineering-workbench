# ADR 0003 — Codex CLI as the first AI runtime

## Status
Accepted

## Context

The target workflow already uses Codex CLI locally, including corporate configurations where authentication, allowed models, routing, and token budgets are controlled by an existing proxy/configuration.

## Decision

Implement `CodexCliRuntime` first and reuse the user's existing Codex configuration/authentication.

The Workbench will not own Codex credentials.

## Consequences

Positive:

- works with existing personal or corporate Codex setups;
- minimizes authentication/product complexity;
- lets the application dogfood the same coding runtime used by the target user.

Negative:

- the Workbench has less control over exact provider payloads/tool calls than with a direct API runtime;
- exact outbound-payload auditing is deferred;
- event normalization depends on the CLI's supported non-interactive output.

A direct API runtime remains an intended future adapter, not a replacement of the runtime abstraction.
