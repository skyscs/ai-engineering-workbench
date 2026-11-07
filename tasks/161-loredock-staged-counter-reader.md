# Task 161 — Implement staged held-counter acquisition offline

Status: planned after Task 160 review and exact-head CI acceptance. Follow
[ADR 0069](../docs/decisions/0069-loredock-creation-ordered-counters.md). No live entry point
or service/cgroup/workload execution is part of this task.

1. Add a separate reader that can acquire a supplied parent/run pair before role directories
   exist. Validate read-only non-inheritable handles, named/held identity, mount/owner/topology
   and fixed interfaces. Open root counters once and retain those exact descriptors through
   later role attachment and final capture. Preserve Task 158 and every consumed input.
2. Make the staged lifecycle explicit: one root initial capture, one later daemon/browser
   attachment, one role initial capture, then one final daemon/browser/root capture. Reject
   premature, duplicate, reentrant, after-close or attempted recovery/replacement transitions.
   A missing/nonzero/invalid initial set cannot become eligible for measured-child admission.
   Generic eligibility is not authority to create a process, assert fsync or own a service.
3. Retain each initial window and earliest acquisition boundary separately. Preserve exact
   bounded raw bytes/base64, errno/error stage and independently complete fields. Keep sticky
   failures and monotonically ordered clock observations across attachment. A later root
   charge is legitimate history after its zero initial sample, not a reason to reset/rebase
   it. Never replace a missing final value with an initial or earlier observation.
4. Use the unchanged memory assessor's snapshot shape and immutable contract. Keep root
   initial and role initial records distinguishable from final data. Enforce the same
   three scopes, eight interfaces, 4-KiB complete reads and 1-MiB record/no-queue boundary.
   Document how the eventual owner must durably publish root initial data before descendant
   construction and role initial data before admission; do not add fake durability booleans.
5. Exercise temporary-file fixtures where roles appear only after the root initial capture
   and root charges subsequently rise. Verify original root FD continuity without reopening,
   correct final role-before-root order, no scalar normalization or peak reset, and explicit
   partial data on missing/replaced counters or roles. Cover malformed bytes/clocks, wrong
   parents, partial attachment/closure, exception cleanup, returned-record mutation and
   ineligible initial admission. A late missing field must not hide a separately known breach.
6. Run focused checks, full local verification and both complete exact-head CI logs before
   merge. Retain accepted Task 160 evidence, source hashes and closed logs. After acceptance,
   scope a separate owned-construction integration with a fixed tiny workload and all existing
   deadlines/work/storage bounds; do not run or silently widen that later task here.

No application/browser/model/corporate code, cgroup creation, actual counter read, controller
write, native/sandbox/payload or service request is authorized by this offline task. Ordinary
temporary files and their descriptor metadata are sufficient. Keep executor/ownership/
terminal/resource qualification false. Full ancestor/orphan/interruption/lifetime, application
resource/timing, semantic-readiness and Workbench bridge gates remain separate.
