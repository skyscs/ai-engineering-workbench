# Task 100 — Preserve the independent pre-integration control

Status: scoped for implementation, 2026-11-04; production remains unchanged.

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
