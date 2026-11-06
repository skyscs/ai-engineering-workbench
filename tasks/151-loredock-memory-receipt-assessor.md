# Task 151 — Implement an offline memory-receipt assessor

Status: accepted through PR #184, head `902c98f`, identical-tree merge `a42a006`.
Both complete exact-head CI logs pass 1,202 tests, ten typechecks and ten final builds.
Task 150 is accepted through PR #183, head `d5012b1`, identical-tree merge `c7adf93`,
with both complete CI logs passing 1,169 tests, ten typechecks and ten final builds.
The [module and receipt boundary](../docs/loredock/MEMORY_RECEIPT_ASSESSMENT.md) implement
offline-only assessment under ADR 0068. No live cgroup, systemd unit, browser resource
control, host configuration, model or corporate-source execution occurs.
Full local verification passes 1,202 tests, zero failures/cancellations, ten typechecks
and ten final builds. Source inputs remain unchanged throughout the completed check.
Final review verifies 753 local document links, six closed logs and all retained source
hashes. All 95 emitted application modules, frozen inputs/API and normal checkout are unchanged.

1. Implement a small pure module under a new evaluation-helper directory. Bind the adopted
   v2 contract identity/digest and define one bounded receipt representation for the three
   scopes. Accept raw initial/final counter text and explicit identity/read-window records;
   validate data before arithmetic. Do not access the filesystem, processes, network,
   cgroups or application services from the assessor. An input adapter/CLI is out of scope.
2. Enforce the three charged-memory ceilings, zero swap, initial emptiness, recognized
   hierarchical event modes/keys, mandatory accounted HugeTLB mode, unchanged identities,
   no reset/decrease, final role-before-root ordering and parent/child peak consistency.
   Missing/malformed/ambiguous evidence is unavailable. Preserve independently verifiable
   violations when another field is missing; missing values never become zero.
3. Report per-axis outcomes and stable reason codes with explicit offline-only and
   non-qualification labels. Diagnostic RSS/heap gaps never establish an aggregate value
   or a v1 pass. A supplied claim of qualified execution must not grant live authority.
   Do not invent useful-case, responsiveness, storage, authority or executor acceptance.
4. Test with independent hand-authored small transcripts and controlled clock values:
   inclusive byte limits, short-child peak retained after empty exit, mismatched/reused
   identities, parent read too early, nonzero swap/events, duplicate/unknown/missing keys,
   unsafe integers/oversized input, partial final evidence, and failure-plus-unavailability.
   Include unadopted/wrong contract input and honest incomplete heap diagnostics. No old
   experiment is rerun or reassessed; no production parser/API/collector changes.
5. Retain accepted Task 150 CI logs, document module coverage and remaining draft cases,
   update roadmap/status, run focused tests and required full checks, review both complete
   exact-head CI logs, and keep the normal checkout untouched. Scope the next bounded
   executor prerequisite only after this task is accepted; do not launch it implicitly.
