# Independent integration reference verification

Task 100 scope `30a41a0` precedes source review and implementation `0183563`.
The [portable fixture](../../../apps/loredock/tests/fixtures/integration-reference/README.md)
preserves the exact store/analysis source from `1ddac18`, deterministic compiled
modules and explicit import relocation. TypeScript 5.9.3 implementation/options,
two original/emitted/module hashes and thirteen unchanged runtime dependencies are
checked. No application code imports the reference.

The pre-implementation audit finds that the parser fingerprint hashes the entire
analysis module. Correction `5a2b9a2` updates the integration review and ADR: future
representation edits change that fingerprint and generation IDs, so incompatible
derived inventories require explicit reanalysis. Originals and saved history retain
their own rules. The control deliberately shares the current fingerprint provider
to compare behavior under identical test identities; it is not historical replay.

Four small test/configuration migrations preserve all existing assertions: tiny
fixture store/analysis constructors, the old snapshot prototype, the unscoped worker
and its ownership guard, and source reads for the two archived manifest paths.
Unchanged dependencies and all original expected hashes remain mandatory. New checks
verify the recursive dependency closure, identical stopped-catalog snapshots/full
payloads/no-write behavior/corruption refusal and independent process import with
no Git executable on PATH.

The first focused run occurs before a daemon build and passes **23 tests/subcases**,
including all migrated controls. Strict types and full checks pass on first execution:
**612 tests** and builds. All **415 Task 097 dependencies** remain byte-identical.
Five logs with normalized zero exits and raw/archive hashes are retained in
`validation.json`; there is no failed validation invocation or resource rerun.

Task 099 head `1ddac18` passes push 41822159152 and pull-request 41822228450 CI
(609 tests), then merges as identical-tree `efac695`. The next Task 101 integrates
transient ownership into production v1, preserves an explicit v1 path control,
tests actual protected HTTP/browser behavior and records real fingerprint transitions.
Final-composition resource qualification remains separate; no production change,
model request, corporate source or demo operation occurs in this task.
