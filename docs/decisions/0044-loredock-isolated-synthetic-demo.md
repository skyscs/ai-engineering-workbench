# ADR 0044 — Isolated synthetic demo launch

## Status

Accepted for Task 050, 2026-11-01. This source-build convenience uses existing catalog,
analysis and daemon services without changing their schemas, matching semantics or UI.

## Decision

`pnpm loredock:demo` builds the application and runs a local launcher with no source or
data-path arguments. The explicit command authorizes only the bundled twenty-repository
small fixture. Create fresh owned temporary sources/data, register exactly those source
roots, index once and analyze once. The fixture's oracle/manifest files outside source
roots are not registered. No source service is executed and no model is invoked.

Require a published index containing all eligible fixture files and a published inventory
retaining every code candidate before launching the daemon. Partial syntax coverage is
explicit. Unpublished/incomplete/failed stages remain in retained data and never retry
automatically. Progress includes generated locations, indexing and analysis. Early
interruption retains the printed directory even before a database is opened.

Probe loopback port 4244 before creating sources. Close incidental probe connections and
fail clearly if the port is unavailable. A later bind race remains the daemon's normal
startup error; never stop another listener. Stop/close preparer services and the exclusive
store owner before spawning the normal compiled daemon. Force its owned data directory,
answer mode off and development mode off, irrespective of inherited LoreDock settings.
The normal Host/Origin/session boundary stays in force.

Announce readiness only after the owned daemon reports listening. Interruptions stop
owned preparer work or signal only the owned child process group; a bounded shutdown
fallback terminates that group. Closing the demo retains its repositories, data, metadata
and user notes. Each new demo command creates a separate project. Print a shell-quoted
explicit command for reopening the retained data through normal startup, with model mode
still disabled. Existing indexes/inventories then retain normal restart semantics.

## Consequences

The user can explore a complete small example without entering twenty paths or configuring
Codex. The example contains 79 eligible files, 21 code candidates and sixty known exclusions;
six files retain seven syntax-gap messages. It is neither a new benchmark nor a claim of
semantic completeness. Generated roots live in the OS temporary directory: the launcher
retains them, but OS cleanup may remove them. Long-lived projects should use normal
registered sources/data; recorded source paths still matter for refresh and restoration.
