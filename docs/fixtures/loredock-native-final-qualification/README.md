# Final native composition: failed resource qualification

Task 110 executed the frozen ferry family exactly once at `a28d7aa`, after the
compiled driver passed both exact-head CI events and merged without tree changes.
All sixteen operations pass functional, exact-path, original-support, accounting,
no-write and lifecycle checks; all seven raw comparisons pass. Fifteen resource rows
pass. Reopened history records **399.58984375 MiB RSS**, exceeding **384 MiB**.
The outer process exits 1; both actual compiled workers exit 0. This family is exhausted.

The [manifest](validation.json) records six successful command logs, the immutable
first-attempt identity/result, both worker reports, every raw output/receipt, the actual
stored receipt bytes, stdout/stderr and all process exits. Each gzip archive has verified
raw length/SHA-256 and archive SHA-256. Database and synthetic source/Git directories
remain at the original owned run directory; they are not duplicated here. Initial
snapshot hashes, catalog identity, source revisions and runtime hashes are retained.
No raw artifact has been repaired or rescored in place.

The full strict check passes **802 tests** and builds. All 652 frozen baseline files
and six frozen inputs still match after that build. The first preflight log contains a
prose count corrected before the freeze: three Java methods/nine symbols, with the same
21-fact total and unchanged corpus. No reserved service warmup or retry occurred.

The root result's `resourceQualification: true` labels the reserved attempt; its
`failed: true` is the outcome. The nested generic driver's `resourceQualification: false`
remains unchanged and does not override that outcome. Functional success is reported
separately. The [decision](../../loredock/NATIVE_FINAL_QUALIFICATION.md) holds consumer
migration and scopes a small ownership audit before any candidate/new qualification.
No model, corporate source, forced collection, diagnostic hook or profiler was used.
