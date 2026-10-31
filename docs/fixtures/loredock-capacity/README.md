# Larger synthetic capacity measurement

Task 041, 2026-10-31. Only generated local repositories were used. No model, corporate
source, remote clone, larger product limit or production behavior change was involved.

The [design](../../../fixtures/loredock-capacity/DESIGN.md) was committed in `0a9bce8`;
the deterministic workload and manifest were frozen in `46aa78f`. The one declared run
used clean implementation `fcfac40bf0dc3367ab8106969b3e030ba8c9ef46`, with compiled
module/source hashes and machine metadata recorded in [raw-result.json](raw-result.json).
It contains two fresh generations, each with one initial index and one unchanged refresh.
No stage was retried or resumed. Every owned temporary source/database was removed.

## Results

Each generation contains twenty sources, 3,679 eligible files / 7,389,669 bytes and
sixty excluded canaries. All four indexes publish as **partial** because of those explicit
exclusions: twenty policy exclusions, twenty binary files and twenty symbolic links.
There are no failed/pending files or source inventories. The default 10,000-path,
50 MiB total, 1 MiB/file and five-minute indexing bounds remain unchanged.

| Measurement | Generation 1 | Generation 2 |
| --- | ---: | ---: |
| Owned fixture generation | 1.48 s | 2.07 s |
| Explicit batch registration | 0.25 s | 0.42 s |
| Initial index | 67.15 s | 84.41 s |
| Unchanged refresh | 16.41 s | 16.47 s |
| Initial Git blob-read attempts | 3,699 | 3,699 |
| Refresh reused files / blob-read attempts | 3,679 / 20 | 3,679 / 20 |
| Initial checkpointed SQLite bytes | 65,724,416 | 65,724,416 |
| After refresh, checkpointed SQLite bytes | 131,022,848 | 131,026,944 |
| Initial evaluator RSS, sampled peak | 228,364,288 | 290,295,808 |
| Refresh evaluator RSS, sampled peak | 275,275,776 | 293,019,648 |

The twenty binary candidates account for blob reads beyond eligible text files; they
are not reusable text checkpoints. Cache rejections are zero. Each saved generation
retains 7,389,669 raw bytes and 7,385,990 span-text bytes; refreshing retains both generations.
The SQLite file also contains FTS indexes and catalog/history data. Its size is not a
storage quota. RSS covers only the evaluator during indexing, not child Git processes;
the second generation inherits process allocations. OS caches and background machine
activity were not isolated. These timings are diagnostics, not production targets.

All twenty root README contexts remain available. Orientation examines 35 documents /
7,892 bytes. The declaration map examines all thirty candidate documents / 4,775 bytes.
The code projection examines **100 of 3,621** candidate files / 186,453 bytes and reports
3,521 document omissions, unsupported profiles, three unresolved handlers and bounded
flow omissions. Indexed original evidence outside this projection remains searchable.
Absence from this sample is not evidence that behavior is absent from the system.

Across all four stages:

- The ten incident contexts retain all 22 critical repository occurrences and every
  recorded original reference. Their 12–17 source unions exceed every useful scope bound.
- Candidate previews retain **21/22** critical occurrences; nine cases include all required
  sources, six meet the size bound and five meet both conditions. Counts are
  `[6, 6, 1, 2, 2, 4, 7, 7, 1, 7]`. Six previews alone include all expected original references;
  broad context and Other matches remain available.
- All three exact-symbol probes find their required original; each preview suggests
  exactly the required single repository. Broader contexts contain 9, 9 and 10 sources.
- Each stage verifies 929 original-span occurrences across 185 files against the owned
  Git revision, blob, content, line range and span hash: 3,716 occurrences overall.
- Refresh changes passage order for ir03/04/06/07/10, while passage sets, expansion terms,
  preview selections, orientation and projection originals stay unchanged. Fresh generations
  reproduce each corresponding stage's ordering and selections.

The missing ir01 contract-library remains in Other matches and is eligible through direct
contract evidence, but the four-source related limit is filled earlier in saved source
order. Configuration comparisons occupy positions ahead of the contract library. This
supports a separate qualification of source ordering by the strongest existing link kind;
it does not justify filtering all configuration clues or silently increasing the cap.

## Reporting correction and reproduction

The raw v1 harness accidentally reused `status` for both query availability and the
candidate selector's `suggestions`/`unresolved` state. Its preview aggregate incorrectly
reports zero available previews, and its comparison aggregates list those queries as
unavailable. The detailed previews, candidate lists, source hashes and timings are intact.
**Use [audit-result.json](audit-result.json) for summaries and comparisons.** The pure audit
checks every retained selection hash and recomputes recall/scope from the candidate lists,
without indexing again. It separately compares passage sets and their order.
The raw report is preserved unchanged; no improved run replaced it. Harness result v2
separates `selectionStatus`, and regression tests cover both forms.

From the repository root with the documented Node 22 / pnpm toolchain:

```sh
node scripts/loredock-capacity-audit.mjs docs/fixtures/loredock-capacity/raw-result.json
node --test scripts/tests/loredock-capacity.test.mjs
```

An explicit future measurement after a separate implementation/protocol decision uses
`pnpm build` followed by `node scripts/loredock-capacity-benchmark.mjs NEW_OUTPUT_DIRECTORY`.
The directory must not already exist. This invokes two full generations and may take
several minutes; ordinary CI uses only the small Git shape and retained-report audit.
The original v1 harness is available at commit `fcfac40`; reproducing it is not necessary
to audit the retained evidence. Preserve earlier reports when measuring later changes.

The full premeasurement checks passed 359 tests, strict types and builds. The final five
capacity tests additionally cover the reporting correction and retained audit. No browser
or real-model rerun is needed for this fixture/report-only task. Failed semantic gates,
independent/private-pilot requirements and Workbench bridge prerequisites remain open.
