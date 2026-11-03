# Connected paths: consumer and saved-provenance contract

Status: design decision, Task 070, reviewed against `9476b22`, 2026-11-02.
No new answer, routing, review or storage behavior is implemented by this document.
Phases A–C are recorded in [the integration contract](CONNECTED_PATH_INTEGRATION.md).

## Decision

Keep the connected-path browser as a reading aid. Before using its derivations in durable
answers or engineer notes, qualify a bounded **immutable path receipt** offline: a record
of exactly which authorized projection and original support were issued at one point in
time. Historical display must survive disposable-fact eviction without silently deriving
a different graph. A receipt records a static derivation; it does not verify runtime truth.

Do not switch `codeFlows`, feed the browser's default pair to answers, or use displayed
roots to choose repositories automatically. Two paths and four root cards are display
selections, not a question-relevance policy or a complete account of the system. Indexing
more code does not by itself provide complete README/architecture, deployment or external
system context. Existing literal retrieval, source orientation and visible gaps remain
necessary alongside future path context.

The next task is a model-free, offline receipt/lifecycle qualification on fresh owned
inputs. It adds no production persistence, schema migration, API or new user action.
Question selection, answer semantics, new correction targets and routing have separate
gates after that qualification. Failed historical evaluations remain failed.

## Current contracts and incompatibilities

| Consumer | Current source contract | Why a direct switch is unsafe |
| --- | --- | --- |
| [Connected reads](../../apps/loredock/src/code-paths.ts) | Asynchronous, one active reader, validated compatible published inventory, generation/projection IDs, whole-path admission; root pages recompute complete bounded resolution. | No immutable history; identities change with inventories and declaration staleness. A page is not a complete relationship export. |
| [Answer context](../../apps/loredock/src/answer-context.ts) and [interfaces](../../apps/loredock/src/answer-interfaces.ts) | Thirty original spans / 64 KiB text; at most six derived HTTP comparisons / 8 KiB; complete original support must already be issued. The prompt fits 96 KiB. Publication recomputes current interface derivations. | The 512 KiB path response does not fit the model input contract. Replacing a synchronous derivation with whichever inventory finishes later changes expected in-flight inputs. |
| [Saved answers](../../apps/loredock/src/answers.ts) | Immutable context/input hash, prompt/schema/runtime identity, source dependency rows and historical status; old optional context fields stay absent. | Saved JSON must not be backfilled or rewritten with newly available paths. Mechanical hashes/citations do not establish semantic grounding. |
| [Related candidates](../../apps/loredock/src/candidate-links.ts) | Direct, original-supported cross-source clues seeded by primary lexical candidates; separate bounded pages and projection provenance. | Paths omitted from the display may contain relevant clues. Conversely, a static hop can widen scope without improving relevance. Neither a path nor absence from a path is a routing verdict. |
| [Corrections](../../apps/loredock/src/corrections.ts) | Only `code-link` and `declaration-link`; recomputed input hash, immutable bounded target snapshot, optimistic revision and affected-flow IDs. | Generation-bound path IDs cannot inherit legacy notes. A 512 KiB path cannot be squeezed into the existing 8 KiB target snapshot by dropping evidence. |
| [Reapplication](../../apps/loredock/src/reconciliation.ts) | Explicit adapter whitelist, unique logical match and exact supported semantics; current note wins; explicit user action. | Node labels or identical original lines alone do not preserve a binding when alternatives/coverage change elsewhere. Existing whitelist cannot authorize a new adapter. |
| [Inventory lifecycle](../../apps/loredock/src/code-analysis.ts) and [retention](RETENTION_DESIGN.md) | Fact inventories are disposable; original index/history dependencies have different lifetimes and purge rules. | Replaying a saved claim by fetching its old inventory will fail after normal eviction. Copying a receipt must not bypass source revocation or policy fencing. |

The production connected wire response deliberately omits full fact/resolution/binding
vectors. Its aggregate completeness counts are adequate for a qualified historical read,
but are not per-claim proofs of cross-generation semantic equivalence. Review reapplication
needs its own witness design and qualification, not a comparison of those counts.

## Receipt boundary

