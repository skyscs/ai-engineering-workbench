# Native compiled driver verification

Task 109 adds the [actual compiled two-process driver](../../../scripts/loredock-native-qualification/README.md).
It preserves the stopped schema-10 catalog identity and byte-exact initial snapshot,
uses the actual shared budget/capture/history services and records 37 compiled runtime
modules plus the TypeScript payload hash. All prior helper/measured inputs are unchanged.

Eleven focused cases/subcases and **802 strict tests/builds** pass. The retained compiled
smoke runs both complete and incomplete development cases. Each performs all sixteen
operations, all seven raw comparisons, exact typed paths/original ranges, authorized
evicted history and complete observation/lifecycle checks. Both processes exit zero
in each case. Every observed resource dimension also passes these small runs; this is
not the separately frozen final composition qualification.

Real child regressions include cleanup failure after closing the owner, malformed
reports, changed stopped snapshots, nonzero exit, watchdog and cancellation. Recorded
copy mutations cover missing work/counters, nested historical reads, source writes,
missing operations, changed runtime/catalog identity and absent closure. A zero RSS
ceiling fails all sixteen resource dimensions while preserving content and raw parity.
Measured metrics must equal the saved service output; bounded report reads reject
symlinks, non-files, oversized data and invalid UTF-8.

The [manifest](validation.json) retains ten command logs and 211 raw/report/process
artifacts from the first failed compiled run, first focused failures and final smoke.
The initial oracle had an incorrect Java role and included the terminal empty newline
line; fixes follow the existing parser/extractor contract, with no application change.
The second focused failure attempted to clone a trusted function. Its command log is
retained, but the test helper deleted that captured fixture after the nested setup
failure. This limitation is explicit; the helper now preserves nested-test failures.
The completed first/final artifacts are never rewritten or rescored in place.

Each gzip archive has a verified raw length/SHA-256 and archive SHA-256. Database copies
and synthetic Git object directories are omitted from this documentation bundle; exact
snapshot hashes remain in metadata, and the original owned run directories retain the
complete files. No original-text, scope, resource or comparison gate was relaxed.
Next Task 110 freezes a fresh final family before its only reserved attempt. Semantic,
user/private-pilot acceptance, public consumers and the Workbench bridge remain separate.
