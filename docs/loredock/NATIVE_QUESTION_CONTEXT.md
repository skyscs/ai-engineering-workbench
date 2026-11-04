# Native connected paths as project-question context

Status: Task 119 prospective design. No production answer, prompt, retrieval, runtime or
storage change. [ADR 0058](../decisions/0058-loredock-native-question-context.md) records
this boundary. Task 118 / PR #122 passed both exact-head CI events at `c59a792` and merged
as identical-tree `883b589`; saved-path discovery is now available.

## Source audit

| Existing boundary | Current behavior | Consequence for native context |
| --- | --- | --- |
| [Retrieval](../../apps/loredock/src/answer-context.ts) | Synchronous retrieval v7; at most 120 candidates, 30 originals and 64 KiB original text. Source orientation, missing-source and deployment gaps remain visible. | Native relevance cannot replace README context or turn omitted originals into evidence of absence. Keep the issued originals, order and retrieval policy unchanged in the first comparison. |
| [Interface admission](../../apps/loredock/src/answer-interfaces.ts) | Legacy `codeFlows` HTTP clues require complete issued support, at most six comparisons / 8 KiB, then fit within the complete prompt. | A native graph is not automatically an eligible answer input. Preserve legacy header clues outside a selected native path; do not replace `codeFlows` globally. |
| [Prompt](../../apps/loredock/src/answer-prompt.ts) | Version 9; 96 KiB complete rendered prompt. Original IDs alone are valid citations; derived and human statements remain untrusted. | A 512 KiB projection or 640 KiB receipt cannot be appended wholesale. No model call or new production prompt is part of this design. |
| [Answers](../../apps/loredock/src/answers.ts) | Preview/start are synchronous; start recomputes context and compares its hash before reserving a worker. Immutable context is saved with source dependencies. | An asynchronous path read cannot simply be inserted into start: reserve ownership before awaiting, then bind preparation to exactly the reviewed input. This needs a separately reviewed integration. |
| [Publication validation](../../apps/loredock/src/answer-context.ts) | Reopens every issued original, checks source/policy/review state and recomputes legacy interface context. | New native context must validate its issued witness, not derive whatever inventory is latest when the model finishes. Legacy inputs keep their current validation and exact bytes. |
| [Native reads](../../apps/loredock/src/code-paths-v2.ts) and [admission](../../apps/loredock/src/code-paths-v2-admit.ts) | One owned asynchronous read resolves the complete bounded inventory, then admits two default roots or one explicitly pinned root. Four root cards are presentation only. | There is no question selector today. A selector belongs between complete resolution and display admission, under that same operation budget; repeatedly reading pages/roots is not a substitute. |
| [Native history](../../apps/loredock/src/native-capture.ts) | Whole projection, exact originals and all source dependencies survive inventory eviction; every read reauthorizes them. | Current-scope question preparation must not pick an arbitrary saved record or treat authorized history as current applicability. Existing history remains a separate explicit recorded view. |
| [Review notes](../../apps/loredock/src/answer-review.ts) | Notes overlap issued source evidence; old relationship identities and correction revisions stay explicit. | Preserve selected notes but do not attach legacy note IDs to new native relationships or assert that overlap validates a native binding. |

The [existing consumer contract](CONNECTED_PATH_CONSUMERS.md) already requires complete
bounded-resolution selection, unchanged original retrieval for the first admission
comparison and a separately qualified compact representation. Task 119 makes that next
experiment concrete; it does not reopen earlier failed model or resource evaluations.

## Chosen next slice

Compare one **question-selected static path** against the unchanged source-only answer
context and existing legacy interface block, entirely offline. This is a useful reading
clue within issued evidence, not a new system summary, repository router or root cause.
Keep the original context's spans, text, order, source vector, review notes and input hash
as an independently retained baseline. Do not expand retrieval or discard originals to
improve the candidate's score. Report insufficient support explicitly.

