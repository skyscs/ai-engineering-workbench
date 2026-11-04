# Actual compiled native upgrade regression

After committing and building, use Node 22.23.2 and an absent absolute
`LOREDOCK_NATIVE_UPGRADE_OUTPUT`, then run `node scripts/loredock-native-upgrade/run.mjs`.
The entry verifies the [older runtime](../../apps/loredock/tests/fixtures/native-before-analysis-writes/README.md),
records current compiled hashes and creates only owned synthetic repositories/catalogs.
No fingerprint is overridden and no resource corpus is executed.

Eight fixed phases cover old creation, forward history, explicit reanalysis, backward
reopening, and policy/revocation in both runtimes. Raw bytes are saved before independent
shape/source/complete-path checks; history compares exact saved content and actual
counters. Missing/failed phases preserve the denominator and fail the run. First outputs
and partial reports remain at the exclusive output directory. All owners close even
after a failed assertion. The final result, raw capture/history, metadata, old/current
module identity and refusal reasons remain reviewable.

This is a small compiled transition regression, separate from Task 112's behavioral
controls and the future large resource gate. Ordinary tests validate archive integrity,
unchanged fingerprint reproduction and plain-process loading without Git/build output;
the explicit command exercises the complete installed-runtime transition locally.
