# Task 121 — Design immutable native question preparation and witness ownership

Status: accepted through PR #125 at `896e484`; push 41929457581 and pull-request
41929516141 passed, followed by identical-tree merge `2519990`. Task 120 / PR #124 passed both CI
events at `647efad` and merged as identical-tree `4bbc0c1`. This is a source-backed architecture/lifecycle task, not production
implementation or a new model/evaluation run.

The [sole Task 120 comparison](../docs/loredock/NATIVE_QUESTION_CONTEXT_RESULT.md) passes
all 44 mechanical cases, including late-root selection and unchanged issued originals.
Current Ask Project still performs synchronous lexical preview/start and validates legacy
interfaces. It cannot safely adopt an asynchronous native producer by appending an await
or by picking the latest graph at answer completion.

1. Audit actual answer request ownership, worker reservations, immutable input/history,
   correction/source dependencies, startup recovery, retention and purge. Explain the
   product transition using one question and a reviewed preview; do not expose inventory,
   generation, root, parser or budget configuration as new ordinary user inputs.
2. Define a separately versioned native preparation lifecycle and exact reviewed-input
   token. Reserve ownership before awaiting; make busy/cancel/shutdown, duplicate start,
   expired/stale input and source/review changes explicit. Pin one complete operation,
   final synchronous admission, source scope and native identity. Decide precisely what
   survives daemon restart and which transitional work is cancelled or unavailable.
3. Choose trusted witness storage and bounded retention/purge independently of user-saved
   receipts. Define when an issued witness becomes answer-owned, how immutable answer
   publication reauthorizes originals after inventory eviction, and how incomplete writes
   and source revocation recover. A hash or client-supplied graph is not authority.
4. Preserve old AnswerContext/prompt/hash/history semantics. Define a new optional consumer
   boundary, deterministic compact/prompt versioning and production parity checks before
   enabling native answers. Missing/ambiguous/oversized native context must preserve the
   existing useful source context and explain the omission. Never silently replace reviewed
   input at start or completion, transfer legacy corrections or increase fixed bounds.
5. Compare a few concrete lifecycle/storage alternatives, select the smallest complete
   path, record an ADR and scope implementation/compatibility tests. Define separate gates
   for the production producer seam, durable preparation/witness handling, HTTP/UI adoption,
   and any new prospective semantic/model qualification. Avoid bundling all into one PR.

No application/schema/prompt/runtime change, source indexing, corporate input, model call
or replay of an exhausted family belongs to this task. Keep Task 120 raw evidence and
all earlier failed semantic/resource gates intact. Agent-authored mechanical acceptance
and merging do not establish independent product or LoreDock knowledge-ready acceptance.

Completed in the [lifecycle contract](../docs/loredock/PREPARED_QUESTION_LIFECYCLE.md)
and [ADR 0059](../docs/decisions/0059-loredock-prepared-question-lifecycle.md). The selected
model keeps one transient reviewed snapshot and promotes it atomically to answer-owned
versioned storage on explicit Generate. Production read/selection capabilities are the
next bounded implementation, [Task 122](122-loredock-question-read-selection-seams.md).
No current production behavior or schema is changed by this design.
