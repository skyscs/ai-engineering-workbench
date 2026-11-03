# Independent offline assessment

Task 084 implements the [recovery contract](../../docs/loredock/QUALIFICATION_RECOVERY.md)
for future offline coordinators. It does not replace any exhausted runner or its
scores. No resource qualification or production integration occurs here.

`assessArm({ root, arm, raw, process, oracle, size, corpus, metadata })` accepts a
stopped worker report, its exit observation, an owned artifact directory, and
trusted frozen expected sources/metadata. The caller constructs the expected text
outside measured intervals. The helper never opens a catalog, reads Git sources,
calls a path/fact service, or executes source text. `assessQualification([same,
reopened])` combines both results and requires all seven cross-arm comparisons.
The current operation sequence is deliberately fixed to the eight existing checks.

Each operation records artifact integrity, shape, frozen source support,
usefulness, history consistency, raw repeats and resources separately. States are
`pass`, `fail`, `blocked` or `not-applicable`, with dependency/error reasons and
per-dimension planned/required denominators. Lifecycle failures include missing or
duplicate operations, failed process exit, timeout, worker/cleanup errors, changed
initial snapshot identity, absent eviction and missing closure. Any required fail
or blocked state fails the overall gate.

Receipt comparison bytes are retained immediately after length/hash checks,
before decoding. A structurally valid receipt is retained before source/usefulness
checks. Observation and content shapes are also exposed separately: a damaged
wrapper must not erase an independently valid receipt. History compares the first
projection, originals, dependency vector and receipt ID even when usefulness or
frozen support fails. Zero nested path/fact/snapshot work is independently required
by resource/counter validation. Missing first shape blocks history explicitly.

Cross-process receipt parity and repeats mean **byte equality only**. Intact opaque
receipts can compare equal even with an unsupported schema. Page parity compares
the serialized projection extracted from a valid JSON operation envelope; metrics
are excluded, and its projection bytes are retained before projection validation.
Malformed page envelopes cannot supply that comparison input. Current catalog
authorization/applicability is always `not-evaluated`.

`codec.mjs` isolates the pure validation portion of the frozen Task 077 receipt
reader. It retains receipt/projection identity, exact keys, fatal UTF-8, duplicate-
key rejection, depth and output bounds, topic/accounting versions, endpoint and
support membership, original span hashes and source dependencies. Root-page shape
explicitly requires a null graph; full receipts still require a path graph and
offset zero. Source checks compare original content/span/Git blob identities with
the frozen source vector. The existing frozen resource validator is reused with
additional finite/nonnegative/required-field checks and reduced-only receipt bounds.

Artifacts must be regular files below the stopped owned root, with exact
`raw/<name>.json` references. Absolute/traversing references and symlink directories
or files are refused. Reads allocate only the bounded declared length plus one byte
and verify size/hash; arbitrary returned `result.file` paths are never followed.
This is an internal evaluator for caller-owned stopped output, not an import service
for directories concurrently controlled by another writer.

## Independent capability review

The [development configuration](../../apps/loredock/tests/fixtures/qualification-assessment-config.ts)
extends the existing tiny locker example, not an exhausted resource corpus. Both
cases have three sources, fourteen files, eight code files, twenty-one facts and
five ordered roots. Tests run actual preparation/reopened children with all eight
operations and then mutate only saved copies to test evaluator refusals.

| Segment | Authored construct and expected supported behavior |
| --- | --- |
| Vue entry | `AABook.book`, `BBHold.hold`, `CCPin.pin`, `DDRetry.retry` call the named `reserveLocker` import from `./reserve`; first page has these four roots. |
| HTTP and route | `ui/reserve.ts` declares `POST /lockers/reservations` and `X-Locker-Token`; `routes.json` names `Reservations.reserve` and its token binding. |
| Publication | `Reservations.java` constructs `LockerReserved(String token, String locker)` and calls `EventPublisher.publish` with direct literal `"locker.reserved.v2"`. |
| Subscription and contract | `KafkaSubscriber.subscribe` receives the same direct topic literal and `this`; both scoped JSON contracts describe the same record/version/environment. |
| Positive consumer | `LockerWriter.onMessage(LockerReserved event)` constructs `TokenKey(event.token())` and calls `MongoCollection.replaceOne`. The complete relevant Java domain contains one matching consumer. Default/selected paths end at `document-write`, with ten originals and all three dependencies. |
| Negative consumer | Only the method name becomes `onReserved`; the pinned resolver requires `onMessage`. Default/selected paths end at `event-publish`, have seven originals, no event-delivery edge, and an explicit `unresolved-consumer-method` omission. Applying the positive oracle still fails. |
| Isolated root | Offset four contains `ZZLocate.locate`, whose `./missing` import is unresolved. Its one-symbol path has five originals and `unresolved-import`; no complete flow is expected. |

The parser/resolver, [binding contract](../../docs/loredock/BINDING_COMPLETENESS.md),
[topic contract](../../docs/loredock/EVENT_TOPIC_EVIDENCE.md) and exact
[`onMessage` rule](../loredock-capture-scale/resolve.mjs) define compatibility.
No consumer-name fallback is added. Passing the negative development case proves
the gap contract; it cannot qualify a complete positive workload.

Run the independent regression from `apps/loredock` with Node 22:

```sh
node --import tsx --test tests/qualification-assessment.test.ts
```

First failures and final checks are [retained](../../docs/fixtures/loredock-qualification-assessment/README.md).
The streaming candidate remains unqualified. The remaining same-process memory
decision is a separate task; all prior families and limits remain unchanged.
