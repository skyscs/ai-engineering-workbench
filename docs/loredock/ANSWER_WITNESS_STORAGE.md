# Answer-owned prepared input storage

Task 124 freezes this storage contract before implementation. The internal owner from
[Task 123](PREPARED_QUESTION_OWNER.md) supplies trusted immutable strings. No public
prepared route, model dispatch or browser adoption is enabled by this storage slice.

## Durable encoding and admission

Schema 11 adds `answer_attempts.inputKind`, defaulting existing and ordinary new rows to
`legacy`. Prepared rows use `prepared-question/1`. Existing context, result, hash, prompt
and optional-field absence remain byte-identical. The legacy Answers reader explicitly
refuses prepared rows until the separate answer adapter implements their validation.

`answer_witnesses` owns one row per answer ID. Its version is `loredock-answer-witness/1`.
It binds the exact Task 123 context JSON through its SHA-256, the reviewed snapshot hash,
composition and prompt versions, and the exact witness JSON. The latter remains
`loredock-prepared-witness/1`; no parsed/reserialized substitute may replace its bytes.
The unchanged snapshot hash binds the composition version and both JSON strings. The
attempt binds question, build, policy/registry, input hash, connection/model settings
and prompt/schema versions. Stored dependencies equal the full resolution/review union.

One synchronous SQLite transaction checks capacity, inserts the preparing attempt,
inserts every dependency and finally inserts its witness. There is no await or provider
work. The future answer adapter calls it inside the owner's synchronous promotion
capability; rollback leaves an otherwise current Ready slot available. The adapter must
reserve its worker before asynchronous work, and bind retry identity to the preparation
ID and reviewed hash before checking expired transient state or new settings. That
dispatch/idempotency integration is not implemented by this task.

The versioned structural decoder checks exact context/hash/version/receipt/compact/prompt
agreement and catalog/build/source bindings. Current authorization is checked before
returning witness text. Missing, corrupt, foreign, unknown-version or mismatched prepared
input refuses; none can fall back to legacy. Historical authorized storage reads do not
require the original native inventory. Before future dispatch/publication, the separate
bounded validator must reopen every original and require the current source build and
review; a storage read is not that validation or permission to run a model.

## Immutability, quota and purge

Prepared identity, context and dependency membership are immutable. The witness permits
only a transition from retained content to a source-authorized purge tombstone; ordinary
SQL updates/deletes cannot silently replace it. Terminal status/usage/result updates
retain the original witness. Metadata does not authorize client-authored snapshots.

All witness rows, including purged tombstones, consume the fixed **64-record capacity**.
There is no automatic eviction or deletion policy. Each retained witness has at most
**768 KiB**, and aggregate retained witness text has at most **48 MiB**, measured using
actual UTF-8 BLOB lengths. Purge sets witness text to NULL and byte count to zero; it
releases bytes but does not release a history slot. These caps are independent of the
64 saved path receipts and exclude existing base-context storage and SQLite overhead.
This deliberate pilot capacity must be visible and reviewed before public adoption;
explicit future history deletion is a separate task.

Revocation first marks the source inactive/pending and fences reads. The existing
`answer_sources` union then purges witness and answer text in the same per-source SQLite
transaction, including dependencies absent from the selected graph. A failure rolls
back that transaction and leaves pending state for startup recovery. Native receipt-file
purge still precedes SQL purge: already removed files are not restored on SQL failure.
There is no claim of atomicity across files and SQLite. Policy changes fence old text
without rewriting it. Restart interrupts unfinished attempts without dispatch or retry;
transient preparations remain lost.

## Migration and maintenance

The schema migration is transactional and preserves legacy bytes and native receipt
files. Later startup failure can occur after the migration has committed. Genuine older
schema-10 daemons refuse schema 11; unchanged receipt codecs do not imply backward
daemon compatibility. Restore the complete pre-upgrade stopped-directory backup to
return to an older application. Never lower the version or restore only some files.

Storage/history reporting and stopped compaction must accept schemas 8 through 11,
report witness counts, purged counts and retained bytes without text, and expose simple
ownership inconsistencies. They must retain their existing no-migration/no-recovery
behavior. New report versions make the additional fields explicit. Full backups include
the new SQLite rows as well as native files. Source purge is logical, not forensic erasure.

Verification must cover genuine old runtime state, migration/refusal, exact content,
transaction rollback, both independent capacities, UTF-8 sizes, all dependency purge,
pending recovery, interrupted attempts, backup/restore and compaction. Historical
controls and resource records stay unchanged; no prior scale qualification transfers.
