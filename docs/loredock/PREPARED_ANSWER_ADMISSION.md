# Prepared answer admission and publication

Task 125 connects the transient owner and durable schema-11 witness to the existing
answer service. This is an internal adapter. The current browser and HTTP answer start
still use their explicit legacy input; no native-answer default or new model policy is
enabled. [ADR 0059](../decisions/0059-loredock-prepared-question-lifecycle.md) remains the
lifecycle contract, with [storage](ANSWER_WITNESS_STORAGE.md) and
[preparation](PREPARED_QUESTION_OWNER.md) retaining their existing formats and limits.

## Admission and ownership

`Answers.startPrepared(requestId, preparationId, reviewedHash)` accepts scalar identities,
never client context, prompt or native receipt content. A matching stored request returns
its original authorized attempt before inspecting current configuration, transient expiry,
replacement, shutdown or missing preparation ownership. Different bindings conflict.
Restart never automatically resumes external work. Connection/model/effort are captured
only on initial admission; the existing personal CLI selection policy is unchanged.

The preparation owner's synchronous promotion callback invokes the witness store's
transaction. Constraint or quota failure rolls back the attempt, dependency rows and
witness and leaves an otherwise current Ready snapshot usable. Successful promotion
consumes it once. The actual Answers worker and shared reservation exist before any
runtime callback. They remain reserved until cancellation and runtime cleanup finish.
There is one operation owner per exact store and no retry queue.

All Answers instances share answer and configuration reservations, including instances
without a preparation consumer. Configuration reserves before filesystem awaits and
checks its lease and stopping state after them. The optional daemon answer service owns
the preparation service; shutdown stops new work and drains answers/preparation before
native captures, paths, analysis, catalog and SQLite. Ready snapshots retain their
existing lifetime and source/review/build fences.

## Three bounded authority checks

The worker validates at three boundaries: before runtime preflight, after preflight
before model dispatch, and before publication. Each boundary uses one actual fixed
`OperationBudget` for **both** saved-witness loading and original revalidation. The final
publication boundary also accounts for the existing cited-answer validator's SQL rows
and evidence bytes through an actual `LexicalReadAccount` on that same budget. The fixed
limits remain 1,000,000 work units and five seconds per boundary; the model attempt retains
its separate 120-second wall limit. These limits can refuse an otherwise retained input.
They do not establish capacity or model-quality qualification for the complete pipeline.

Validation reopens every issued original and checks catalog identity, published source
build, policy/registry/review, complete resolution dependencies, all format/hash bindings,
the compact representation and exact prompt. It does not read current native facts,
select another path or require the old inventory. Native inventory replacement/eviction
is supported. A new source build requires a new preparation for new dispatch/publication;
already completed history remains readable with explicit staleness when still authorized.

At the validator's last authority fence, a trusted synchronous callback starts the owned
preflight/dispatch promise or publishes SQL. No asynchronous gap separates validation
from that action. Async finalizers are refused. The adapter awaits started runtime work
outside the read-only validation lifetime. Publication checks running/cancellation state
inside the transaction, validates original-only citations, checks the authority epoch
once more, then writes the result. It does not check the old epoch after its own writes.

The exact saved prompt is dispatched unchanged with the existing cited-answer schema.
Native node, edge, receipt and preparation identities are never citation IDs. Source-only
omissions, native qualifications and legacy interface priority remain intact. Missing,
corrupt, unknown-version or fenced witnesses cannot fall back to legacy generation.
Provider usage is saved before opening the final validation epoch, including late output
after cancellation, invalid citations or changed sources. Preflight/provider errors,
interrupted work, unknown usage and temporary-directory cleanup failure stay visible.

## History and compatibility

Prepared attempts expose `inputKind: "prepared-question/1"` and authorized compact context
as `nativeContext`, including omission reasons. Their base context is the exact saved
JSON. Summary responses omit content. Unauthorized history returns no context, compact
item or answer; source purge removes both derivative text stores while retaining quota
tombstones. Corrupt or unsupported authorized history fails explicitly.

Legacy attempts retain their existing fields, optional absence, context/hash/prompt and
execution body. The controlled comparison loads the preserved accepted Answers module,
independently recompiles its original source, relocates relative imports and resolves its
unchanged `@aew/ai` ESM import from the application package. Only generated IDs and
timestamps are excluded from response comparison; prompt, context and all other response
bytes are compared. This is a behavior control with current unchanged dependencies,
not an assertion that the whole old application binary is being executed.

Source/emitted controls precede implementation. Exact line deltas for five changed
modules compose with earlier historical proofs; one new worker module is added. Schema,
SQL purge/quotas, parsers, provider packages and HTTP/browser behavior are unchanged.
See [verification records](../fixtures/loredock-prepared-answer-admission/README.md).

## Next boundary

[Task 126](../../tasks/126-loredock-prepared-question-http-ui.md) connects protected HTTP
and the existing question → Find context → review → Generate flow behind an explicit
server-side experiment switch. A native preview must never submit legacy generation.
New prospective full-composition resource and semantic gates remain necessary before
prepared input becomes the ordinary opt-in answer pilot default. Existing exhausted
families and earlier resource/model results cannot qualify this implementation.
