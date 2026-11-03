# Event-topic evidence for connected paths

Status: design only, Task 072, reviewed against `c3bb8ff`, 2026-11-03.
The current production adapter and Task 071's rejected qualification remain unchanged.

## Problem and decision

The [Task 071 receipt run](../fixtures/loredock-path-receipts/README.md) stores its issued
projection correctly but fails the useful-path oracle. The existing connected resolver
requires one matching JSON setting named exactly `orderTopic` before it links a publisher
to a subscriber. Matching `bookingTopic` declarations therefore leave both paths ending
at publish, even though the supported Java calls contain the same topic literal.

Qualify a new, narrow **literal-topic candidate** rule offline. Use the literal argument
at both supported Java call sites as the topic evidence. Do not guess a JSON field's role
from its name, suffix, value similarity or repository name. Keep matching record/contract
and complete consumer-domain requirements. The resulting edge remains a static connection
candidate, with broker, delivery, serialization, dispatch and deployment unverified.

This is a versioned change of derivation, not a rename of the old `orderTopic` profile.
The new rule initially abstains when either topic is computed or supplied through a
parameter. Arbitrary configuration binding, framework annotations and constant propagation
are separate future adapters. Existing legacy paths remain available under their existing
contract; no old answer or engineer note is rewritten.

## Evidence already available

- [`javaFacts`](../../apps/loredock/src/code-java.ts) records `topicExpression` from the
  first argument to supported `EventPublisher.publish` and `KafkaSubscriber.subscribe`
  calls. It validates the local interface/method shape and records payload/handler facts.
  It does not prove a concrete implementation or an active broker.
- [`resolvePathFacts`](../../apps/loredock/src/code-paths-resolve.ts) resolves a subscriber's
  supported `onMessage` method with matching record shape and document write. Complete
  same-source Java domains and all competing methods precede uniqueness. Preserve this.
- [`declarationMap`](../../apps/loredock/src/system-map.ts) compares same-name/version,
  same-declared-environment JSON contracts and matching scalar settings. A same-key/value
  setting comparison does not bind that field to a Java parameter.
- Existing edges retain full file support: receiver/interface declarations, records,
  imports and scope may precede the call line. Reuse complete originals rather than
  manufacturing a call-site-only citation from concatenated lexer tokens.

The proposal needs no parser payload change, automatic source scan or user input field.
It changes only the offline resolver's event-topic acceptance and provenance.

## First supported literal profile

Accept a `topicExpression` only when it is one complete nonempty double-quoted string
literal with **no backslash, embedded quote, CR or LF**, and at most **256 UTF-8 bytes of
literal content**. Preserve its exact case and Unicode code points. Compare values by
exact equality; do not lowercase, trim or normalize them. Source token/byte and normal
property limits still apply before this rule.

The lexer has already removed comments between tokens. Parentheses, concatenation,
parameters, fields, method calls, text blocks, character literals, escaped strings and
Java Unicode escapes remain unsupported in this first profile. Do not evaluate expressions
or apply a JSON decoder as if it implemented all Java string semantics. Empty/unsupported
expressions are unknown, not evidence that a real topic is absent or invalid.

| Publisher topic | Subscriber topic | Candidate decision |
| --- | --- | --- |
| Same supported literal | Same supported literal | Eligible for a candidate only if the unchanged contract/consumer conditions below also pass. |
| Different supported literals | Different supported literals | No delivery candidate for this pair; count `different-literal-topics`. Do not call it a production outage. |
| Supported literal | Unknown/computed/unsupported | No literal-topic candidate; count `unresolved-topic-expression`. |
| Unknown/computed/unsupported | Any expression | No literal-topic candidate; preserve the missing-evidence reason. |
| Any expression | Incomplete/ambiguous consumer domain or unsupported contract basis | No positive edge, regardless of a matching string or setting. |

Matching configuration values alone never satisfy the new rule, including `orderTopic`.
A parameter named `topic` or `bookingTopic` has no special authority. The narrower treatment
of dynamic calls is intentional and must be visible in the control/candidate comparison.
It is not hidden by falling back to the old setting-based rule under a new adapter ID.

