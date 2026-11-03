# Retained lifecycle endpoints

`retained-boundaries.json` copies selected large-catalog lifecycle records from the
versioned Task 079 and Task 082 raw archives. Each archive SHA-256 and each worker
content SHA-256 is retained and verified before extraction. Byte-valued memory
fields and timestamps are unchanged. No process, corpus, evaluator or resource
qualification is rerun, and no original score is replaced.

The extract makes immediate close boundaries reviewable alongside preparation,
opening and replacement analyses. All four workers preserve the same RSS directly
across close. Heap-used differs substantially across runs; none of these endpoints
identifies reachable objects, native allocation ownership or a leak.

The [decision](../../loredock/MEMORY_OWNERSHIP_DECISION.md) combines this limited
observation with the original allocation profile and source ownership audit. It
selects a separate future terminal heap-retainer diagnostic, not an optimization
or new acceptance result. Task 082's incomplete paths remain an explicit limit on
cross-family comparisons.
