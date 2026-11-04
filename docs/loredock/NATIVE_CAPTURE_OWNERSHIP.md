# Native capture storage and lifecycle

Task 104 defined this contract for native path receipts. Task 105 implements the
pure codec; Task 106 implements storage and schema ownership. Task 107 implements
the [authorized async service](NATIVE_CAPTURE_SERVICE.md). Independent assessment,
final qualification and public consumers remain subsequent work. The decision is recorded in
[ADR 0057](../decisions/0057-loredock-native-receipt-ownership.md).

## Existing boundaries

The [source store](../../apps/loredock/src/store.ts) owns the directory through an
exclusive owner database. Its purge clears dependent facts, answers, corrections,
spans and originals before marking a revoked source complete.
[Catalog](../../apps/loredock/src/catalog.ts) invokes purge on startup and revocation;
its boundary notifications also cover policy and registry changes. Policy fencing
does not currently mean physical history deletion. Keep that distinction.

The [offline publisher](../../scripts/loredock-capture-memory/receipt.mjs) already
validates complete support, shares one budget, holds a final source `BEGIN IMMEDIATE`
guard and publishes through a new temporary file, fsync, non-overwriting hard link,
cleanup and directory fsync. Its folder is caller-owned, random pending names lack
startup recovery, and it is outside application revocation/retention. Its read uses
a size check followed by an unrestricted file read; the native reader must instead
read at most the validated length plus one, bounded by the fixed limit, and reject
growth/truncation. Do not mutate this historical helper or reinterpret its results.

## Catalog ownership and compatibility

Schema 10 adds a private one-row `catalog_identity` table with a generated UUID. Its
creation and schema transition are one transaction; existing logical data remain
intact. Validate an existing identity rather than silently replacing it. Keep it out
of `project`/user-facing configuration. An old application supporting only schema 9
must refuse this catalog, so it cannot report source purge complete while ignoring
new receipt files.

`CatalogStore` constructs one receipt-storage child after its schema/identity is
ready and closes that child before releasing source ownership. The child imports the
store type only, avoiding a runtime module cycle. Every source-store caller gets the
same native lifecycle, including callers that do not enable capture. Recovery and
native revocation cleanup precede `CatalogStore.purge`'s completion of source rows.
Native storage failure cannot be swallowed by an optional observer or late service.

The fixed layout is `path-receipts/<catalog UUID>/` under the canonical LoreDock data
directory. Directory components must be owned regular directories, not symlinks;
foreign UUID subdirectories, unexpected entries and unsupported formats refuse.
An empty store creates no receipt directories until its first publication. There is
no arbitrary input/output path or file-import API. The catalog owner is the
process lock; one native capture/history owner per store serializes async operations.

Migration itself is atomic, but filesystem initialization can fail after that commit.
Such a failure can leave a schema-10 catalog that has not started successfully. Preserve
the complete directory and explicit error; never claim every byte stayed unchanged.

## Native format and bounded storage

Use `loredock-code-path-receipt/1` for the first native receipt format. Its canonical
content contains `schemaVersion`, `catalogId`, exact `projectionJson`, complete
`originals` and complete ordered `dependencies`. `receiptHash` is SHA-256 of canonical
content without the hash field; the full stored JSON is canonical too. Projection
must be a native v2 **path selection**, with internally consistent generation,
graph/flow/edge/projection identities, topic witnesses and original support. Node
IDs are opaque where their derivation requires absent analysis payloads; validate
their shape, uniqueness and support, without claiming to rederive them. Reject
v1/experimental formats and unknown fields/versions; never rewrite their identities.

The pure decoder validates bounded UTF-8, JSON/canonical depth, shape, hashes,
witness/endpoints, complete original/reference use and dependency structure. Application
history additionally validates current catalog authorization and each original against
the immutable source store before returning text. A decoder alone is not authorization.

| Storage bound | Contract |
| --- | --- |
| Completed records | At most 64 regular `<64 lowercase hex>.json` files. |
| Record bytes | At most 640 KiB, preserving the complete-operation limit. |
| Pending record | One reserved `.pending` regular file, also at most 640 KiB. |
| Enumerated entries | Read entries incrementally and stop on the first unexpected entry or the fixed count plus one. Never allocate an unbounded directory listing. |
| Native payload lengths | At most 40 MiB completed plus 640 KiB pending. Filesystem metadata/allocation and existing source databases are separate. |

These limits are fixed application defaults; trusted test constructors may only
reduce them. A distinct record at capacity returns `CAPTURE_STORAGE_FULL`. Reopening
an exact already-published ID does not require another slot. Do not evict, overwrite
or prune history. Later deletion needs a concrete user-selected action and separate
consumer acceptance; tests may remove only their own fixtures.

