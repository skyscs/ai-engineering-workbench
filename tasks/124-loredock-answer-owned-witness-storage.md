# Task 124 — Persist answer-owned prepared witnesses atomically

Status: accepted through PR #128, identical-tree merge `c1f6c37`; push 41942652014 and
pull-request 41942739940 passed at `a9c9cde` (912 tests, strict types and builds).
Task 123 was accepted through identical-tree merge `da7122b`.

Implement the storage/recovery foundation of [ADR 0059](../docs/decisions/0059-loredock-prepared-question-lifecycle.md)
using the exact bounded strings from [Task 123](123-loredock-prepared-question-owner.md).
Keep native preparation, HTTP/UI adoption and real model dispatch disconnected until the
complete answer admission/publication path can preserve what the user reviewed.

1. Audit current schema-10 attempt/context/dependency storage, purge, restart, diagnostics,
   compaction and all archived-store/reference tests. Preserve accepted source/emitted
   controls and declare the exact migration and method deltas before editing. Do not
   rewrite old expected hashes, raw histories, frozen inputs or qualification results.
2. Freeze schema 11, the explicit legacy/prepared input discriminator and answer-owned
   witness row keyed by answer ID. Bind the exact context JSON, reviewed hash, witness
   JSON, prompt/composition versions and complete source-dependency union. The prepared
   witness format from Task 123 is internal; review and freeze its durable encoding and
   backward-validation rules before persistence. Never treat a client hash/graph as authority.
3. Preserve old context/result/hash/prompt bytes and legacy API behavior. Old rows read as
   legacy without content rewriting. Unknown prepared versions, missing/corrupt records,
   wrong ownership, foreign catalog/source/build bindings and inconsistent hashes fail
   closed without falling back to the legacy path. Unauthorized/purged rows expose no
   witness text. Inventory replacement/eviction alone must not invalidate issued content.
4. Provide one synchronous transaction boundary that inserts a prepared attempt, all
   resolution/review dependencies and its exact witness together. No provider work or
   await occurs inside it. On constraint, storage or capacity failure, roll back every
   row and leave an otherwise current ready snapshot available to its owner. Make the
   later answer adapter's ownership/idempotency obligations explicit; do not enable it yet.
5. Enforce 64 answer-owned records, 768 KiB per serialized witness and 48 MiB aggregate
   serialized witness bytes using actual stored UTF-8 bytes. These quotas are independent
   of the 64 user-saved path receipts. No automatic eviction, answer deletion, hidden
   retries or quiet graph removal. Terminal attempts retain immutable witness content;
   freeze how source-purged rows affect quota metadata and test it explicitly.
6. Purge dependent witness text in the same answer/source transaction through the full
   answer_sources union, including sources absent from the selected graph. Preserve
   pending-purge fencing and startup retry after failure. Restart interrupts preparing/
   running attempts without dispatch; transient IDs remain lost. Cover rollback and
   every interrupted-publication boundary without assuming file/SQLite atomicity.
7. Update stopped-storage reporting, history diagnostics, compaction and backup/schema
   support before rollout. Test migration of genuine old rows and native receipt files,
   forward recovery and explicit older-daemon refusal where schema 11 is unsupported.
   Keep genuine archived parser/runtime identities; do not fake fingerprints or claim
   backward daemon compatibility merely because a receipt codec is unchanged.
8. Run focused compiled/storage/purge/capacity checks and the full strict suite, record
   first failures and exact runtime deltas, then require both final-head CI events. Scope
   prepared answer admission, validation before dispatch/publication, usage/cancellation
   and shared configuration ownership as the next bounded task. HTTP/UI must not show a
   native preview while Generate silently uses a different legacy prompt.

No real model request, new source policy, corporate input, user-demo mutation, exhausted
resource/model replay or default native-answer enablement. The complete composition still
needs fresh prospective resource and semantic gates before adoption in the opt-in pilot.

The [frozen storage contract](../docs/loredock/ANSWER_WITNESS_STORAGE.md) records the
encoding and quota decisions. [Task 125](125-loredock-prepared-answer-admission.md)
implements actual answer admission/publication before public adoption.
