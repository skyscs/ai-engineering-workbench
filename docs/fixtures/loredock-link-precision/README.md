# Structural-subject link qualification

Task 038 follows PR #41 (`f3f10c5`). Commit `6e1f177` freezes the proposed admission
rule and sixteen normalized subject examples before implementation or measurement.
This is an offline experiment. Production candidate links, answer context and prompts
remain unchanged, with no model calls or corporate inputs.

[Frozen design](../../../fixtures/loredock-link-precision/DESIGN.md) ·
[Retained qualification](qualification-result.json) ·
[Task](../../../tasks/038-loredock-link-precision-qualification.md)

## Proposal and outcome

The proposal keeps v1's primary seeds, owned-passage anchors, direct-neighbor limit and
full original evidence. It excludes configuration comparisons and additionally requires
a distinctive term in an HTTP path, publisher payload type, contract name or field name.
Names of sources, prose, generic field types and runtime topic expressions do not qualify.

| Observed ten-case incidents | Production v1 union | Proposed union |
| --- | ---: | ---: |
| Critical repository occurrences | 21/22 | 20/22 |
| Every critical repository present | 9/10 | 8/10 |
| Candidate counts | 1–8 | 1–4 |
| Cases within the useful bound | 5/10 | 10/10 |
| Both necessary scope conditions | 4/10 | 8/10 |
| Automatic routing/abstention | Not implemented | Not implemented |

Proposed counts are `[4, 3, 1, 2, 2, 3, 4, 3, 1, 4]`. All changes remove sources;
none adds a source. The narrower rule loses ir02's order-worker, previously connected
through configuration clues. Both versions still miss ir06's inventory-api. That case
also retains an incidental portal → order-api link because “legacy” matches its literal
`/legacy/orders` path; whole-token subject affinity does not resolve this ambiguity.

The sixteen normalized examples pass. They test mechanics and explicit exclusion choices,
not independent semantic quality or a new end-to-end source corpus. The incident set was
already observed during development. No blind acceptance claim follows from either result.

## Integrity and verification

- The evaluator independently reconstructs all bounded relationship inputs and asserts
  that v1 selection equals the real production output before applying the proposal.
- Both fresh twenty-source generations preserve selections, old context/lexical baselines
  and the retained v1 relationship support after symmetric-side normalization.
- 200 selected original-support occurrences across both alternatives and generations
  are checked against committed Git file hashes, ranges and span hashes.
- Full checks: 351 tests, strict types and builds. Two new tests cover the frozen examples
  and end-to-end synthetic measurement/provenance invariants without asserting that a
  development score constitutes acceptance.
- No application, API, UI, database, parser, runtime or historical report changed.

The current code adapter is now v3 (Task 039). This v2 qualifier refuses that provenance
explicitly; the retained report remains unchanged. To repeat the original qualification,
use the Task 038 implementation at commit `1af275f` in a separate checkout, build it, then run:

```sh
node scripts/loredock-link-precision.mjs
```

## Decision and next task

Do not replace v1 automatically: the smaller list loses useful context and still cannot
produce explicit missing-evidence decisions. Keep the proposed rule and its outcome for
a later navigation design that distinguishes structural clues from configuration context.

The next bounded implementation addresses an independently identifiable parser gap:
literal function-valued exports in the supported `dojo/request` AMD module. The current
adapter handles a returned named function but rejects a returned object such as
`{ reserve: function(data) { ... } }`. Method helpers such as `request.post` are already
supported inside recognized functions. Freeze positive and adversarial binding/export
cases before extending the profile; preserve computed-plugin and dynamic-wiring gaps.
Version the changed code adapter and retain original-evidence/review boundaries.
