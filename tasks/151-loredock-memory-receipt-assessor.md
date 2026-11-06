# Task 151 — Implement an offline memory-receipt assessor

Status: scoped by [ADR 0068](../docs/decisions/0068-loredock-observable-resource-contract.md).
Begin after Task 150 acceptance. No live cgroup, systemd unit, browser, application resource
control, host configuration, model or corporate-source execution.

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
