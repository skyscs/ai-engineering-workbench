# Task 147 — Verify browser input ownership and non-root readability

Status: implementation, first image and three preflights complete. The first blank
lifetime completes but remains ineligible: 1,309,532,160 bytes summed RSS and three
incomplete samples. Full local checks pass 1,169 tests; exact-head CI pending.
See the [retained result](../docs/loredock/CONTAINER_INPUT_RESULT.md).
Task 146 is accepted through PR #179, head
`f60e6f4`, identical-tree merge `4b501a7`. Both complete CI logs pass 1,157 tests,
ten typechecks and ten final builds. See the
[retained result](../docs/loredock/CONTAINER_SECURITY_RESULT.md).

The image copied an empty `0700` directory with root ownership. File hashes alone did
not capture this discrepancy, and the non-browser preflight never traversed the Chrome
tree. Correct those concrete gaps without retrying or repairing a consumed attempt.

1. Declare a new candidate/input/image/preflight/output set. Preserve the original public
   toolchain, all old images/containers/claims and frozen product/API/collector bytes.
   Give copied browser inputs explicit UID/GID 1000 ownership in the new image while
   preserving file bytes, modes, flags, read-only root, default security and resource limits.
2. Record and verify complete browser directory metadata, including the root, parents,
   nested and empty directories, mode, UID/GID and type. Reject missing/extra entries,
   symlink redirection and unreadable traversal. Keep file hashes and directory assertions
   distinct from build-time whole-image inventory and runtime-injected files.
3. Share input verification between the actual observer and non-browser prerequisite.
   Execute it as the real non-root user during image construction and runtime preflight,
   without starting Chrome. Verify bytes, modes, identity, traversal and read access before
   declaring the browser gate open. Add regressions for matching file hashes with invalid
   directory ownership/permissions, empty-directory changes and redirected parents.
4. Run focused/full checks, build the prospective image and retain complete metadata and
   dependency identities. Run one fresh normal/orphan/interruption preflight set with the
   applied-security and new input checks. Preserve unexpected first failures; no security
   fallback, host permission mutation or in-place repair.
5. Only after prerequisites pass, commit the concrete image/input/preflight manifest and
   consume at most one fresh thirty-second blank-browser lifetime. Retain the original
   collector-inclusive 1-GiB summed RSS, 50-ms nominal/100-ms actual cadence, storage,
   time and ownership limits. No retry, PSS substitution or hidden acceptance change.
6. Preserve portable first evidence, update status/roadmap, review the complete diff and
   both full exact-head CI logs before merge. Scope the next action from the actual result.
   Empty-page eligibility cannot grant application/full-flow acceptance. Daemon aggregate
   heap/startup remains blocked; no application/model/corporate input is part of this task.
