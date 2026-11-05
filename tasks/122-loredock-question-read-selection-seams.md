# Task 122 — Add production seams for bounded question reads and native selection

Status: accepted through PR #126 at `c5c1e4f`; push 41933384392 and pull-request
41933512176 passed all 883 tests, types and builds. Identical-tree merge: `7320aae`.
Task 121 was accepted through identical-tree merge `2519990`.

Implement only the production foundation specified by
[ADR 0059](../docs/decisions/0059-loredock-prepared-question-lifecycle.md) and the
[lifecycle contract](../docs/loredock/PREPARED_QUESTION_LIFECYCLE.md). Task 120's accepted
offline code demonstrates semantics but its copied producer and fixture method wrappers
must not become application integration shortcuts.

1. Preserve accepted source/emitted controls and exact planned deltas before editing.
   Audit all touched read methods and old reference tests. Frozen historical manifests,
   raw receipts, questions and evaluation outcomes remain unchanged. If a normal regression
   pins a now-extended method/module, document and prove the exact permitted delta rather
   than replacing the old expected hash with current output.
2. Add a trusted per-CatalogStore lexical read-accounting capability using the existing
   actual OperationBudget. Count actual returned one/all rows and Catalog.evidence UTF-8
   text, distinguish rejected/accepted charges, restore scope on exception and isolate
   stores. The supplied budget starts before retrieval. Default unscoped callers retain
   behavior; no method monkeypatching, global meter, inferred row counts or HTTP budget
   input. Nested/async/closed-scope misuse must fail explicitly without an unmetered tail.
   Keep native charges outside the lexical scope to avoid double counting.
3. Add the smallest internal typed complete-resolution selection seam to actual
   CodePathsV2, before display admission and within its one existing owner/budget. Reuse
   exact-anchor/reverse-reachability semantics as a separately typed internal policy.
   Do not add HTTP fields, root/page loops, a graph cache or selection after truncation.
   Reject conflicting explicit root/page selection. Preserve existing default, explicit
   root and root-page outputs, generation identities, receipt semantics and shared owner.
4. Verify actual compiled public/control parity on separate ordinary owned inputs. Include
   full/partial paths, direct-topic witnesses, a root beyond the first page, ambiguity,
   absent/partial anchors, cycles/traversal limits, original-support eligibility, bad
   generations, cancellation, SQL/source fences, budget ownership and competing reads.
   Compare full legacy retrieval/input/prompt bytes and real accepted row/byte charges,
   including prepared-read reuse and failing accessors. Test current/archived compatibility
   with genuine runtime identities; do not spoof fingerprints.
5. Run focused and strict checks, record first failures, reviewed source/runtime deltas and
   exact-head push/PR CI before merge. Small ordinary observations do not transfer the old
   near-limit resource qualification to a new composition. Scope the subsequent bounded
   preparation-owner task from the final result before enabling any consumer.

No ready-context slot, durable witness schema, answer/prompt changes, source indexing policy,
HTTP/UI adoption, model call, corporate input or user-demo mutation belongs to this slice.
Do not execute Task 120's exhausted library family or any earlier exhausted model/resource
set. Existing lexical answers, native public reads, saved history and source purge remain
available throughout the staged integration.

Implementation details and compatibility boundaries are recorded in
[Question read selection](../docs/loredock/QUESTION_READ_SELECTION.md).
The next bounded scope is [Task 123](123-loredock-prepared-question-owner.md).
