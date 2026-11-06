# Task 137 — Make legacy graph consumers awaitable

Status: implemented and locally verified; exact-head CI acceptance pending.

## Objective and boundaries

Prepare the legacy graph and its consumers for the owned parser from Task 136, following
[ADR 0062](../docs/decisions/0062-loredock-owned-file-parser.md) and the
[source audit](../docs/loredock/COMPILER_ISOLATION.md). Preserve exact successful graph,
correction, context, prompt and saved-answer meaning while introducing explicit waits.

This stage still uses the existing direct parser through an internal adapter. Do not
wire the new thread into production, change parser meaning, remove/rewrite saved inputs,
raise ceilings, add caches/queues or claim a startup improvement. Thread admission,
contention, initialization/fingerprints and complete production adoption follow separately.
No corporate repositories, real model calls or consumed-family/seal replay.

## Required implementation and checks

1. Before edits, freeze fresh ordinary successful legacy projection/context/correction
   and v1/v2 saved-input expectations. Use original immutable support and preserve byte
   order, `pilot-code-v3` identities, coverage, omissions and comparison hashes. Include
   partial input, headers, literal event topics, unsupported syntax and source-only input.
2. Separate bounded parent-owned source reads, file parsing and deterministic graph
   composition. Introduce an internal awaitable parse seam without a synchronous IPC
   bridge, `Atomics.wait`, durable-inventory substitution or an unbounded document queue.
   Preserve source-balanced selection, 100-document/256-KiB graph limits and original
   evidence checks. A delayed test adapter must exercise real interleavings.
3. Migrate all production callers and their transitive consumers together: map route,
   candidate links/source suggestions, corrections/reconciliation, retrieval/interfaces,
   question preparation/witness verification and answer admission/validation/publication.
   HTTP response shapes and immutable saved context/prompt versions remain unchanged.
   Do not let a promise become JSON or enter a synchronous transaction/finalizer.
4. Keep `CatalogStore.transaction`, Ready promotion and final publication callbacks
   synchronous. Perform asynchronous reconstruction before them; recheck generation,
   status, current source/build/policy/review authority, input hashes and idempotency
   immediately before each commit/dispatch. Cancellation, revocation, replacement,
   competing correction/request and daemon stop win over late completion.
5. Keep lexical scopes synchronous and single-use. Split reads into explicit short
   accounts charged to the same caller `OperationBudget`; aggregate observations rather
   than resetting work/time or discarding earlier phases. Preserve closed-scope/epoch
   fences and fail before unaccounted SQL/original reads. Document any necessary change
   to accounting meaning before applying it; no hidden budget or observer relaxation.
6. Verify byte parity against the frozen ordinary expectations, including full old
   saved-answer reads/replay, correction reapplication and the useful native v2 path.
   Use delay/failure injection to test each newly awaitable boundary, duplicate admission,
   rejected late writes, cancellation and shutdown. No model dispatch on invalid input.
7. Preserve frozen historical fixtures, driver, manifests and original first failures.
   If a compatibility reference must distinguish changed implementation bytes, add an
   explicit reviewed delta; do not rebaseline an old observation or bypass its integrity
   assertions. Run focused tests, strict types, regression checks and complete builds.
8. Retain the first ordinary integration evidence and any failures. Review complete diff
   and both exact-head CI logs before merging. Scope the next production-adoption task
   only once this seam is complete and unchanged behavior is demonstrated.

The Task 136 first adapter observation has useful exact facts, but misses startup heap
coverage and has asynchronous statistics delays up to 74.704 ms. It does not qualify
aggregate memory or production startup. Existing startup, near-limit heap and browser
resource failures remain separate, unchanged gates.

## Result

The [implementation record](../docs/loredock/ASYNC_LEGACY_CONSUMERS.md) describes the
generator/adapter boundary, single-budget synchronous read phases, conservative write
epochs and final transaction checks. Eight prospective baseline cases preserve graphs,
contexts, review history, prompts and twenty-one saved v1/v2 answers. Delayed-parser
regressions exercise actual waits, cancellation, competing writes and owner shutdown.
The direct parser remains in production; no resource improvement is claimed.

Task 136 is accepted at merge `278830b437727181385d61b958bb66191d9a9175`, after both
complete CI logs passed 1,062 tests at `ba94c28e6bde8cecf1f0a63d839a010abe219964`.
The next bounded task is [production adoption](138-loredock-production-file-parser.md).