| Approach | Decision |
| --- | --- |
| Append the two default browser paths | Rejected: display order is not relevance and misses the late-root case. |
| Search the list of saved receipts | Rejected for automatic current questions: storage history is neither a complete search universe nor a current source vector. An explicit historical-question mode would be a separate feature. |
| Resolve every root through repeated public reads | Rejected: repeats complete work and resets ownership/budgets. |
| Change lexical ranking to reserve path originals | Defer: changes source recall and source-scope precision before support admission is understood. |
| Select one root from the complete native resolution, then admit only a fully supported compact path | Chosen for the offline comparison, with explicit ambiguity and omission. No production switch is authorized by the design. |

## Selection and support policy to compare

The candidate receives the actual immutable lexical context and question, the same index,
and one complete native resolution built from compatible published facts. It cannot read
an oracle, expected source name, fixture label, saved-list order or model answer. It must
inspect all eligible roots within the existing bounded resolution, including roots beyond
the first four cards. Do not expose the full resolution to HTTP or retain a global graph.

Use exact source identifiers/literals as anchors: an identifier bounded as a whole token
in the question can match a symbol label; a complete HTTP method/path pair or direct topic
literal can match its supported operation. Matching a source display name, file basename,
generic `POST`, `Kafka` or a partial topic string alone is not a path anchor. Use literal
strings as data, never regular expressions or instructions supplied by the source.
An anchor must have issued original evidence. All matching identities remain candidates;
matching labels do not collapse different sources or methods.

Find roots that reach an anchored node through the existing directed static/candidate
edges. Reverse reachability is bounded and charged to the same budget; cycles are visited
once and unresolved/ambiguous bindings cannot be invented. Use the existing 1,000 traversal
ceiling for this selection, with the path admission's existing limits still enforced.
If the traversal cannot finish, return an explicit selection-limit result, not the first
root observed. No anchor means insufficient context. More than one eligible root means
ambiguous context with zero admitted flows; do not silently choose alphabetical order.

For exactly one eligible root, use the existing deterministic whole-path admission for
that root. Its omitted branches, candidate statuses, incomplete bindings, literal-topic
witnesses and environment gaps stay intact. This does not assert that the chosen deepest
static path is the complete behavior requested by the question. The comparison measures
that limitation rather than changing branch selection after observing the oracle.

Require the union of all node, edge, flow and witness original IDs for that selected path
to exist exactly in the issued lexical spans. Compare build/source/revision/path/range/
content/span hashes and text through catalog authorization. Same text or overlapping lines
under a different ID do not count. Missing even one required original omits the **whole
path** from the candidate input. Unrelated root-card originals may remain in the archival
receipt but never become additional issued answer evidence.

Keep one path at most and preserve every status/reason/gap/header/topic qualification.
The new compact item and retained legacy comparisons share the existing six-item / 8 KiB
derived allowance. Existing comparisons have priority; no header clue is silently removed
to fit a path. If a duplicate relationship is identified by exact semantics and complete
support, report it explicitly; no label-only deduplication. For this first comparison,
conservative duplicate omission is preferable to treating two representations as new facts.

Fit the complete experimental prompt representation within 96 KiB, including existing
instructions, originals and engineer notes. Omit the entire native item on overflow;
never trim its support, limitations, source spans or notes. The production v9 renderer and
prompt version remain unchanged. An offline renderer must identify its own version and
include all added instructions/data in its measured size; no model dispatch is permitted.

## One preparation operation and immutable provenance

Start one actual `OperationBudget` before lexical preparation; use its unchanged five-second
/ 1,000,000-work ceilings through resolution, selection, original validation, compact
serialization and final handoff. Never construct a fresh budget for a candidate/root or
hide baseline retrieval before the clock. Existing lexical limits also remain in force.
Charge actual returned baseline rows and original UTF-8 bytes through a trusted fixture
adapter, then use existing native charges on the same budget; record those phase totals
separately and avoid substituting estimated file counts. Record the complete outer wall
time and event-loop observations, including synchronous legacy retrieval. If a cooperative
boundary cannot cover the composition, reject the feasibility gate and scope the missing
integration instead of weakening the claim.

Own one request from admission to completion, with real cancellation, busy refusal and
shutdown. Final synchronous checks bind catalog UUID, published build, policy/registry,
source revisions, review revision, compatible inventory/manifest/parser and native
selection identity. All resolution sources are dependencies, including ones without a
selected path node. For this first current-scope experiment, a stale published build or
source vector refuses preparation. Requested unavailable/incompatible/evicted inventory
cannot fall back to saved history or a newer inventory.

