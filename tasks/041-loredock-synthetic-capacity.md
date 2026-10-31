# Task 041 — Larger synthetic capacity baseline

Status: workload contract scoped before generation and measurement.
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
