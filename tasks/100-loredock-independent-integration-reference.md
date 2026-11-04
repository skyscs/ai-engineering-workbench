# Task 100 — Preserve the independent pre-integration control

Status: implemented and locally verified, 2026-11-04; production remains unchanged.

Before changing production store/analysis ownership, implement the minimal portable
test-only reference selected in ADR 0056. Preserve exact pre-integration store and
analysis sources with revision/path/SHA-256, deterministic compiled modules and an
explicit relative-import relocation map. Archive only the necessary changed control
modules; hash the unchanged runtime dependency closure. Do not copy an entire tree.

The reference must execute in a shallow clean checkout without old Git objects,
network, generated daemon dist or access to local worktrees. Validate archived source
bytes, compiler/options, exact relocated output and unchanged dependencies. Keep
reference imports confined to tests and never connect them to the application.

Migrate the explicitly source-bound ordinary snapshot/worker/canonical comparisons
and shared tiny configurations to this reference. Preserve all existing functional,
SQL/preparation, full-validation, lifecycle, receipt/history and source-pin assertions.
Document the migration map. Do not relax checks or turn them into comparisons of
the new production implementation with itself. Add a small direct comparison of
the reference and still-unchanged production before wiring new services.

No production service/schema/API/UI/parser change, frozen script/manifest edit,
resource-family replay, model request or user data/demo change is in scope. Retain
first failures; run strict/full checks and verify the reference without prebuilt
daemon output. Review all source/import/hash mappings and both exact-head CI events
before merge. Then scope the actual v1 streaming/read-scope/compact representation
integration, retaining separate final-composition qualification.

## Source finding before reference implementation

`codeAnalysisFingerprint` hashes the complete `code-analysis` module, not only parser
functions. A representation-only edit therefore changes the production fingerprint
and generation identities. Correct Task 098's overly strong unchanged-fingerprint/
byte-identity/rollback assumptions before integration. Preserve stored originals and
historical bytes, explicitly fence incompatible derived inventories and cover reanalysis
and backward reopen. Do not freeze an old fingerprint over changed source implicitly.

The test reference preserves store/analysis method behavior while deliberately sharing
the unchanged current fingerprint provider. This lets paired stopped-copy comparisons
use identical test identities; it is not a replay of an old runtime/fingerprint. Record
that context dependency and test it. Historical measured identities remain archived.

## Outcome

Scope `30a41a0`, fingerprint correction `5a2b9a2` and implementation `0183563`
preserve two original sources, deterministic compiled/relocated modules and thirteen
unchanged runtime dependencies. Four explicit test/configuration migrations retain
all original assertions. The first source-only focused run passes 23 cases/subcases
before daemon dist exists; separate-process import needs no Git executable.

Strict/full checks pass first execution: 612 tests/types/builds, with all 415 prior
measured dependencies unchanged. Five zero-exit logs and the migration map are
[retained](../docs/fixtures/loredock-integration-reference/README.md). Next is Task 101's
bounded production v1 representation integration and explicit fingerprint-transition
coverage, followed by separate final-composition resource qualification.

Task 099 head `1ddac18` passes push 41822159152 and pull-request 41822228450 CI
(609 tests), then merges as identical-tree `efac695`, verified before this result.