A receipt is server-authored from a successful **paths** read, never accepted as a client-
asserted graph. Root-page-only results are not eligible. Capture reads through the injected
CodePaths owner and reopens every issued original through `catalog.evidence`; no direct
fact-table reads, fresh parser fallback, Git, model, analysis start or database repair.
A client-supplied matching hash is not authority to persist arbitrary derivations.

The first offline format is proposed as `loredock-path-receipt/1` and contains:

- The exact complete `CodePathsAvailable` response, including identity, generation,
  projection/selection, graph, root cards, coverage, candidate status and all limitations.
  Keeping the complete envelope permits checking the recorded projection hash; do not
  strip fields and pretend the same hash validates the remaining representation.
- Every distinct original referenced anywhere in that envelope, with build/source/file/
  revision, line bounds, content and span hashes and text. Reject missing, mismatched,
  foreign-build or unsupported references. Preserve complete node/edge/flow/card support.
- The full source dependency set of the selected resolution scope, including sources
  not cited in the displayed paths. Omitted alternatives and absence-based uniqueness
  can depend on that scope. Keep registry/policy, source revisions and analysis metadata
  in the existing identity; no graph-only dependency shortcut.
- A canonical receipt hash over the format, full envelope, originals and dependencies.
  Timestamps and diagnostic timings stay outside content identity. Record exact producer
  adapter/selection/parser fingerprints rather than inferring them from a label.

Projection hashing has an existing ordering contract: `CodePaths` hashes compact
`JSON.stringify` output after removing `projectionId`, preserving the producer's property
order. Keep the exact compact projection JSON as a string/byte field inside the receipt;
validate a parsed copy without sorting or rewriting that field. The receipt's own canonical
hash covers those exact bytes plus canonically ordered originals/dependencies. Do not
recursively canonicalize the stored projection and then expect the old projection hash to
match. Include a JSON round-trip/order case in the next oracle. Nested JSON escaping counts
toward the complete receipt size bound.

Prospective ceilings for the offline task: the unchanged **512 KiB** projection envelope,
**30 distinct original spans**, **64 KiB UTF-8 original text**, and **640 KiB serialized
receipt**, all measured on the complete representation. These are admission bounds, not
new API/prompt allowances. Escaping and metadata count toward serialized bytes. Admit the
whole receipt or return an explicit limiting reason; never trim citations, qualifications,
root cards or paths to force it to fit. A receipt fitting these bounds still does not
qualify as an answer input. The next task must freeze these limits before observations.

The wider read's own caps, five-second cooperative deadline and one-reader ownership stay
unchanged. Receipt capture must have its own bounded work/deadline accounting including
original reopening; it cannot reset the path clock and describe only half the work.
Freeze total wall/work checkpoints before implementing that experiment. A cooperative
limit is not a hard process timeout.

## Capture, history and freshness are different operations

| Operation | Required behavior |
| --- | --- |
| Capture a new receipt | Resolve authorized compatible facts, reopen full support, check projection and original identities, then recheck registry/policy/inventory/metadata immediately before publication. Any interleaving write/scope change discards the pending artifact. No success file or partial graph on failure. |
| Read recorded history | Verify the receipt shape/hash and all retained original support under current authorization. Do not require the evicted fact inventory, rerun matching or replace the receipt. Mark it recorded static context, not current knowledge. |
| Compare with current context | Derive a separate current projection. Missing facts, changed generation/adapter, unsupported matching or ambiguity are explicit states; historical readability alone never implies current equivalence. |
| A newer inventory publishes | A pending capture may fail its conservative fence. A fully saved receipt keeps its original bytes; replacement does not rewrite it. New current previews use a new identity. |
| A new index publishes with the same registry | Historical content can remain readable and visibly older. Declaration staleness can change newly derived generations without invalidating an already recorded envelope's hash. |
| The registry grows | In-flight capture is fenced. Previously recorded history may remain readable under the existing authorization policy, but is stale and cannot stand in for current scope. |
| Any dependency is revoked or policy changes | Discard in-flight work and fence whole recorded content. A source outside the displayed path can still be a dependency. Future storage must join the existing purge/retention rules; no receipt copy may restore revoked text. |
| An original or receipt is corrupt/missing | Explicit unavailable/integrity failure. Do not repair from current code, recompute under a new parser, or return surviving fragments as the same receipt. |
| The parser/adapter changes | Historical display may read a supported frozen receipt format without claiming revalidation under the new parser. New derivation requires compatible facts. Unknown receipt versions fail closed; cross-adapter reapplication stays unsupported. |

