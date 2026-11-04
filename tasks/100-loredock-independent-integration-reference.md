# Task 100 — Preserve the independent pre-integration control

Status: selected by Task 099; implementation not started.

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
