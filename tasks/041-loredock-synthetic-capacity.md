# Task 041 — Larger synthetic capacity baseline

Status: implemented and locally verified, 2026-10-31.
Follows merged PR #44 (`1978b20`) in the owner's authorized synthetic-only sequence.

Implement the owned fixture and measurement harness described by
[the premeasurement contract](../fixtures/loredock-capacity/DESIGN.md). Freeze the
contract, generator, source manifest/revision fingerprint and fixed questions before
running a production index. Keep the original twenty-source corpus and historical
reports unchanged. No product tuning, larger limits, models or corporate inputs.

Run two fixed fresh generations with initial indexing and, when published, unchanged
refresh. Record paused/failed stages without automatically retrying. Measure file/byte
coverage, retained catalog size, process RSS, blob-read attempts/reuse, README orientation,
fixed incident/beacon retrieval, candidate scope and code/declaration omissions separately.
Verify original provenance and canonical selection changes across refresh/regeneration.

Keep the full-volume probe explicit and use focused generator/protocol checks in normal
CI. Record a concrete next task only after observing this baseline. Run the required
checks, review and merge after both exact-head CI events pass, then continue the sequence.
Indexing a synthetic volume does not establish semantic completeness, full framework
coverage, independent/private-pilot acceptance or Workbench bridge readiness.

Outcome: both fresh generations publish all 3,679 eligible files, with sixty intentional
exclusions and no failed reads. Initial indexes take 67.15/84.41 seconds; unchanged
refreshes take 16.41/16.47 seconds and reuse every text file. README and required original
context recall are complete; candidate recall is 21/22, and code analysis examines only
100/3,621 candidate files. See [retained evidence](../docs/fixtures/loredock-capacity/README.md)
for every limitation, storage/RSS measurement and the pure correction of a harness
availability aggregate. No indexing rerun or product tuning followed the results.

Next: freeze an offline qualification of related-source ordering by the strongest already
admitted relationship kind, preserving anchors, all clue kinds, four-source/two-link caps,
primary ranking and original evidence. Compare the observed small and volume corpora;
keep independent cases and configuration-dependent counterexamples. Do not promote a
new policy based only on recovering the known ir01 omission.
