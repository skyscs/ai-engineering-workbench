# Native receipt storage verification

Task 106 owns immutable native receipt files through CatalogStore's existing exclusive
owner. Schema 10 adds an immutable private catalog identity; capture writes native
files without mutating source-catalog rows. See the
[ownership contract](../../loredock/NATIVE_CAPTURE_OWNERSHIP.md) and
[validation manifest](validation.json).

The final focused run passes 49 cases/subcases, covering bounded layout/reads,
content-idempotent publication, interruption/recovery, source revocation/policy behavior,
partial native/SQL purge failures, substituted-inode cleanup refusal, schema migration
failure, old-owner refusal, stopped backup and source-only maintenance. All strict
checks/tests/builds pass 741 tests on the first full run. The compiled smoke publishes
and reopens an exact 23,808-byte receipt, survives two inventory replacements, retains
bytes after policy fencing and removes them on source revocation.

Ten command logs retain every exit, including first legacy-test adaptation failures.
The original logical-row comparison remains complete, with the newly introduced
identity table checked separately; no frozen helper is modified. All nine analysis
fingerprint source modules are unchanged from the accepted parent. The existing
reference archives and historical measured families are preserved and not rerun.

Startup/purge perform bounded per-record maintenance validation; individual operations
validate their used records and the layout, not a background global tamper scan. Empty
stores create directories only on first publication. The codec/storage alone does not
authorize historical source release; native async capture/history and independent
assessment remain subsequent gates. No resource, dense-project or L5 claim follows.
