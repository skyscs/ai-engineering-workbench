# Task 153 — Correct user-service ownership evidence offline

Status: planned after Task 152 acceptance. No new service or namespace attempt is authorized
by this task; the consumed Task 152 helper and first evidence remain unchanged.

Task 152 stops at a missing `user.delegate` xattr before reaching Bubblewrap. Upstream
systemd v259.5 returns from `cgroup_xattr_apply` for user managers before applying the
delegation xattr. The probe imposed an unsupported requirement on the selected manager
type. Its unavailable result is not evidence that actual delegation or namespaces are
unavailable. This is a concrete helper defect, not an environment-tuning hypothesis.

1. Define the minimum manager-bound ownership receipt for a fresh dedicated **user**
   service: expected unit/UID, manager-issued invocation, actual main PID, current self
   placement, applied delegation/controllers/subgroup/watchdog/security properties, and
   stable held directory/parent/mount identities. An absent optional marker cannot replace
   or invalidate otherwise required manager/identity evidence; writable paths alone never
   prove ownership. An explicit conflicting observation must remain visible.
2. Implement and test only pure receipt validation. Reject stale/reused invocations,
   incorrect manager paths, terminal scopes, mixed PIDs, missing properties, unstable
   identities and relaxed watchdog/security settings. Keep supplied-data consistency
   separate from live OS attestation and do not claim executor/resource qualification.
3. Specify acquisition retention before optional observations so a later read failure
   cannot discard already collected manager/placement evidence. A positive unit property
   alone cannot grant authority to manipulate a hierarchy. No cgroup, systemd, namespace,
   application or model execution belongs in the pure validator or its tests.
4. Preserve the Task 152 candidate/helper/input hashes, original unavailable assessment,
   exact closed invocation and zero sandbox/payload count. Do not patch or rerun its
   consumed first attempt. Retain its accepted exact-head CI logs and source-review basis.
5. Run focused/full checks and review both complete exact-head CI logs. Only after
   acceptance may a separate task consider integrating the corrected receipt into a
   newly sealed tiny prerequisite on the same unchanged environment. No host/profile/
   permission change or replacement runtime is implied by fixing the helper predicate.