## Contract, ambiguity and environment

For each supported cross-source publisher/subscriber pair, retain the existing checks:

1. The supported payload and consumer record signatures agree; the consumer method is
   uniquely resolved in its complete permitted Java domain and contains the supported
   document write. Incomplete/unseen alternatives block this positive binding.
2. Exactly one matching admitted JSON contract pair supplies the existing contract basis
   for that record's name/field set. Multiple matches are ambiguous; no first-match or
   display-limited choice. Zero matches are unresolved. This remains a bounded declaration
   comparison, not proof that no other contract exists outside declared coverage.
3. Both topic expressions satisfy the literal profile and are equal. Charge each examined
   pair to the existing comparison/work counters before making this decision. Do not
   inspect unbounded pairs or reuse the four-entry-point page as a candidate universe.

No unrelated scalar setting is required. A different or missing unbound configuration
value does not override the literal source comparison; existing declaration cards can
still show that difference. The edge must always state that settings, broker configuration
and deployment activation are not bound to these call sites. If a later adapter proves a
configuration binding, its conflicts require a new qualified rule, not an implicit tweak.

Use only the matching contract pair's declared environment for the candidate's
`environment`; null means unspecified. Do not borrow `staging`, `production` or any other
scope from an unbound settings file or filename. Explicitly incompatible contract scopes
do not form a supported match. Equal declared scopes still do not establish the running
environment or a coherent deployment. Preserve independent declaration omissions and gaps.

The subscriber-to-handler edge remains a separate `dispatch-candidate`. Equal topic strings
must not upgrade it to a static proven call, choose a MongoDB collection, infer subscriber
execution, or convert an engineer note into runtime verification.

## Support and identity

A new candidate event edge must carry:

- Complete original support from the publisher and subscriber operations, relevant record/
  receiver/interface declarations, the unique consumer method, and the matching contract
  pair. Preserve endpoint and whole-path support atomically.
- A bounded topic witness identifying the literal-equality rule version, exact literal
  value, the two original expression strings and each endpoint's supporting evidence IDs.
  Every witness ID must belong to the edge's full issued support and same saved build.
- A reason describing a candidate based on equal literal topics and supported record/
  contract evidence. Permanent gaps describe unknown broker, serialization, deployment,
  contract-to-code binding and dispatch; do not claim settings were resolved.

Do not add arbitrary configuration fields to support merely because they share the value.
Conversely, do not drop originals required by the new derivation to satisfy display or
receipt limits. Apply the existing whole-item admission and bounded output rules.

The offline candidate must use a namespace separate from `connected-paths-v1` and from all
frozen experiments. Bind the topic-rule version/profile/limits into generation identity;
edge/root/projection IDs follow that generation. Do not issue changed semantics under a
v1 identity. Keep the production v1 service, legacy `codeFlows`, answer interfaces, notes
and reapplication whitelist untouched during qualification.

The successor receipt validator must explicitly recognize its new experimental projection
and topic witness. It cannot silently treat them as the frozen receipt/graph v1 contract.
Preserve the producer JSON ordering rule. Unknown schema/adapter combinations fail closed;
old recorded artifacts keep their original bytes and supported historical reader. No
cross-adapter review transfer or answer-context backfill is authorized.

## Bounded implementation seam

Use a separate offline candidate over the already qualified saved-tree proof, inventory
validation, complete binding domains and whole-path admission. The only intended matching
change is the event-topic basis above. Preserve supported import/handler resolution,
HTTP header comparisons and their complete evidence, and static/candidate distinctions.

Keep production bounds: 10,000 files/facts, 12,000 resolution nodes/edges/binding records/
alternative references, 2,000 pair comparisons, two displayed paths, twenty nodes per path,
160 nodes/240 edges and a complete 512 KiB projection. The literal profile's 256-byte bound
adds no new public option. Work remains bounded/yielding with a cooperative five-second
read budget, exact input fencing and no Git/store mutations. Retain the receipt experiment's
30 spans/64 KiB original text/640 KiB serialized envelope and complete-operation work/time
budget unless a later scope prospectively qualifies a different bound.

