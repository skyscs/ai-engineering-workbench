# Reusable prepared-answer boundary cases

The [case functions](../../../scripts/loredock-prepared-flow/validator-cases.mjs)
accept a stopped cold catalog or an explicitly declared two-build fault checkpoint.
The [ordinary entry](../../../scripts/loredock-prepared-flow/validator-cases-development.mjs)
reuses the preceding synthetic cold checkpoint and observes review, policy and published
build changes at first preflight, before dispatch and before publication. Each case uses
its own complete copy, and every process retains fault provenance. No application
method is wrapped, real provider invoked or synthetic answer/witness row inserted.

## Actual published builds and phase observations

Alternative-build setup uses the production entry and public indexing APIs to complete
and publish a second real source build and compatible native analysis. It retains both
actual build identities and originals. Only the isolated case copy selects the earlier
build before preparation. For first preflight, a declared SQLite trigger selects the
second completed build after durable witness insertion. Later phases select it while
the controlled runtime is held. Policy, source-set and correction versions stay fixed
for these build-only faults. Starting a new build is not substituted for publication.

Review and policy use actual public mutations. Mutation identity is resolved before
admission. A prepare hold prevents dispatch if a first-preflight public mutation loses
its race; zero prepare calls are required to record that first phase as observed. For
later phases the actual prepare/run counters establish that the declared hold was
reached. These counters locate the phase, not individual private method invocations.
In particular, policy notifications can fence and abort an attempt synchronously before
a delayed worker resumes. This evidence must not be described as a private validator
execution trace or complete R11/resource qualification by itself.

At the first two phases no provider run occurs. At the publication phase one controlled
run completes, its known usage (80 input, 20 output tokens) survives, and the changed
input prevents answer publication. Same-request replay has the exact terminal response
hash and does not dispatch again. Each case retains one attempt and an intact witness;
its prepared context and prompt/schema relationships remain inspectable.

## First incomplete observation and corrected setup

The first ordinary run records eight observed phases. Its first-preflight review case
misses the target: runtime preparation has already started, so it proves only a later
fence and the run remains **exit 1**. The extracted harness had moved two review-identity
GET requests after admission. The original source revision and all raw outputs remain
retained without relabeling that result.

The final implementation resolves those identities before admission, restoring the
earlier accepted setup order and removing unrelated reads from the critical sequence.
A separate ordinary run of that changed implementation observes all nine declared
phases and ends exit 0. Independent HTTP inspection verifies the changed request order.
This second result does not replace the first and does not establish deterministic
scheduling: any future missed first-preflight race must still be recorded incomplete.
Neither run consumes the reserved family, changes an oracle or grants resource timing.

## Retention and status

[records.json](records.json) retains both complete outputs, the first/final executable
inputs, reused synthetic sources/checkpoint, declared SQL, HTTP and process journals,
controlled outputs, independent verification catalogs and logs. Independent inspection
binds 67 reused input files to the preceding archive and verifies unchanged raw trees
and input checkpoints. All 22 complete catalog copies pass integrity and foreign-key
checks. Both two-build setups remain real completed builds; all 18 attempts retain their
original witnesses, and none publishes a successful answer. All 251 protected-client
bodies remain, including 20 redacted sessions and 231 exact recorded byte sizes.

Both external owners leave no errors or survivors. Production builds, script syntax,
retention checks and the original application/input seal pass locally. Actual boundary
controls exercise the extracted behavior; both full final-head CI events remain required
before merging. The application, parser, thresholds and user-demo checkout are unchanged.

These are ordinary fault-phase observations. Complete ordered R01-R15 assembly, remaining
resource assessment and the final executable/environment/output seal are still pending.
Known ordinary resource and required-positive failures remain unresolved; model
eligibility stays closed and reserved-family candidate reads remain zero.

The preceding inventory-eviction checkpoint is accepted through
[PR #147](https://github.com/skyscs/ai-engineering-workbench/pull/147): push 42034450015 and
pull_request 42034551788 pass 983 tests at exact head
`28ca35e5d4a4567b326bce33587dd29662f87ef5`. Merge
`49b72adac7b3d4d97c8a4efc5c9cda16c62936fb` has the identical tree. Both full CI logs
are retained here; its daemon timer failures remain failed.
