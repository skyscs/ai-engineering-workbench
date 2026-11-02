# Task 071 — First immutable path receipt qualification

**Gate rejected.** The single frozen run at `0e5019296d86c5e8546dd13c627a76090d1e62a1`
completed on 2026-11-03 with **86/88 cases passing**, **989 passed counted assertions**,
**113 observations** and **exit status 1**. Two cases failed. No promotion to production
receipt storage or answer/review consumers is allowed by this result. The matrix is now
exhausted; inputs, candidate, first results and old failed gates must remain unchanged.

Scope: `f17ac85`. Input/oracle/protocol freeze: `634c77b`.
[Inputs](../../../fixtures/loredock-path-receipts/README.md), [identity](identity.json),
[full result](result.json), [summary](summary.json), [stdout](execution.stdout),
[stderr](execution.stderr), [exit](execution.exit), [raw receipt archive](receipts.jsonl.gz).
The archive contains 42 exact files, including deliberately mutated inputs, with per-file
length/SHA-256 metadata. All reconstructed bytes were verified during packaging.

## What the candidate does

The separate offline script captures the exact producer-ordered projection JSON, every
original referenced by paths/root cards and all four source dependencies. Capture reopens
originals, bounds the complete representation and checks the catalog epoch throughout.
Final synchronous publication uses an immediate SQLite transaction without DML, rechecks
scope/manifest and writes an owned content-addressed file before releasing that guard.
A second connection cannot write inside the guard; an external commit before it rejects
pending capture even if the main connection's total_changes is unchanged.

Historical reads validate the receipt, original bytes/ranges and complete dependency scope
without calling CodePaths, CodeAnalysis or Git. Eviction/restart/new publication/parser
change do not rewrite recorded bytes. Scope revocation, policy change and corruption fence
the whole read. Current applicability remains `not-checked`. The prototype has no endpoint,
production schema, import action, model call, answer adapter or new correction namespace.

Whole projection, original-support and receipt bounds are separate. Exact compact producer
JSON stays inside a string field so canonicalizing the receipt does not break the existing
projection hash. Duplicate JSON keys, invalid UTF-8, unknown receipt keys and malformed
support are rejected. Hashes are local integrity identifiers, not authenticity signatures.

## Failed cases and diagnosis

### `default-first`: unsupported configuration-key profile

The oracle expected the two default paths to reach the subscriber and MongoDB write.
The captured projection instead contains eight nodes and seven edges, ending both paths
at `Publish BookingPlaced`. It records `unresolved-contract-or-topic-scope: 1` and keeps
candidate/runtime-unknown qualifications; there is no fabricated positive event hop.

The fresh sources use matching `bookingTopic` values and literal publish/subscribe topics.
The existing [connected resolver](../../../apps/loredock/src/code-paths-resolve.ts) only
collects a matching setting when its label is exactly `orderTopic`, then requires one such
setting for event delivery. The current legacy/offline profiles share that special case.
Thus the structural receipt stores the issued graph correctly, but the required useful
cross-repository path is absent. Generalizing names without defining evidence/ambiguity
semantics would be unsafe; renaming the frozen fixture would hide the limitation.

The first case stopped at the missing subscriber assertion. Its subsequent expected-write,
independent original-text and dependency assertions were not executed. Other cases and
candidate validators exercised original support, but do not substitute for that oracle.

### `history-alternative-change`: ambiguous label in the harness

The archived old graph contains both a `handler-reference` and a `symbol` labeled
`Reservations.place`. The harness selected the first label match, then incorrectly
expected an `implements` edge to point to that reference rather than the Java symbol.
It failed that old-graph precondition before comparing the new alternative or reading
history afterward. The newly computed graph was available and had a different generation,
but was not archived before the assertion; no claim about its ambiguity behavior follows.

This is a harness error, not evidence of an unsafe production binding. It still fails the
frozen gate. A successor must select nodes by role/source/path/identity and journal every
observed projection before assertions; it must use fresh prospective inputs. Do not patch
this exhausted matrix and call its rerun a qualification.

## Results that remain useful

Default/selected repeat captures preserve identity. Isolated roots remain readable. The
round-trip check verifies ordered projection hashing and preserved legacy answer-context,
flow and correction data. A synthetic cancelled-answer row was seeded explicitly without
any runtime dispatch; legacy correction rows were created through existing controls.

All five availability cases, seven reduced-limit cases, four invalid-limit cases, five
cancellation stages, 35 stage/mutation combinations, external commit/lock cases and twelve
receipt-corruption cases pass. Eleven of twelve history cases pass; the alternatives case
is the harness failure above. Observed operations make no Git call or catalog DML outside
explicitly counted lifecycle hooks. Historical reads use no fact snapshot/file/path read.
No corporate sources, real-model runs, user-demo/data changes or frozen-matrix reruns occur.

All 38 successful operations meet the frozen resource bounds on this small owned family:

| Measurement | Maximum observed | Frozen bound |
| --- | ---: | ---: |
| Complete operation wall time | 19.402 ms | 5,000 ms |
| Sampled uninterrupted interval | 9.761 ms | 150 ms |
| Sampled process RSS | 214.398 MiB | 384 MiB |
| Sampled heap growth | 3.026 MiB | 64 MiB |
| Charged receipt work | 44,441 | 1,000,000 |
| Projection bytes | 17,800 | 524,288 |
| Complete receipt bytes | 24,994 | 655,360 |
| Original UTF-8 text bytes | 1,603 | 65,536 |
| Distinct original spans | 6 | 30 |
| Source dependencies | 4 | 20 |

Five-millisecond samples plus a final sample are diagnostics, not a hard process timeout
or guaranteed peak memory. The short captured paths do not demonstrate full-hop resource
success. These readings do not extend Task 067's scale qualification or establish semantic,
independent/private-pilot or Workbench routing acceptance.

## Verification and next step

The normal repository check passes strict checks, 483 existing tests and builds. Five new
source-based receipt regressions and the final targeted strict check pass separately;
488 tests are now defined. CI runs those regressions through the existing TypeScript test
runner, without depending on prebuilt application dist files. The frozen matrix is opt-in
and is never executed by CI. No production executable changed.

Next: specify supported event-topic evidence independently of a business-specific setting
name, including ambiguity/contradiction/missing-evidence rules and preserved legacy history.
Then freeze fresh qualification inputs and correct the observer's typed identity selection.
Receipt promotion remains rejected until a separately scoped successor passes its contract.
