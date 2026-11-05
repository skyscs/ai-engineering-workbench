# Task 123 — Own one bounded prepared question snapshot

Status: implemented and locally verified (898 tests, strict types and builds); exact-head CI pending.
Task 122 was accepted through identical-tree merge `7320aae`.

Implement the internal transient owner from [ADR 0059](../docs/decisions/0059-loredock-prepared-question-lifecycle.md)
and the [lifecycle contract](../docs/loredock/PREPARED_QUESTION_LIFECYCLE.md), using the
actual read/selection capabilities delivered by [Task 122](122-loredock-question-read-selection-seams.md).
Do not activate it in HTTP/UI or answer dispatch in this task.

1. Preserve current source/emitted controls and declare exact production deltas before
   editing. Keep historical manifests, raw records and exhausted inputs unchanged. Use
   separate ordinary owned development sources. No model/resource-family replay.
2. Add one per-catalog, server-owned preparation slot, reserved before the first await.
   Its states distinguish preparing, ready and a bounded terminal tombstone; no queue or
   implicit retry. Make duplicate/competing instances, cancellation, replacement, stop
   and inherited work explicit. Expose a narrow coordination boundary for later answer
   start/configuration wiring without changing legacy answer behavior in this slice.
3. Start one actual 5-second / one-million-unit OperationBudget before real lexical
   retrieval. Use the production lexical scope, complete-resolution policy and one actual
   CodePathsV2 read; no method replacement, copied producer, page enumeration or graph
   cache. Refuse an active code-analysis writer before preparation and retain final
   SQL/source/build/review fences. Idle missing inventory yields source-only context with
   an explicit omission. Failed or incomplete reads cannot publish a ready slot.
4. Port the strict compact/support/prompt composition to typed internal production code.
   Preserve the exact legacy context/hash/prompt bytes and item priority; admit at most
   one whole native item within the shared six-item / 8 KiB derived and 96 KiB prompt
   limits. Require every native support locator to be among the authorized issued originals,
   keep uncertainty and direct-topic witnesses, and never turn unrelated root-card originals
   into new model citations. Pin explicit production composition/prompt versions, distinct
   from the offline experiment; this does not enable model generation.
5. Store only one bounded, trusted immutable payload behind a random opaque ID and reviewed
   hash. Enforce the 1 MiB combined retained-preview bound and prospective 768 KiB serialized
   witness bound before ready. Use a 10-minute monotonic TTL, clear payloads on cancellation,
   expiry, replacement, source authority/review invalidation and shutdown; restart loses
   transient state. A hash or client-supplied object never grants authority. Provide a
   synchronous inspection/consumption boundary for future atomic answer promotion without
   persisting witnesses or modifying the schema yet.
6. Validate the original issued witness after genuine inventory replacement/eviction without
   current native fact/path rederivation. Reopen every original, all resolution/review source
   dependencies, current published source build and current policy/review. Preserve failures
   and original records; do not manufacture historical parser identities.
7. Verify actual compiled default/public and legacy parity, complete/partial/ambiguous/
   insufficient/missing-inventory cases, whole-item size/support omission, busy writers,
   competing instances, every cancellation phase, late writes, TTL, replacement, stop,
   retained-byte caps and witness inventory independence. Record real budget/SQL/read
   counts. Run focused/full checks, review actual runtime deltas, and require both final-head
   CI events. Scope HTTP/UI coordination and durable answer-owned promotion separately.

No source policy/indexing change, durable schema migration, answer attempt/publication,
model call, new user input, saved native receipt, corporate input or user-demo mutation.
Small ordinary checks do not qualify complete-composition capacity or semantic quality;
fresh prospective gates remain required before native generation becomes the pilot default.

The [owner contract](../docs/loredock/PREPARED_QUESTION_OWNER.md) records implemented
bounds and compatibility. [Task 124](124-loredock-answer-owned-witness-storage.md)
adds durable ownership before answer admission/publication and HTTP/UI integration.
