# Task 125 — Admit and publish answers from the exact prepared input

Status: scoped by Task 124; start after its exact-head acceptance.

Integrate the internal preparation owner and durable witness store into a bounded answer
adapter under [ADR 0059](../docs/decisions/0059-loredock-prepared-question-lifecycle.md).
Public preparation routes/browser adoption and real model qualification remain separate.

1. Preserve accepted source/emitted and legacy byte controls before editing. Audit actual
   Answers, runtime, configuration and shutdown boundaries. Keep old manifests, frozen
   records and exhausted model/resource families unchanged; use ordinary owned fixtures
   and controlled runtime doubles only.
2. Admit a prepared answer using only request ID, server-owned preparation ID and reviewed
   hash. Check a stored matching request before transient expiry/restart/configuration;
   return its original authorized attempt without dispatch. A different binding conflicts.
   Snapshot connection/model settings only at first admission. Preserve legacy start and
   optional-field/context/hash/prompt bytes on its explicit legacy branch.
3. Use the synchronous preparation promotion and Task 124 transaction together. Reserve
   the actual answer worker before invoking asynchronous work, including synchronous fake
   runtimes. On constraint/capacity failure leave an otherwise current Ready snapshot intact;
   on commit consume it exactly once. No SQL/file cross-system atomicity claim or retry queue.
4. Share preparation/answer/configuration ownership with the actual consumers. Check
   asynchronous configuration leases after awaits, reject competing starts, and stop new
   consumers before their path/analysis/storage dependencies. Background analysis changes
   must fence incomplete preparation, without an implicit pause/reanalysis/retry.
5. Before runtime.prepare, load and validate the answer-owned witness under an actual bounded
   operation. Reopen exact originals and every resolution/review dependency; check catalog,
   current policy/registry/published source build/review and all frozen format/hash bindings.
   Never read current native facts, select a replacement path or require the old inventory.
   Missing/corrupt/unknown/fenced input cannot fall back to legacy dispatch.
6. Dispatch the exact stored prompt/version and unchanged original-only cited-answer schema.
   Preserve native omissions, qualifications and legacy clue priority. Save provider usage
   even after cancellation, validation failure or late completion. Validate the issued
   witness again before publication, then atomically publish only if the attempt is still
   running and authorized. Record usage before opening the validation epoch; never check
   that old read-only epoch after the adapter's own publication SQL writes.
7. Return authorized historical base/compact context with explicit input kind, staleness,
   omissions and unsupported/purged failures. Native nodes, receipt IDs and notes never
   become citations. Test cancellation, policy/review/source changes, new source builds,
   inventory eviction, late runtime output, restart/idempotency, quota rollback and cleanup.
   Keep terminal witness bytes immutable and source purge/recovery effective.
8. Run focused/full checks, record first failures and actual runtime deltas, and require
   both final-head CI events. Scope protected HTTP/UI adoption with the existing simple
   question → Find context → review → Generate flow next. Do not expose a native preview
   paired with legacy generation. Fresh prospective full-composition resource and semantic
   gates remain required before native input becomes the opt-in pilot default.

No corporate code, paid model call, new user selector, default native-answer activation,
source-policy expansion, user-demo mutation or automatic history deletion.
