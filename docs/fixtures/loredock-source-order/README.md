# Related-source ordering qualification

Task 042, 2026-10-31. The [design and twelve cases](../../../fixtures/loredock-source-order/DESIGN.md)
were frozen in `ac7454d`; implementation `5e9890a` precedes the one declared evaluation.
The [complete result](qualification-result.json) retains both small generations and the
single volume index. Production ranking, limits, prompts, source bytes and historical
reports remain unchanged. No model or corporate source was used.

The offline proposal orders eligible sources by their strongest already admitted link
kind, using the existing within-source priorities and saved source order for ties. All
anchors, clue kinds, original support, four-source and two-link limits are preserved.
The complete bounded graph input is independently reconstructed and exactly matches
the production v1 selector before evaluating the proposal.

| Fixed scenario | Current v1 | Ordering proposal |
| --- | --- | --- |
| Small corpus: critical repository occurrences | 22/22 | 22/22 |
| Small corpus: both recall and size conditions | 5/10 | 5/10 |
| Volume corpus: critical repository occurrences | 21/22 | 22/22 |
| Volume corpus: both recall and size conditions | 5/10 | 6/10 |
| Volume exact-symbol probes | 3/3, one source each | 3/3, one source each |
| Configuration-critical normalized case o12 | Critical setting retained | Critical setting displaced |

The observed volume ir01 omission is recovered: contract-library and deployment-local
replace inventory-worker and shipping-worker. Other changed lists replace shipping-worker
with deployment-local. Candidate counts stay unchanged; the proposal does not solve broad
scope. Both small generations agree after normalizing symmetric declaration sides. Every
original context and current v1 selection matches its retained Task 039/041 baseline.
The volume index publishes 3,679 eligible files with sixty intentional exclusions and no
read failures, using one initial attempt and no refresh/resume/retry. Its code projection
still examines only 100/3,621 candidate documents. No performance comparison is claimed;
the full test suite ran concurrently with this separate ordering experiment.

All twelve normalized cases pass their mechanical expectations, including the explicit
loss: four admitted code clues can displace a critical configuration source. They are
not blind semantic examples. **Unconditional promotion is rejected.** Improvement on an
observed incident does not establish that clue kind is a reliable relevance or confidence
score. No production selector was replaced or retuned after measurement.

Across the observed corpora, 1,484 original-span occurrences over 249 files counted per
fresh generation match source ownership, pinned Git revision/blob, content, range and
span hash. Ordinary source checkouts remain clean; answer attempts and model requests
are zero. Strict types, all 363 tests and production builds pass. Two focused tests cover
the twelve frozen cases, fresh identities/link order, foreign/corrupt evidence rejection
and unchanged stored code direction.

## Reproduction and next step

With the documented Node 22 / pnpm toolchain, run `pnpm check`. The full qualification is
explicit: `node scripts/loredock-source-order-qualification.mjs NEW_OUTPUT_DIRECTORY`
after building. It creates two small generations and one full volume index, checks frozen
selector/corpus hashes, preserves stage results and removes only owned temporary sources.
The output directory must be new. Do not overwrite this report when comparing later code;
changed selector hashes require a separately scoped contract or the frozen implementation.

Next: expose omitted eligible related repositories through explicit four-source pages,
preserving the current first-page order, original citations and primary/answer context.
This lets a user inspect remaining evidence without promoting the rejected ordering
heuristic. Keep page selection bounded and fence late responses after question, index,
source, policy or review changes. Broader code coverage, independent/private review,
failed semantic gates and Workbench bridge prerequisites remain open.
