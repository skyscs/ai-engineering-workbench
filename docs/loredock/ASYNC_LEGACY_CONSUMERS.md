# Awaitable legacy graph consumers

Task 137 prepares existing graph consumers for the owned file parser. The production
parser remains direct in this stage. No resource qualification or startup improvement
is claimed; the earlier startup, near-limit heap and browser failures remain open.

Before product edits, `scripts/loredock-async-legacy/observe.mjs` records fresh ordinary
catalog checkpoints and exact serialized outputs. The prospective order is in
`plan.mjs`: supported literal event topics, HTTP header match/gap/unknown, unsupported
dynamic syntax, excluded input, code/declaration corrections, unchanged refresh and
explicit reapplication, contradictory topics, README-only input, and copied stopped
v1/v2 saved-answer catalogs. Old optional-interface absence is included. Full witness
validation, prompt bytes, saved reads and idempotent replay use no model dispatch.
First observations and failures are retained without rerunning or overwriting them.

The implementation keeps every SQL transaction, lexical read scope, Ready promotion
and publication callback synchronous. Each bounded source-read phase uses a fresh
single-use lexical account on the caller's original operation budget.
Reported lexical observations sum all phases. The accounting unit remains one returned
SQL row or one original UTF-8 byte; added authority checks are charged as real reads.
Neither work nor elapsed time restarts at an await. The final current authority and
input checks must be adjacent to a synchronous commit or model dispatch.

The baseline is behavioral evidence, not a new execution seal. No consumed reserved
family, existing immutable observation, parser meaning or saved-input version changes.

## Implementation and authority

`codeFlows` drives a synchronous generator: a bounded original read yields one file,
the internal adapter returns its existing parser facts asynchronously, and the next
synchronous segment composes the same ordered graph. No SQL scope survives the wait.
The direct adapter still imports the TypeScript compiler; production startup and native
analysis are unchanged. Source-balanced selection, original evidence, `pilot-code-v3`
identities and the 100-document/256-KiB graph limits remain intact.

Map routes, candidate links, source suggestions, correction writes/reapplication,
reconciliation, retrieval, interface validation, preparation, witness verification and
answer admission/publication now await their actual results. Ordinary evaluator timers
also await completion. HTTP schemas, saved versions, prompts and history reads retain
their meaning; no promise is serialized as a result.

`LegacyReadOperation` checks catalog availability, cancellation, the original budget,
SQLite connection changes and external data version around each synchronous phase.
Any intervening write invalidates the epoch conservatively, including unrelated writes;
the caller must explicitly retry from current inputs. Every extra returned authority
row is charged. Successful original-byte/read totals remain exact; total SQL work can
increase. An already exhausted budget fails before another SQL or original read.

Correction commits recheck replay, revision, previous version and source authority.
Witness finalizers receive a synchronous final check after all reconstruction. Answer
publication rechecks status and authority in its synchronous transaction and retains
actual usage even when cancellation wins. Legacy admission owns a shared reservation
before its first wait; configuration, preparation and duplicate admission cannot steal
it. Stopping either its shared preparation owner or answer owner prevents insertion;
answer shutdown joins admission and any launched worker. A scheduled worker begins
after the persisted intention can be returned to its caller.

## Compatibility and retained results

The prospective baseline at `f727a4f9a40351fd06f076f7c9174333032256aa` precedes product
edits. Eight ordinary cases retain exact outputs and stopped catalogs, including twenty
saved v1 answers and one saved v2 answer. The first candidate comparison passes all
eight cases and twenty-one accounting comparisons with zero model calls. Its timing is
diagnostic only and predates subsequent validation-order, accounting and lifecycle fixes.
The portable regression reopens fresh copies of these same baseline bytes against the
final implementation; it does not regenerate expectations.

Twenty-three delayed-parser tests cover graph and context reads, the second candidate
projection, both correction kinds, reconciliation, shared-budget exhaustion, mutable
input, preparation cancellation, all prepared-answer phases, legacy admission and late
publication. First failures remain in the [evidence archive](../fixtures/loredock-async-legacy/README.md).
One regression exposed admission after the shared preparation service stopped; a final
reservation check now rejects that late insertion.

An [explicit test-only reference](../../apps/loredock/tests/fixtures/async-legacy-reference/README.md)
retains the old synchronous dependencies and declares exact current-source/emission
deltas. Historical controls run those dependencies where their original synchronous
protocol requires them. Frozen drivers, original manifests and consumed families remain
unchanged; current behavior is tested separately through production APIs and the portable
baseline. This separation does not qualify old observations for changed application bytes.

The full application suites pass on pinned Node 22.23.2. A separate minimum-runtime
attempt cannot initialize catalogs on official Linux Node 22.13.0: its SQLite build
lacks FTS5. A direct in-memory SQLite probe reproduces the failure independently of
these application edits; the same probe succeeds on 22.23.2. The package engine bound
therefore overstates LoreDock compatibility. README now directs users to the pinned
runtime. Task 136's standalone parser tests on 22.13.0 remain valid, but do not establish
whole-application support. The initial wrong-directory loader failure and subsequent
FTS5 failures are both retained; no test is skipped to claim minimum-runtime success.

Production thread ownership, contention, asynchronous fingerprint initialization and
native-analysis adoption belong to [Task 138](../../tasks/138-loredock-production-file-parser.md).
Aggregate heap coverage and fresh resource acceptance follow separately; earlier startup,
near-limit heap and browser failures remain open with their original ceilings.
