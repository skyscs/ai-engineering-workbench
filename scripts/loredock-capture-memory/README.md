# Offline capture memory diagnostic

Task 077 only. Follow the [frozen protocol](../../fixtures/loredock-capture-memory/README.md).
The coordinator executes two fresh sizes and three sequential process arms, journals every
child exit/raw result, then evaluates resource and semantic gates independently. It does not
run from CI or ordinary tests. The `LOREDOCK_CAPTURE_MEMORY_OUTPUT` directory must be new and
absolute; candidate code must be committed before the one authorized run.

`paths.mjs` and `receipt.mjs` explicitly fork Task 075 with trusted synchronous phase hooks.
Baseline hashes identify unchanged dependencies. Producer/accounting namespaces remain the
same because diagnostics do not change derivation or receipt content. The observer is never
passed from public input; the control omits phase/query hooks. Existing SQL, evidence checks,
shared charges, yields and publication guards remain intact.

`observer.mjs` counts prepared fixed templates and records bounded memory/count observations.
It retains no query parameters or application objects. Owner counts describe containers at
explicit source sites, not garbage-collector reachability or retained bytes. Snapshot header
ownership is unavailable. Preparation/opening/closure snapshots are separate from operation
resource samples. Streaming file hashing avoids loading an entire SQLite file for copy checks.

`fixture.mjs` handles owned sources and stopped regular-file catalog copies. Only the preparer
generates a corpus; fresh readers open matching copies. The coordinator checks originals after
each child exits. Source construction, snapshot hashing, startup and replacement analysis are
outside read intervals and remain visible as lifecycle observations. No model or external data.

The validator checks all resource fields even if semantic validation later fails, and continues
semantic checks after a resource failure. An unavailable operation blocks only its dependent
checks. Its independent regressions cover observation limits, resource/integrity separation,
reopening copied catalogs, exact byte parity and zero nested historical work. Initial regression
failures and corrections are retained separately; the frozen corpus was not used for debugging.

No diagnostic result promotes a production consumer or overturns Task 075. Preserve the first
run even if attribution remains uncertain; an optimization needs new scope and qualification.
