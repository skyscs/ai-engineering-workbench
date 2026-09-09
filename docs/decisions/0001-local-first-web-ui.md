# ADR 0001 — Local-first runtime with web UI

## Status
Accepted

## Context

The target user may work with corporate source code and task artifacts that should not be uploaded to a separate Workbench cloud service. At the same time, the product should remain cross-platform and easy to evolve.

## Decision

Use a local daemon plus browser-based React UI served over `127.0.0.1`.

The daemon owns filesystem, Git, storage, and AI runtime access. The browser is only a client.

## Consequences

Positive:

- local repositories/artifacts remain local to the application;
- web technology gives a portable UI without committing to Electron/Tauri initially;
- daemon APIs remain reusable if a desktop shell is added later.

Negative:

- packaging Node + local process lifecycle must be solved;
- browser security/origin handling needs care despite localhost-only use.
