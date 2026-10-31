# Task 042 — Offline related-source order qualification

Status: implemented and locally verified, 2026-10-31.
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

Outcome: all twelve frozen mechanics pass. The proposal preserves 22/22 small-corpus
critical occurrences and improves the volume corpus from 21/22 to 22/22, without changing
candidate counts. The explicit configuration-critical counterexample loses required support,
so unconditional promotion is rejected. Production remains unchanged. Original context and
current v1 selections reproduce the retained baselines; 1,484 original occurrences are
verified. Full checks pass 363 tests, strict types and builds. See
[retained qualification](../docs/fixtures/loredock-source-order/README.md).

Next: implement explicit bounded pages for omitted eligible related repositories, preserving
the default order and first-page behavior. Do not promote the rejected kind-priority policy.
