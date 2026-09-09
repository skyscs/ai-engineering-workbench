# ADR 0002 — SQLite for metadata, filesystem for large/local artifacts

## Status
Accepted

## Context

The application is single-user and local-first. It needs durable structured state plus efficient storage for repositories, worktrees, logs, screenshots, videos, PDFs, and generated reports.

## Decision

Use SQLite for structured application state and the local filesystem for repositories and file artifacts.

## Consequences

- no local database server is required;
- backup/export remains feasible;
- large files do not bloat the relational database;
- transactional coordination between DB rows and filesystem operations must be designed carefully.
