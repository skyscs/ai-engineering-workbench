# LoreDock answer-review evidence

Date: 2026-10-31. Scope: [Task 023](../../../tasks/023-loredock-answer-review-context.md).
These implementation-agent checks use owned synthetic repositories and a fake runtime.
They do not establish real-model handling of disputes or independent product acceptance.

## Verification

`pnpm check` passes **290 tests**: 17 Git, 18 AI, 43 storage, 139 LoreDock,
57 daemon and 16 script checks, with strict typechecks and production builds.
Eight new behavioral tests cover current note selection, scope separation, note IDs
rejected as citations, history/withdrawal/index isolation, count/UTF-8 bounds, replay,
restart, preview/preflight/completion changes, inherited source dependencies, purge and
corrupted review. Existing answer, correction, reapplication and source tests still pass.
The inherited-dependency test intentionally adds an authorized extra dependency to
exercise the union/purge contract independently of current reapplication eligibility.

[browser-result.json](browser-result.json) records production Chrome checks using four
fake invocations: matching notes reach the prompt, hostile note prose stays literal,
edited/withdrawn notes remain pinned in old answers, current review changes are visible,
source citations reopen, history survives restart and the layout fits 390px.
A real preview response held across a review edit cannot restore old input; an authorized
answer response held across source revocation cannot restore its note text. Prior conflict,
abstention, failure, cancellation and history scenarios are retained.

[answer-review-context.json](answer-review-context.json) is the exact saved synthetic
input, including original source revisions/ranges/hashes, the note version, independent
human/source scopes, review revision, limits and complete dependency IDs. It contains no
connection credentials, configuration directory or provider response. See the
[desktop](desktop.png) and [mobile](mobile.png) screenshots of historical notes.

[retrieval-result.json](retrieval-result.json) rechecks the frozen 20-question corpus
through production retrieval v5. All **20/20** expected evidence sets remain complete.
This is evidence recall, not a semantic score for answers or review relevance.
The separate [source-browser regression](source-browser-result.json) covers project
orientation, maps/flows, correction/reapplication, refresh, source/policy fencing and
mobile layout. Frozen templates, normal source checkouts and Workbench data are unchanged.

## Reproduction and limits

With the pinned Node/pnpm versions and built application:

```sh
pnpm check
node scripts/loredock-retrieval-evaluation.mjs > /tmp/loredock-retrieval.json
node scripts/loredock-answer-smoke.mjs
node scripts/loredock-smoke.mjs
```

Run browser scripts sequentially on Linux with `google-chrome` and free port 4244.
They own and remove temporary source/data/browser directories. **Zero real model calls**
were made. Copied evidence/screenshots are external artifacts outside application purge.

At most ten whole notes / 16 KiB of note JSON are admitted by exact evidence overlap.
This can miss related notes or admit unrelated ones. Source citations stay source-only;
human assertions remain unverified and do not establish deployment behavior. Global
review revision invalidation is deliberately conservative, including unrelated edits.
The database remains schema 6. Prompt v7 has no new real-model semantic acceptance yet;
the earlier v6 scores must not be attributed to it. See
[ADR 0028](../../decisions/0028-loredock-answer-review-context.md).
