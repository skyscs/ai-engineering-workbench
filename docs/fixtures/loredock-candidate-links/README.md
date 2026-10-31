# Candidate relationship context evidence

Task 037 follows PR #40 (`9a9aeb9`). Design and eight graph/context adversarial cases
were frozen in `4b8f987` before implementation and measurement. Only owned synthetic
sources were used; no model requests, answer attempts or corporate inputs.

[Frozen policy](../../../fixtures/loredock-candidate-links/DESIGN.md) ·
[Diagnostic](candidate-result.json) · [Browser verification](browser-result.json) ·
[ADR 0037](../../decisions/0037-loredock-candidate-links.md)

## Results and limits

| Observed development incidents | Primary lexical sources | Primary plus related sources |
| --- | ---: | ---: |
| Critical repository occurrences | 18/22 | 21/22 |
| Every critical repository present | 6/10 | 9/10 |
| Candidate count range | 1–4 | 1–8 |
| Within the precommitted useful bound | 10/10 | 5/10 |
| Both necessary scope conditions | 6/10 | 4/10 |
| Automatic routing/abstention | Not implemented | Not implemented |

Union counts are `[7, 6, 1, 2, 2, 3, 7, 7, 1, 8]`. Added links recover ir01's
contract-library, ir02's order-worker and ir07's order-api. The inventory-api omission
in ir06 remains. Whole-passage anchors can admit incidental configuration comparisons,
including other MongoDB workers. The UI therefore leaves this supplementary reading
section collapsed. No weight, parser or repository-specific rule was tuned to these cases.

Two fresh twenty-source generations preserve the primary selection hashes, broad answer
context selections and baseline summaries. All selected relationship originals are
verified against committed Git content/ranges/hashes: 172 occurrences across both runs.
Selected sources and relationships are stable after treating symmetric declaration sides
as an unordered pair for comparison. Raw side ordering differs in ir01/02/07/08/10 and
both generations remain in the report. Directed code links are never normalized this way.

An initial diagnostic compared object insertion order and raw declaration sides, reporting
false logical changes. Measurement now uses structural equality and reports side changes
separately. This also exposed bounded link ordering depending on those sides; the selector
now orders symmetric comparisons by canonical endpoint pairs while retaining original
directional representation. A regression test protects this behavior. No admission rule
or reference expectation changed.

## Verification

- Full checks: 349 tests, strict types and builds.
- Four new tests cover the frozen cases, one-hop/endpoint-only anchors, reverse navigation,
  difference status, duplicate names, source/link caps, foreign or missing support,
  stable ordering, original ownership, overlapping human notes and revocation/policy fences.
- Existing authenticated candidate API tests continue to run with answer mode disabled.
- The owned browser smoke checks both primary and linked HTML-like source labels as
  escaped text, keyboard opening of original linked evidence, 390 px layout, collapsed
  related sources, other matches, history and late question/evidence/review/source/policy
  responses. Revoking an additional linked source removes its text and support.
- An initial test used the nonexistent correction target `map-edge`; it was corrected
  to the existing `declaration-link`. Strict compilation also required explicit Set
  membership for token matching. These were implementation/harness fixes, not rule tuning.

Reproduce after building:

```sh
node scripts/loredock-candidate-links-evaluation.mjs
node scripts/loredock-candidate-smoke.mjs
```

Browser scripts own port 4244 and must run sequentially. The older reports are retained
unchanged. Independent semantic review, missing-implementation decisions, realistic
private-pilot acceptance and the Workbench bridge remain open.
