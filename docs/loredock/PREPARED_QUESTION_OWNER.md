# One owned prepared question snapshot

Task 133 adds [versioned format v2](../decisions/0061-loredock-native-question-format-v2.md)
to the integrated owner described below. New preparations use `native-question-item/2`
and `loredock-prepared-answer-v2`; saved v1 data selects its exact old serializer and
prompt. Lossless references share matching immutable legacy headers and lexical binding.
The composition, selection, witness schema and all limits remain unchanged. The Task 123
description and original version table below record the initial internal implementation;
HTTP/answer integration is described in [the current API contract](PREPARED_QUESTION_API.md).

Task 123 implements the internal transient service specified by
[ADR 0059](../decisions/0059-loredock-prepared-question-lifecycle.md), on top of the
[production read/selection seams](QUESTION_READ_SELECTION.md). It is not wired into
HTTP, the browser, answer dispatch or schema migration. Default application behavior
and every preexisting application source/emitted module remain unchanged.

## Ownership and user intent

`QuestionPreparations.start(requestId, question)` reserves one slot for the exact
CatalogStore before the first await and uses the current published source index. The
caller supplies no repository, root, inventory, parser or resource limit. Duplicate
request IDs return their existing bounded state when the question matches; different
content conflicts. A new explicit request replaces a ready snapshot, while concurrent
preparation, answer/configuration reservations and active analysis return busy. The
service does not start analysis, queue requests or retry automatically.

The owner retains one active/ready record and one small terminal record. Get/review
returns detached data; caller mutations cannot change the held context. Cancel, replace,
stop and source boundary callbacks release payload references. Ready lifetime is ten
minutes from the final handoff using monotonic time, with both a timer and access-time
checks. Review edits/current published source-build changes are checked before every
ready access even without a mutation callback. Inventory replacement alone is allowed.
Restart loses every transient ID and requires explicit preparation.

Configuration reservations expose a post-await validity check and idempotent release.
Synchronous `promote` gives a future answer transaction the exact immutable context and
witness strings, reserves answer ownership, consumes Ready only after callback success,
and returns a release capability for the later worker. Callback failure keeps Ready;
async results are refused. These are trusted internal adapter contracts, not a client
callback or a promise of database atomicity before the storage adapter exists. Existing
Answers consumers are not coordinated by these capabilities until their integration task.

## Preparation, bounds and omissions

One actual five-second / one-million-unit OperationBudget starts before real retrieval.
Scoped lexical accounting uses the actual Store/Catalog methods, with prepared statement
reuse limited to that synchronous lexical phase. Exactly one actual CodePathsV2 read
selects a supported root from the complete bounded resolution. Native charges occur after
the lexical scope closes. Every original and the full resolution/review source union are
reauthorized; final SQL/source/build/review/ownership checks precede synchronous publication
of ready bytes. The owner writes no SQL, native receipt or source file.

The typed compact renderer preserves the offline exact-anchor/support semantics with
separate production versions:

| Component | Version |
| --- | --- |
| Prepared composition | `loredock-prepared-question/1` |
| Native compact item | `native-question-item/1` |
| Prepared prompt | `loredock-prepared-answer-v1` |
| Internal witness | `loredock-prepared-witness/1` |
| Selection policy | `exact-anchor-reachability/1` |

The base context, original order, input hash, engineer notes and legacy prompt v9 remain
unchanged. At most one complete native item fits after existing comparisons within the
shared six-item / 8 KiB derived bound and 96 KiB rendered prompt. Missing support, derived
or prompt overflow omits the entire item. A valid native projection with no admitted
complete flow also yields the explicit `no-complete-path` omission, keeping useful source
context. This completes the lifecycle contract's display-omission case; the frozen offline
renderer instead refused zero flows. No old experiment is rewritten to claim that behavior.

Missing idle inventory, ambiguity and insufficient anchors produce source-only context
with explicit reasons. Integrity, cancellation, concurrent writers and stale authority
fail preparation. All original support stays among the issued source spans; unrelated
root-card originals are validation material, never additional model citations. Static
uncertainty, header qualifications, literal-topic witnesses and overlapping legacy clues
remain explicit. Exact anchors are not general natural-language relevance or completeness.

Ready content is held as immutable context/witness JSON strings. The witness includes the
complete native receipt when present, compact item/omission, selection observation, source
union and exact prompt/version/hash. It is pre-serialized under 768 KiB before Ready. The
combined serialized owner content and reviewed hash reserve another 1 KiB for bounded
slot/tombstone scalar metadata and must fit 1 MiB. These are serialized retention bounds,
not claims about JavaScript heap overhead. Actual serialization bytes consume the shared
budget. A size failure cannot first appear after the user reviews the ready snapshot.

## Reauthorization and compatibility

`validateQuestionWitness` accepts trusted server-held bytes, not client graphs. It checks
versions, binding hashes, complete serialized bounds, exact native receipt/compact/prompt
agreement, every original, current source/build/policy/review and full dependencies. The
source-only reasons and selection observations must agree. Native inventory IDs, facts
and path derivation are never reread. Legacy interface comparisons keep their own validator
under a separately scoped lexical account on the same validation budget. Current parser
or inventory replacement cannot silently replace the issued native derivation.

[Accepted controls](../../apps/loredock/tests/fixtures/prepared-question-reference/README.md)
preserve 154 existing source/emitted/control files before implementation. The new service
adds four internal modules; all prior application files remain byte-identical. Separate
ordinary compiled checks cover genuine receipt encoding, full/partial/source-only paths,
actual six-comparison size omission, actual display-property omission, mutation isolation,
idempotency/busy/cancel/stop, every preparation cancellation phase, TTL, restart, rollback,
late writes, both retention caps, corrupted witnesses and actual inventory eviction with
zero new native reads. Pure renderer limit tests additionally vary internal metadata;
they are not retrieval hooks or an end-to-end capacity claim.

[Verification records](../fixtures/loredock-prepared-question-owner/README.md) retain first
failures and final validation. No corporate source, model call or exhausted evaluation
family was used. A fresh complete-composition resource/semantic gate remains outstanding.
Next [Task 124](../../tasks/124-loredock-answer-owned-witness-storage.md) supplies atomic
answer-owned storage, purge/recovery and quota handling; answer admission/publication and
HTTP/UI follow before native context can become an actual model input.
