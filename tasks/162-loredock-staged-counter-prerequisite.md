# Task 162 — Integrate creation-ordered counters around one tiny owned workload

Status: implemented and locally verified; 24 Python and 12 Node focused checks plus 1,237
full Node tests, ten typechecks and ten final builds pass. The sole separately sealed tiny
attempt is consumed and PASS; exact-head CI acceptance remains pending. See the
[retained result](../docs/loredock/STAGED_COUNTER_PREREQUISITE_RESULT.md). Task 161 is
accepted through PR #194, identical-tree merge 7907726. Follow
[ADR 0069](../docs/decisions/0069-loredock-creation-ordered-counters.md) and the
[staged reader](../docs/loredock/STAGED_COUNTER_ACQUISITION.md). No application gate opens.

1. Preserve all consumed entries, frozen implementations, accepted Task 161 sources and
   complete CI evidence. Add a separate owner adapter that splits exclusive root creation
   from descendant construction; never patch or monkey-patch Task 156's combined constructor.
2. Keep the existing user-service/attestor ownership, mount checks and runtime/security
   profile. Acquire original root descriptors immediately after exclusive root creation,
   before root subtree enabling or descendant setup. Actually retain and fsync root raw
   observations, initial checks and their stage binding before constructing descendants.
3. Enable only owned accounting as needed and create the fixed probe target and empty
   daemon/browser siblings. Attach roles once without reopening root counters. Durably
   retain role initials and an ordered construction/publication inventory, then recheck
   all held/named identities, root/role/target empty membership and the initial eligibility.
   No native command or measured child may start after incomplete data, changed identity
   or failed publication. No caller-provided fsync flag replaces actual publication.
4. Keep the accepted Task 157 capability-clearing/native clone3/independent pre-exec durable
   permit/sandbox path and fixed 1-MiB synthetic allocation. After actual normal wait and
   empty target verification, capture final daemon/browser/root through original FDs.
   Preserve setup charges and exact raw bytes; fsync before service exit/removal. Bind the
   earliest acquisition timestamp and separate root/role initial windows to the unchanged
   Task 151 receipt; retain partial data and known failures even when later fields are lost.
5. Offline tests must verify construction and actual publication-call order, fsync/directory
   failures before setup/admission, one-shot transitions, partial cleanup, input/identity
   replacement and bounded source/projection handling. Review full local checks and pin
   the final helper/native/runtime/profile/input sources before any actual invocation.
6. Predeclare one new UUID service, immutable manifest, exclusive first directory/claim,
   predictions and no-retry outcome rules. Execute at most one tiny candidate with existing
   bounds: 10/5/2-second service/watchdog/stop profile, four-second native/five-second capture
   with two-second drain, 64-KiB streams, 4-KiB interface reads, 1-MiB records, one pending
   record, 2-MiB first output, three scopes and 24 initial + 24 final counter reads.
   Do not raise bounds, reset/subtract peaks, tune the host or start application/browser/model
   code. A nonzero corrected initial or unavailable actual capability ends this candidate.
7. Retain the sole outcome, complete raw/errors/errno, actual normal/forced wait evidence,
   same-unit/invocation terminal checks, owned-group disappearance/emptiness and outside/helper
   costs. Run the pinned offline assessor separately with no live authority. Preserve any
   failed attempt unchanged, review both full exact-head CI logs and merge only after review.

Even PASS establishes only this tiny prerequisite. Ancestor controls, orphan/interrupted
collector, full lifetime, application resource/timing, semantic-readiness, L5 and Workbench
bridge gates remain separate. If required capability remains unavailable, retain that result
and return to independently bounded functional work without promoting those gates.