This design does not qualify large-inventory resource behavior for the new resolver or
receipt. A small fresh family can qualify its stated structural cases only. Any production
proposal must review applicable scale coverage and the changed edge/witness byte costs.

## Fresh successor qualification

Commit new inputs, oracle, bounds, candidate identity and one-run protocol in that order.
Use independently authored source facts, while disclosing that agent-authored fixtures
are not blind external or semantic/private-pilot review. Never rerun Task 071 or edit its
frozen oracle/harness. The successor needs all of these families:

| Family | Required prospective outcome |
| --- | --- |
| Same direct literals with a differently named setting, no setting, duplicate/unrelated settings and differing unbound settings | Preserve the complete candidate path through subscriber/write when all other conditions pass. Setting names cannot select or suppress the literal candidate. Keep settings/deployment unbound. |
| `orderTopic` control with direct literals | Preserve useful nodes, original support and candidate qualifications; provenance/identity change explicitly. |
| Parameters, fields, calls, concatenation, parentheses, empty/escaped/oversized literals, and matching settings without literals | Explicit unresolved state; no heuristic positive or hidden fallback. |
| Different literals, including case/whitespace/Unicode differences | No delivery edge for that pair; preserve exact original expressions and counted reason. |
| Contract name/shape/version/environment differences, duplicate matches, incomplete or multiple consumer methods and omitted facts | Preserve conservative contract/domain rules; no unique match from truncated alternatives. |
| Multiple publishers/subscribers, branches, roots outside the default page and comparison/display limits | All admitted alternatives retain their evidence; count unexamined/undisplayed work without routing or absence claims. |
| Scope/cancellation/corruption and candidate output/resource boundaries | Discard pending results; no partial support, Git, catalog write or implicit analysis. |
| Complete receipt capture/repeat/round-trip/history after fact eviction, restart and new publication | Preserve exact complete support and all source dependencies with the new explicit experimental identity; do not rederive history. |
| Added same-name Java handler with unchanged old file bytes | A fresh current projection must not preserve the old unique implementation edge. The saved old receipt remains a recorded derivation; no automatic note transfer. |
| Existing answer/context/correction histories | Remain byte-identical outside explicit fixture lifecycle operations; no consumer switch or model call. |

Treat useful-path, support/safety, resource and observer-validity gates separately, and
require all mandatory gates for promotion. Do not use resource success on a truncated path
as evidence of complete-path success. A rejected successor remains evidence, not a tuning
set to rerun until green. Runtime semantics, independent/private-pilot gates and new model
attempt budgets are still separate.

## Observer requirements after Task 071

Identify expected nodes by **source, path, kind, label and role/range when needed**. Assert
exactly one match before testing an edge, and test its direction and endpoint kind. A
`handler-reference` and Java `symbol` can legitimately share a label. Default roots are not
incident priorities; choose explicit expected roots from their complete typed identities.

Journal each raw projection, receipt and normalized failure immediately when observed,
before any oracle assertion. Hash the exact bytes and record stage/selection/input identity.
Then run assertions independently enough to retain diagnostic outcomes for later checks;
mark prerequisites that prevented a check as unexecuted, not passed. Always retain initial
stdout/stderr/exit and resource samples. A harness failure rejects the applicable gate.

Task 072 defines this contract only. It does not freeze the successor corpus, implement
literal-topic matching, allocate model attempts or promote the Task 071 receipt prototype.

## Task 073 outcome

The [fresh literal-topic qualification](../fixtures/loredock-literal-topics/README.md)
passes 134/134 cases and 10,793 counted assertions. Complete literal-based paths, typed
alternative history and receipt integrity pass with explicitly versioned offline identities.
Dynamic expressions abstain as designed. All 113 successful small-family resource readings
meet bounds; raw results and the observer's generic unknown-gap limitation remain recorded.
Next: fresh twenty-source/near-limit resource review before production integration. Existing
production adapters, historical bytes and semantic/private-pilot gates remain unchanged.

Task 074 specifies the [complete capture resource contract](CAPTURE_RESOURCE_CONTRACT.md).
The successor must enforce an aggregate path/receipt budget during nested work and respect
twenty-source allocation. Literal matching and original-support rules remain unchanged.