Startup and purge validate every completed record. Individual reads/publications
inspect the bounded layout and validate the records they use; there is no background
tamper monitor or claim that unrelated post-startup corruption is detected immediately.
Startup/purge use a fresh bounded validation budget for each of at most 64 records;
they are maintenance operations, not a reset of a capture/history caller deadline.

Open files without following symlinks and without blocking on non-regular input,
then validate the descriptor type/length and read a bounded amount. Reject growth,
truncation, malformed UTF-8, hash mismatch, a different catalog ID or unknown scope.
Do not return raw unvalidated file contents or include source text in errors.

## Publication and interruption

The capture service owns the single operation budget from before path work through
receipt validation and publication. It supplies the actual native v2 producer; no
identity translation, experimental publisher or new deadline is allowed. Preserve
all original/dependency, output and aggregate work limits.

After asynchronous preparation, enter the final synchronous source transaction,
recheck the budget, scope/metadata epoch and saved inventory, then publish without an
await. The storage layer checks the native format/catalog identity and capacity, writes
the bounded `.pending` file exclusively, fsyncs it, links it to the hash filename
without overwrite, unlinks pending and fsyncs the directory. Recheck the live guard
throughout. An existing final file must contain the exact same validated bytes.

On ordinary failure, remove only this invocation's new final/pending file; preserve
an existing identical record. Keep cleanup failures explicit, stop further native
operations and never report a clean rollback when deletion or fsync failed. Main
catalog rows remain read-only during successful capture/history. Storage writes are
declared receipt publication, not hidden source-catalog changes.

On restart, validate ownership/layout first. Discard the single recognized bounded
pending file: it was never a historical result. A fully linked, valid, authorized
record can survive even if the previous caller did not receive its completion; retry
is content-idempotent. Do not resume unfinished capture or recompute a result. Corrupt,
foreign, oversized or unexpected data refuse with a bounded repair diagnostic; preserve
them rather than guessing ownership or silently deleting history.

## Authorization, purge and policy

Every capture/history read uses the source catalog's current policy, active source
identities and exact saved dependency scope. Native history retains the recorded
projection, originals and dependencies after analysis replacement/eviction; it never
reads facts, derives paths or claims current applicability from old content. New source
registration may make history stale without authorizing it for the enlarged scope.

Policy changes fence old receipts just as they fence existing answer/review history;
they do not automatically delete them. Fenced records continue to count toward capacity.
Revocation removes every valid native receipt depending on that source, including
dependencies not displayed in a selected path. Validate the bounded store before
deletion; do not guess the scope of corrupt/foreign records. Unrelated valid history
remains. Unlink/fsync failure leaves source purge pending and exposes a failure.

Native cleanup runs before the source store clears its own records and marks purge
complete. Reopening repeats interrupted cleanup idempotently. If native cleanup
succeeds but later SQLite purge fails, the source remains pending; already removed
dependent receipts are not restored. Existing source authorization denies revoked
text immediately, independently of physical cleanup progress. Backups/external copies
and forensic erasure remain outside local logical purge.

Active capture/history rechecks source epochs and cancellation after cooperative
yields, so it cannot return text after a source/policy boundary change. Shutdown stops
the async capture owner before paths, analysis, catalog and storage. Storage close
invalidates remaining capabilities and releases descriptors; it cannot silently
complete work after the parent store closes. Future HTTP consumers must map domain/
budget failures explicitly, rather than exposing raw errors or treating them as success.

## Backup, maintenance and staged implementation

Stop all owners and copy/restore the **complete** data directory. The source database,
catalog identity and native files form one logical backup. Copying receipt files into
another catalog refuses on identity mismatch. Partial restores are unsupported: a
missing receipt cannot always be detected from the read-only source database, which
does not record publication. Do not promise detection of every incomplete backup.
Rollback to schema-9 builds
requires the complete pre-upgrade backup; never lower `user_version` manually.

Update source storage/history/compaction tools to recognize schema 10 without
application recovery, native publication or logical deletion. Preserve their source-
SQLite measurement boundary and explicitly disclose that native-file payloads and
dependencies are excluded. Compaction must keep the catalog identity and native files
unchanged under the existing exclusive owner lock. A native retention diagnostic can
be separately scoped; no whole-build deletion eligibility is implied.

[Task 105](../../tasks/105-loredock-native-receipt-codec.md) implements the strict
pure codec; [Task 106](../../tasks/106-loredock-native-receipt-storage.md) adds owned
storage/migration/purge. This keeps format validation independently reviewable before
the schema/lifecycle transition. The [async service](NATIVE_CAPTURE_SERVICE.md) now completes capture/history. Next
implement native independent decoder/assessment before the fresh
final-composition qualification. Keep all sixteen operation denominators, exact
cross-process comparisons and numerical limits. No endpoint, browser migration,
answer/review consumer, model/corporate input or L5 claim is authorized by this design.
