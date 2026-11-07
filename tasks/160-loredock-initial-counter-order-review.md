# Task 160 — Review creation-ordered initial counter acquisition

Status: review complete; exact-head CI acceptance pending. Task 159 is accepted through
PR #192, identical-tree merge 55fe1eb, after both complete CI logs pass. Task 159's sole
attempt is consumed and UNAVAILABLE: complete initial root counters were nonzero after
descendant setup, and no native child was admitted. This is a review-only task.

[ADR 0069](../docs/decisions/0069-loredock-creation-ordered-counters.md) adopts a prospective
collection-order correction under the unchanged contract: retain the root's zero initial
state before accounted descendants, then retain role initials before any measured child.
Eight synthetic review receipts pass their expected outcomes through the unchanged assessor.
No implementation or live probe is added. Task 161 scopes the separate staged reader offline.

1. Review the consumed first evidence, accepted v2 contract/assessor and upstream kernel
   parent-accounted child-group allocation path. Separate observed bytes, source-supported
   explanation and unknown installed-kernel details. Do not rescore or rerun Task 159.
2. Determine whether zero initial root evidence must be acquired before creating accounted
   descendants. Evaluate a bounded sequence: exclusively create run, acquire/read/retain
   its zero counters through held descriptors, enable only owned accounting as needed,
   create the fixed target/role leaves, acquire/read/retain empty role counters, then admit
   the existing native child. Preserve all setup charges in the unreset terminal root peak.
3. Check compatibility with the unchanged contract and pure assessor, including the earliest
   acquiredAtNs, separate initial windows, stable parent topology, each descriptor's lifetime,
   complete pre-child admission, canonical bytes and final daemon/browser-before-root order.
   Identify API changes needed to collect scopes at different construction stages; do not
   force the all-scopes-at-once Task 158 reader to claim observations it did not make.
4. Record whether this is a compatible prospective collection-order correction or requires
   a separately reviewed contract decision. Reject counter reset, baseline subtraction,
   arbitrary nonzero starting allowances, hierarchy flattening, weaker security or host/runtime
   tuning. Preserve all existing numeric/work/deadline limits and consumed evidence.
5. Produce an explicit next-task scope with offline boundary cases before implementation or
   any newly sealed actual attempt. If the required semantics cannot be established under
   the existing environment and contract, retain the unavailable executor path and choose
   bounded independent functional work without L5/resource/prepared-answer promotion.

No code implementation, service/cgroup/counter probe, native/sandbox/payload, application,
browser, model or corporate code execution is part of this review. Retain both accepted
Task 159 CI logs. Ancestor controls, orphan/interruption and complete executor lifetime,
application responsiveness/resources, semantic readiness and the Workbench bridge remain
separate gates. Agent review/merge does not supply independent semantic acceptance.
