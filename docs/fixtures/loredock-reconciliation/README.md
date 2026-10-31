# LoreDock earlier-review reapplication evidence

Date: 2026-10-31. Scope: [Task 021](../../../tasks/021-loredock-correction-reconciliation.md),
a bounded L4 continuation after accepted PR #24. These are implementation-agent
checks over synthetic sources; owner/product acceptance and full L3/L4 remain separate.

## Production-service evaluation

[reconciliation-result.json](reconciliation-result.json) records the production services
over the frozen three-repository corpus. It includes original/changed revision vectors,
the exact original correction, unchanged-support preview, explicit new version, protected
current target, skipped-review discovery and changed-support comparison. All cited spans
are reopened with their original index, file/range, content hash and span hash.

- The unchanged update proposes the shared delivery note without applying it. Explicit
  application creates a new human/unverified correction with exact original-version
  lineage and fresh evidence/affected flow IDs. Both outlines require review.
- Original history remains pinned. Exact retry returns the same new version and does
  not duplicate publication. An already reviewed target is protected.
- A later index with no review does not silently inherit the note. The user can choose
  an older recorded ancestor. Adding a comment to the supporting worker Java file
  changes its full-file hash and blocks reapplication even when the link still exists.
- Changes occur only in owned temporary repositories. Frozen templates, normal source
  checkouts and Workbench data remain unchanged. No oracle is an indexing/matching input.

## Automated and browser verification

Full `pnpm check`: **265 tests** (17 Git, 18 AI, 43 storage, 114 LoreDock, 57 daemon,
16 scripts), strict typechecks and production builds. Added tests cover complete
source/config/contract support, missing/ambiguous/unsupported targets, protection of
current withdrawals, source/target edits, publication and policy fences, exact/conflicting
replay, atomic lineage rollback, schema 5 migration, provenance integrity, original-source
withdrawal independence, bounded ancestry/previews, skipped reviews, revocation/purge,
restart and protected HTTP access. A valid new note remains withdrawable if evidence
in its earlier index is damaged after publication.

[browser-result.json](browser-result.json) records the real Chrome workflow:
proposal-only loading, old/current source buttons, explicit application, both affected
flows, exact origin/history, current-target protection, no automatic carry to another
index, restart, older-index selection and changed-support blocking. An older preview
containing actual note text is held across source removal and then released; it cannot
restore revoked proposals. The prior source/map/flow/correction/concurrent-draft,
refresh, policy and historical-selection scenarios remain covered.

See [desktop review](desktop.png), [390px mobile review](mobile.png) and
[changed-support review](changed-support.png). Browser snapshots preserve the exact
[pre-apply proposal](browser-preview.json), [applied version](browser-reapplied.json)
and [changed-support comparison](browser-changed-support.json). Those fixture note texts
are synthetic English artifacts; copied evidence is outside application-controlled purge.

[answer-browser-result.json](answer-browser-result.json) records the existing cited-answer
regression with four fake invocations. **Zero real model calls** were made. These
engineer notes are still not supplied to answer prompts.

## Reproduction and limitations

Use the pinned Node/pnpm versions and frozen-lockfile installation:

```sh
pnpm check
node scripts/loredock-reconciliation-evaluation.mjs > /tmp/loredock-reconciliation.json
node scripts/loredock-smoke.mjs
node scripts/loredock-answer-smoke.mjs
```

Run the Linux Chrome scenarios sequentially with `google-chrome` and free port 4244.
They own and clean temporary sources, browser profiles, daemons and data. Startup
migrates LoreDock to schema 6 without rewriting earlier evidence/answer/note bytes.
Back up the stopped normal application directory before an ordinary upgrade.

The comparison is conservative: exact source/file identities and supported link semantics,
properties and complete evidence hashes/ranges must agree, with unique matches in both
projections. An unrelated commit may advance without changing support. No name-only
matching, rename inference or inferred runtime wiring is used. Identical support never
establishes that the human statement remains true in a wider changed system.

Discovery stops at 20 recorded authorized ancestors; one chosen index contributes at
most 20 latest active corrections and 512 KiB of details, with explicit omissions.
It does not silently search past a skipped review/withdrawal. Missing links may be
outside bounded adapter coverage. Semantic/AI reconciliation, answer-review integration,
broader orientation, production adapters, scale/retention and the Workbench bridge remain
separate milestones. See [ADR 0026](../../decisions/0026-loredock-correction-reconciliation.md).