Retain the exact candidate projection and full native receipt as **offline artifacts**,
using the existing strict native codec and source authority. The compact result has its
own version/hash and names its exact receipt/projection, selected flow, selection-policy
version, unchanged lexical input hash, question and complete source vector. Its schema
must not be mislabeled as either an existing receipt or a production AnswerContext.
A hash alone is not permission to accept a client-authored graph.

The offline runner may reuse actual emitted resolver/admission/codec helpers in a separate
candidate composition. Record every candidate source/runtime dependency and copied or
relocated orchestration byte; do not claim that an offline driver is the unchanged public
producer. Retain the actual public producer as an independent control. The experiment
must demonstrate one complete operation, not aggregate separately capped page reads.
Any later production seam needs its own parity, ownership and resource review.

A future prepared-answer owner must retain enough trusted witness material to validate
exactly the reviewed context after ordinary inventory eviction. Do not automatically fill
the 64-record user-saved history as a side effect of preview. Durable witness placement,
request-token/idempotency semantics, retention and source purge need a separate integration
decision after feasibility. Requiring the latest inventory at model completion would
violate the issued-input contract; silently backfilling old answer JSON is also forbidden.

## Prospective inputs and evaluation protocol

The [owned library fixture](../../fixtures/loredock-native-question-context/README.md)
contains six repositories, six irrelevant Vue roots before the loan-return root, Java
HTTP/publisher/consumer and Mongo interfaces, a Dojo module, README context and untrusted
source instructions. Four fixed variants cover base, an overlapping topic/root, an
unrecognized consumer method and a dynamic topic expression. There is no corporate code.
Factory, generated file-vector hashes and [questions/oracle](../../fixtures/loredock-native-question-context/questions.json)
are frozen before candidate implementation. Authoring uses known supported parser idioms;
this is agent-authored mechanical evaluation, not blind external or semantic acceptance.

Evaluate all seven fixed questions, plus every boundary group in the oracle. Keep raw
baseline context, current public default projection, complete candidate observation,
receipt, compact input, all original locators, work/time/resource/counter results and
process exit before judging them. The two positive cases require the typed return path,
all exact supporting originals already issued and at most three path sources. The late
root must be outside the first four cards; an observed parser or retrieval omission is a
failed required condition, not an excuse to rewrite the question or expected shape.
Ambiguity and unrelated questions admit no path; missing/dynamic wiring preserves the
explicit partial endpoint and gap without inventing delivery. All six dependencies remain.

Boundary groups cover removed support, full prompt/derived budgets, foreign identity,
inventory availability/eviction, stale vectors, source/policy changes including an unseen
dependency, cancellation/busy/work/time/shutdown and immutable issued witnesses. Use
explicit controlled valid inputs for support/size boundary tests and label them separately
from unchanged real-retrieval outcomes. Never add a missing span to make a positive
retrieval case pass. Freeze all concrete subcase IDs and hooks before executing the matrix.

Keep functional integrity, relevance/scope, complete-support recall, operation bounds and
lifecycle results separate. A strict promotion decision requires every required case and
boundary group to pass; there is no averaging away a missing consumer or extra repository.
Zero application/source/Git writes, parser fallback, automatic analysis, model/external
requests and changes to legacy answer/correction bytes are mandatory during preparation.
Owned fixture setup/indexing and raw artifact writes are recorded outside that operation.
Record file/source/fact counts rather than pretending this six-source case is a 20-repository
or near-file-limit qualification. Use no exhausted resource corpus.

Task 120 implements and tests the harness on separate disposable development cases before
one complete observed run of these frozen inputs. Retain the first outputs on failure or
interruption. Do not tune and rerun the frozen matrix; a successor requires prospective
new scope. No real-model budget is allocated. Production integration, new prompt/schema,
semantic evaluation and independent/private-pilot acceptance remain later gates. The
Workbench bridge still waits for the LoreDock knowledge-ready gate.
