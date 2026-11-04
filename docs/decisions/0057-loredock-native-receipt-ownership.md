# ADR 0057 — Own native receipt files with the source catalog

## Status

Accepted for bounded implementation planning, Task 104, 2026-11-04. No schema,
receipt store or application behavior changes are implemented by this decision.

## Context

The internal v2 producer has real literal witnesses and shared work accounting.
The offline receipt helper accepts an arbitrary trusted output folder. It has no
application owner, capacity policy, startup cleanup or integration with source purge.
Its temporary filenames are unique, so interrupted runs can accumulate files.

`CatalogStore` already holds exclusive `.owner.db` ownership. `Catalog.revoke` first
records revocation, then calls boundary listeners and `store.purge`; the latter marks
source purge complete after removing dependent SQLite content. Startup also calls
`store.purge`. Existing policy changes fence old history without physically deleting
it. Complete stopped-directory backup is the supported restore boundary.

## Decision

Follow the [native capture lifecycle contract](../loredock/NATIVE_CAPTURE_OWNERSHIP.md).
Use bounded immutable receipt files owned directly by `CatalogStore`, under a fixed
catalog-identity directory. Preserve the qualified guarded hard-link publication
mechanism and read-only source catalog during capture/history. Do not add a second
SQLite lifecycle or store receipt payloads in the source catalog.

Schema 10 adds one durable opaque catalog identity and fences older applications
that do not know about native receipt purge. The source store constructs/closes its
receipt storage child and runs its revocation cleanup before marking source purge
complete. This ownership applies even before a public capture consumer is enabled.
Policy-fenced records remain retained; source revocation removes affected records.

Store at most 64 completed receipts of at most 640 KiB each, plus one fixed bounded
pending file. Refuse a distinct new record at capacity; an exact existing record can
still be returned. No implicit eviction, age-based pruning or new user setting.
Unknown, corrupt or foreign data fail closed and are preserved for explicit repair;
cleanup failure keeps source purge pending. These are native-file bounds, not a cap
on the existing source/history directory or a forensic-erasure promise.

## Alternatives

| Option | Assessment |
| --- | --- |
| Keep caller-selected offline folders | Cannot enforce application ownership, crash cleanup, source purge or bounded accumulation. |
| Store receipt blobs/dependencies in the source database | Makes a successful capture mutate the source catalog and its write epoch. It changes the established read-only capture boundary and complicates independent accounting. |
| Add a separate receipt database | Avoids source writes, but adds a second journal/transaction/recovery and maintenance boundary for a small immutable content-addressed set. |
| Fixed owned immutable files | Reuses the qualified publication mechanism, gives explicit file-count/length bounds and keeps capture/history source reads unchanged. Chosen with catalog identity, startup recovery and purge ownership. |

## Consequences

The file format and lifecycle are native and versioned. Experimental/v1 records are
never imported or relabeled. History revalidates current authorization and exact
original support without reading code facts or deriving replacement paths.

Upgrade and source maintenance must understand schema 10. Rollback restores the
complete pre-upgrade backup while stopped; manually lowering the schema version is
unsupported. Native records are part of the complete backup and cannot be transplanted
into another catalog. A later explicit history deletion needs its own preview/action;
capacity does not authorize deletion of existing history.

Task 105 implements the strict pure codec; Task 106 adds storage/lifecycle ownership.
A later task connects capture/history work and its final source guard, followed by independent
native assessment and fresh final-composition qualification. Browser/HTTP/answer/review
consumers remain unchanged until their separate gates pass.
