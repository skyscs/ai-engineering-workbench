# Recover qualification preparation and independent evaluation

Task 082 remains rejected and exhausted. This contract changes future preparation
and offline evaluation, not its inputs, scores, consumer semantics or resource
limits. The streaming snapshot candidate remains unqualified.

## What failed

The [retained run](../fixtures/loredock-streaming-qualification/README.md) executes
all 32 operations. Its generated consumer is `onIssued`, but the preserved
[resolver](../../scripts/loredock-capture-scale/resolve.mjs) indexes a consumer only
when its method is `onMessage` with one matching record parameter. The
[topic contract](EVENT_TOPIC_EVIDENCE.md) explicitly preserves this prerequisite.
All 21 facts are retained; the reader emits `unresolved-consumer-method` and stops
the useful path at publication. Expecting a complete write-ending path was an
authoring error, not an established snapshot regression.

The [coordinator](../../scripts/loredock-streaming-qualification/coordinator.mjs)
adds a receipt to its comparison map only after the entire useful-path validator
returns. A useful-path failure therefore prevents later repeat/history/parity
checks from seeing otherwise valid saved bytes. Four history checks dereference
an absent first value; qualified parity has no first comparison input. Separate
artifact readback confirms matching raw bytes and histories, but cannot replace
those original failed evaluations or make incomplete paths useful.

Independent failures remain: 66.666 MiB isolated heap growth and 397.477 MiB history
RSS in the large same-process lifecycle exceed unchanged 64/384 MiB limits. The
preflight error is not an explanation or waiver for those failures.

## Compatibility review before freezing resource inputs

Before freezing a new positive resource family, record a short capability table
in its protocol. Link each required path segment to the pinned supported adapter
rule and the exact authored source construct. Review semantic names as well as
syntax; a fresh domain name does not make every renamed method interchangeable.

| Required segment | Minimum compatibility evidence to review |
| --- | --- |
| Vue/TypeScript entry and HTTP client | Supported named action/import/call shape, literal method/path and header names; no inferred dynamic target. |
| Declared route and Java handler | Exact supported route/handler declaration, class/method identity and complete relevant Java domain. |
| Publisher and subscriber | Supported receiver/interface/call shapes, equal direct topic literals, exact record shape and scoped JSON contract expectations. |
| Subscriber consumer | Supported `onMessage` method in the declared handler class, one matching record parameter, matching document write and no competing supported consumer. |
| Complete output | Intended terminal kinds, required nodes, complete original/dependency sets, root order/selection and gap expectations derived from authored source. |

Use [binding completeness](BINDING_COMPLETENESS.md), [topic evidence](EVENT_TOPIC_EVIDENCE.md)
and the pinned parser/resolver as the authority. Record unresolved compatibility
questions before the freeze. If a required construct is outside the supported
profile, stop resource-family preparation: either keep that case as an explicitly
negative gap case or scope adapter work separately. Do not promise complete output
from an unsupported construct, silently widen a rule or discover expectations by
executing the future qualification corpus.

Independent tiny development regressions may exercise a new harness/adapter before
the fresh family is authored. They are not blind acceptance. The final resource
family still freezes exact bytes, original-supported expectations and limits before
parser/candidate observation. A post-freeze mismatch remains a failed exhausted
family; a renamed replacement is not a repair of its score.

This is a review artifact for the next author, not a generic framework or a new
application input. No corporate source or model is needed for compatibility review.

## Evaluation dependencies

Keep original artifact references, raw bytes and resource observations before
assertions. A future offline evaluator must report these dimensions separately:

| Dimension | Depends on | Meaning |
| --- | --- | --- |
| Artifact integrity | File availability, declared byte length and hash | The evaluator is inspecting the recorded bytes. |
| Shape and canonical identity | Intact artifact, valid encoding/schema/canonical hashes | The return can be safely interpreted as a receipt/projection/history record. |
| Original support and scope | Valid shape, frozen source/metadata identities | Every cited original and dependency resolves to the declared source vector. |
| Useful-path expectations | Valid shape and source support, frozen positive/negative oracle | Required typed paths, terminals, coverage and relevant gaps match the scenario. |
| History consistency | Independently valid history and first receipt shapes | History preserves the recorded first projection, originals and dependencies after the declared eviction, with no nested read work. |
| Raw byte parity | Intact corresponding artifacts | Processes/repeats returned identical bytes; equality alone says nothing about usefulness. |
| Resources and no-write counters | Finite observations and declared limits | Time, heap/RSS, intervals, work, output and mutation checks pass independently of content. |

Retain hash-valid raw comparison bytes immediately. Retain a structurally valid
first receipt before testing its useful-path expectations. If usefulness fails,
still evaluate support, repeats, raw parity, history and resources wherever their
actual prerequisites exist. Do not suppress useful-path failures or treat a
matching incomplete history as a successful complete flow.

Use explicit `pass`, `fail`, `blocked` and `not-applicable` states with reasons.
For example, malformed first-receipt JSON blocks a structural history comparison
with `first-receipt-shape-unavailable`; it must not become an undefined-reference
exception. A missing/hash-invalid artifact blocks byte comparison. Raw parity may
still compare intact opaque bytes whose schema is invalid, but must be labeled
as byte equality only. Missing observations are never passes, and failures in one
dimension must not prevent independent dimensions from being evaluated.

The overall gate remains strict: every applicable planned integrity, support,
usefulness, history, resource and lifecycle condition must pass, with no blocked
required condition or process/cleanup error. Record denominators per dimension;
do not replace the rejected run's original aggregate with a new interpretation.
Only a future fully passing fresh qualification permits separate integration review.

## Independent regression requirements

Use owned tiny inputs, actual saved artifacts and the full child boundary where
relevant. Never import or rerun an exhausted resource family in ordinary tests.

- A deliberately false useful-path expectation fails while intact artifact/support,
  raw repeats/parity, history and resource evaluation still run.
- A source-support mismatch fails support without erasing raw bytes or structurally
  valid history comparison. Overall acceptance remains failed.
- Missing, hash-invalid, malformed and unsupported-version first receipts produce
  explicit dependent states; no undefined-reference exception or invented value.
- A changed history original/projection/dependency fails consistency even if every
  returned artifact is individually canonical; no nested path/fact reads may repair it.
- Forced parent-only resource failure leaves independent content results available;
  invalid/missing metrics and child/watchdog/cleanup failures remain failures.
- Both positive supported consumer and negative unsupported-name expectations are
  documented in development fixtures, with complete scope and original support.

Keep this implementation limited to offline assessment and its authoring workflow.
Do not rewrite old coordinators, measured results, application histories or schemas.

## Remaining memory decision

After evaluator/preflight recovery, review the [allocation evidence](../fixtures/loredock-allocation-profile/README.md)
and the new process observations before scoping another memory experiment. Task
080 identifies large snapshot, validated-file, SQL-wrapper and async allocations;
Task 079 counts 137,650 prepared statements in a large first capture. Neither
allocation sampling nor statement counts alone establishes native retained bytes.
Task 082 has shorter useful paths and cannot supply complete-path improvement claims.

The next bounded decision must distinguish remaining payload/domain lifetimes,
temporary validation/SQL allocations and residency after replacement analyses.
State what the retained evidence supports and what targeted observation, if any,
is still needed. Do not automatically add statement reuse, payload compaction or
forced collection because streaming alone failed. Keep one justified optimization
per subsequent implementation, independent regressions and a new complete
uninstrumented qualification. No additional broad matrix is authorized by this
design, and reopening cannot substitute for same-process acceptance.