For a future durable writer, successful asynchronous resolution is only preparation.
The write needs an atomic final validation under catalog ownership/transaction boundaries,
including inventory/manifest/metadata and registry/policy dependencies. A digest obtained
before an `await` is insufficient. The offline task must expose and exercise this handoff
before any production schema design. Idempotency, all-source purge dependencies, retained
byte bounds and crash recovery must be designed for the eventual owning artifact, not a
new unbounded global graph store.

An externally supplied receipt file is not a trusted stored artifact. Shape/hash integrity
alone cannot certify a graph because an attacker can recompute an unkeyed hash. The first
prototype only reads its own captured files and validates originals; it must not expose an
import API or treat an imported derivation as an approved claim. Hashes are integrity and
identity within the local trusted producer, not signatures or evidence of semantic truth.

## Consumer rollout decisions

### 1. Offline receipt and lifecycle foundation

Qualify capture/history/eviction/corruption/scope behavior without a production consumer.
Keep artifacts separate from the application store and record all first outcomes. The
qualification is structural, not a new semantic score. A pass permits a separately scoped
production design; it does not authorize every later consumer automatically.

### 2. Question-scoped context, before model exposure

A separate prospective offline comparison must define how original question evidence
selects useful path fragments across the complete bounded resolution. The browser's two
default roots, displayed nodes and four-card page cannot be its search universe. Do not
request every root/page to evade read/work limits. If the needed relationship cannot be
selected within one qualified bounded operation, return insufficient context.

First test support admission while keeping original retrieval and primary candidates
unchanged. A derived item enters answer context only if **all** original support is already
issued. Keep original spans and engineer notes when derived items do not fit. Preserve
candidate/unknown qualifications and header clues outside the selected paths. Any later
retrieval expansion is another versioned policy with separate precision/recall/scope
acceptance; it cannot be justified merely by a larger graph.

The answer representation must be smaller than the archival receipt, independently hashed
and tied to it. Do not put receipt metadata, root catalogs or internal IDs into explanatory
prose. Retain the existing 30-span/64 KiB text, 96 KiB prompt and original citation limits
unless a new task explicitly qualifies different bounds. UI should explain issued coverage
without adding provider or graph-budget fields to the normal user flow.

A new prompt/context schema must pin exactly the issued receipt/selection. Starting an
answer compares its reviewed input; publishing verifies the same issued evidence and
review revision rather than resolving the latest inventory. New inventory publication
alone must not reinterpret an in-flight answer. Source/policy/registry changes still fence
pending work. Old contexts keep their byte shape, adapter derivation and optional-field
absence. Historical reads distinguish recorded context from current applicability.

Before any real-model run, freeze a fresh corpus, questions, required/forbidden claims,
complete-support rubric, model/runtime/prompt identity and an explicit attempt/cost budget.
No attempt from Tasks 027, 030 or 034 is reusable. Agent scoring is not independent/private-
pilot acceptance. New production answer semantics require the applicable review gate.

### 3. Engineer notes with a new target namespace

Future connected notes need a distinct target kind and immutable target witness; do not
alias it to `code-link`. Initially permit historical inspection and new explicit notes
only. No automatic migration/reapplication of legacy notes, and no claim that a note
makes a candidate hop a verified runtime connection.

Reapplication requires a separately qualified unique logical match, exact source support,
edge direction/kind/status/reason/environment, all gaps and relevant completeness/alternative
witnesses. Same labels, hashes of cited lines or empty omission counters are insufficient.
A new unseen alternative must prevent automatic equivalence even if displayed support did
not change. Source and adapter changes, oversized witnesses, missing facts and ambiguous
matches remain unsupported/needs-review. The current note always wins; reapplication
remains an explicit user action with revision/idempotency fencing.

Affected-path review cannot enumerate only the two displayed flows. Define dependency
invalidation independently of display selection before claiming all affected answers or
paths are marked. This requirement blocks simply reusing legacy `affectedFlowIds`.

### 4. Related reading before routing or Workbench

Only after a fresh candidate-selection qualification consider connected clues in the
existing optional related-reading area. Compare critical-owner recall, useful source-set
size, counterexamples and abstention across all cases. Keep Other matches and visible
unavailable/ambiguous states. More reachable repositories are not automatically better.

