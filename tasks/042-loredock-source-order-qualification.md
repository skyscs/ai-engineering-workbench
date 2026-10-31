# Task 042 — Offline related-source order qualification

Status: scope frozen before implementation or measurement.
Follows PR #45, merged as `a09cd58` after both exact-head CI events passed. Continues
the owner's authorized synthetic-only sequence without a new continuation request.

Follow the [fixed design](../fixtures/loredock-source-order/DESIGN.md). Freeze twelve
normalized ordering/anchor examples, current production selector hashes and the prior
corpus fingerprints before implementing the offline proposal. Prioritize the strongest
already admitted link kind and preserve saved source order for ties; do not modify
production, existing caps, anchors, primary ranking, source bytes or historical reports.

Verify eligibility against the real production selector, including source identity,
original support and unchanged context. Measure the ten existing incidents in two small
fresh generations and the fixed ten incidents/three symbols on one new full volume index.
Do not resume/retry a volume attempt that fails to publish. Keep every result, loss and
projection omission visible. No model or corporate code is involved.

The configuration-critical crowding example is a deliberate regression test for the
hypothesis, not a reason to retune it. A critical loss blocks unconditional promotion.
Report the tradeoff and choose a separately scoped follow-up; explicit inspection of
omitted eligible sources may be preferable. Run relevant checks, review and merge only
after successful push/pull-request CI for the exact head, then continue the sequence.
