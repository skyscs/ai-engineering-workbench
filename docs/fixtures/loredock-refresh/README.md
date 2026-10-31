# LoreDock incremental-refresh acceptance evidence

Date: 2026-10-31. Scope: [Task 020](../../../tasks/020-loredock-incremental-refresh.md),
the first bounded L4 slice. These are implementation-agent checks over synthetic
sources; full L3/L4 and production-scale acceptance are not claimed.

## Production-service evaluation

[refresh-result.json](refresh-result.json) records the original frozen revision vector,
a controlled changed vector, reuse/read counters, inventory comparisons and 18 resolving
new evidence records with original locators/hashes. No oracle is supplied to indexing.

| Index | Reused text files | Git file read attempts | Inventory result |
| --- | ---: | ---: | --- |
| Initial | 0 | 21 | 18 indexed text files, nine exclusions. |
| Unchanged | 18 | 3 | 27 unchanged committed entries; independent new citation IDs. |
| Changed | 16 | 5 | One added consumer file, one changed API README, one removed legacy client. |

The three unchanged reads are binary canaries: byte-dependent unsupported inputs are
checked again. Counts are not subprocess totals, latency or billing measurements.
All sources are freshly inventoried, and the packaged `audit.AuditConsumer.onMessage`
appears in the new code projection. Earlier legacy-client evidence remains available
under its original index. Changes are made only in owned temporary fixture repositories;
the application preserves those checkouts during indexing. Frozen templates are unchanged.

## Automated and browser verification

Full `pnpm check`: **245 tests** (17 Git, 18 AI, 43 storage, 94 LoreDock, 57 daemon,
16 scripts), strict typechecks and production builds. Refresh tests cover independent
new evidence, new source/consumer discovery, raw/span/metadata corruption with fallback,
policy/extractor/path/mode/identity isolation, file/project/path limits, failed inventories,
bounded fair previews, pause/restart/resume, cancellation, atomic copy failure, schema 4
upgrade with preserved engineer history, and protected/policy-fenced HTTP access.

[browser-result.json](browser-result.json) records Update knowledge, unchanged reuse
(18 files / three reads), changed reuse (16 / five reads), added/changed/removed counts,
previous/selected original citations and 390px rendering. For that UI scenario, an owned
API README changes and a worker README moves to `REFRESH.md`, preserving the original
topic-search/flow scenarios. A move is deliberately shown as added/removed paths.
The existing hostile-label, engineer correction/concurrent-editor, historical-selection,
source-revocation, delayed-response, policy/reindex and restart checks also pass.
See [desktop](desktop.png) and [mobile](mobile.png) screenshots.

[answer-browser-result.json](answer-browser-result.json) records the existing cited-answer
regression with four fake invocations, original citations, failure/cancellation history,
restart and mobile behavior. **Zero real model calls** were made in this iteration.
No Workbench data or normal source checkout is modified.

## Reproduction and limits

Use the pinned Node/pnpm versions and a frozen-lockfile installation:

```sh
pnpm check
node scripts/loredock-refresh-evaluation.mjs > /tmp/loredock-refresh-evaluation.json
node scripts/loredock-smoke.mjs
node scripts/loredock-answer-smoke.mjs
```

The Chrome scenarios require Linux, `google-chrome` and free port 4244; run them
sequentially. They own/clean their processes, source fixtures and data directories.
Schema 5 upgrades earlier LoreDock data while preserving evidence/answer/correction
content. Back up the stopped normal application directory before an ordinary upgrade.

Only a fixed authorized baseline's matching indexed files are eligible. Stored bytes,
Git object hashes, complete original spans and metadata derivation are checked before
copying. Current budgets apply first. Invalid cache triggers a recorded rejection and
pinned Git read, without rewriting earlier evidence. Comparison totals cover bounded
inventories; previews are capped at 100 safe paths / 512 KiB. Incomplete inventories
cannot prove absent paths. Revoked scopes and old-policy content are fenced.

Maps/flows are recomputed for each new full inventory. Answers/corrections keep their
original index and are not regenerated, reconciled or transferred. Semantic/AI caching,
review reconciliation, broader orientation, real-framework adapters, 20-repository
scale and the Workbench bridge remain separate. See
[ADR 0025](../../decisions/0025-loredock-incremental-refresh.md).