Autonomous repository routing and the Workbench bridge still require the applicable L5
independent/private-pilot gates. No synthetic receipt/CI/browser pass satisfies those gates.
Workbench continues to use its existing explicit context and authorization flow meanwhile.

## Next offline qualification: required cases and stop rules

The next task must commit fresh synthetic input bytes, expected relations/support and a
one-run observation protocol before candidate implementation. Keep the oracle independent
of resolver output; disclose that it is agent-authored, not blind external assessment.

Required families:

1. Default and selected-root receipts, including an isolated root, complete candidate
   support, unknown runtime scope and repeated stable capture identity.
2. Missing/unpublished/incompatible inventory, root-page rejection, busy/cancellation,
   unknown versions, malformed envelopes and each count/text/serialized/work/time bound.
3. Retained history after eviction and restart without Git, parsing, analysis or store
   writes; unchanged bytes after newer inventory/index publication.
4. Tampered envelope, generation/projection/receipt hash, original text/hash/range, foreign
   build and missing support. No partial receipt on capture/read failure.
5. Metadata, manifest, original, registry and policy changes during each yielding stage
   and at the final capture handoff. Revocation of both cited and uncited scope sources.
6. Changed alternatives with identical displayed originals. Historical content remains a
   recorded derivation while current equivalence is unknown/changed; no legacy-note transfer.
7. No old answer/correction/context-byte changes, parser changes, candidate-policy changes,
   extra model requests or writes outside explicitly instrumented fixture lifecycle hooks.

Freeze hard safety assertions and resource thresholds separately from useful-success
cases. Failed assertions reject promotion; preserve the first failure, stderr and exit
status. Do not revise an oracle or repeat a failed frozen matrix to manufacture a pass.
A successor needs new prospective scope and independently authored cases. Do not rerun
Tasks 034, 044, 048, 062, 063, 065 or 067 or relabel any historical gate.

Task 070 does not freeze a corpus, allocate model attempts, run this qualification or
claim a receipt implementation. Its output is this decision and the next-task boundary.

## Task 071 outcome

The first [offline receipt qualification](../fixtures/loredock-path-receipts/README.md)
failed its frozen gate (86/88 cases), so this design is not promoted to production storage.
The useful path stops at publish because the existing resolver's topic-setting profile
requires the exact `orderTopic` key. A separate harness lookup conflates a same-label
handler reference and symbol, preventing the changed-alternative history assertion.

Other integrity/lifecycle/resource evidence is retained, without relabeling the failures
or rerunning the matrix. Next: a separately scoped topic-evidence contract and fresh
qualification with typed oracle identities and early raw-observation journaling. No new
answer/review/candidate adapter or model budget follows from the experiment.

Task 072 records the [successor topic-evidence contract](EVENT_TOPIC_EVIDENCE.md). The
fresh offline comparison must use explicit direct literals, preserve contract/consumer
completeness and original support, and identify its changed derivation separately. Dynamic
expressions remain unknown. A complete useful path and a valid typed observer are mandatory
alongside receipt integrity; the earlier shortened-path resource pass is insufficient.

## Task 073 outcome

The [fresh literal-topic qualification](../fixtures/loredock-literal-topics/README.md)
passes 134/134 cases and 10,793 counted assertions. Complete literal-based paths, typed
alternative history and receipt integrity pass with explicitly versioned offline identities.
Dynamic expressions abstain as designed. All 113 successful small-family resource readings
meet bounds; raw results and the observer's generic unknown-gap limitation remain recorded.
Next: fresh twenty-source/near-limit resource review before production integration. Existing
production adapters, historical bytes and semantic/private-pilot gates remain unchanged.

Task 074's [resource contract](CAPTURE_RESOURCE_CONTRACT.md) requires a shared operation
budget before the next scale qualification. Independent layer counters are not an aggregate
capture ceiling. This adds no production consumer or historical migration.

Task 075's [first scale result](../fixtures/loredock-capture-scale/README.md) rejects
promotion on memory despite complete first captures through 9,980 files. The shared budget
does not itself guarantee acceptable allocation or process residency. Diagnose the memory
boundary separately and qualify a fresh successor before adding production consumers.
Earlier failed gates and unexecuted assertions remain recorded.
