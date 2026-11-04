# Genuine compiled native upgrade evidence

Task 113 preserves 37 actual older emitted modules with unchanged imports and the
recorded fingerprint provider. All hashes match accepted Task 111 evidence. The current
composition has 38 modules. Neither runtime receives a substitute fingerprint.

Three archive integrity/portable-load tests and **817 full strict tests/builds** pass.
The reviewed plain-Node upgrade run passes all eight planned phases, six exact native
history reads and eleven expected refusals. New capture rejects the incompatible old
inventory until explicit reanalysis; both runtimes can reopen recorded old/new history.
Policy changes retain bytes but deny reads. Revoking the undisplayed dependency purges
both generations before a subsequent old-runtime restart. Exact source/flow/original
support, full dependencies, size metrics, authority and history counters are checked.

The [manifest](validation.json) retains ten command logs and all first/second/final
raw input, metadata, receipt, output, history and result artifacts, including actual
stored receipts. Each gzip archive has verified raw length/SHA-256 and archive SHA-256.
Original owned databases and source/Git directories remain at their recorded locations.

The first run omitted the matching generation pin from one backward-read test request;
validation refused it after three successful phases. That partial report and all earlier
raw bytes remain unchanged. The corrected and reviewed runs pass. No production code,
resource family, fingerprint, source authorization or numerical limit was changed.
These eight upgrade phases are not a resource qualification or semantic/L5 acceptance.

The first push CI failure is also preserved: an ordinary legacy assessor test sampled
164.052043 ms against its unchanged 150 ms limit. Its independent pull-request CI passed.
The correction separates ordinary functional/scoring checks from absolute resource
acceptance, preserves failed resource status and adds deterministic rejection checks.
Nine focused tests/subtests and the corrected full strict suite pass. The archived GitHub
failed-step log includes its assessment; temporary runner raw files were not uploaded.
No reserved family or assessor bytes were changed or replayed to address this CI failure.
