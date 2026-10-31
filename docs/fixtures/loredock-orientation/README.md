# LoreDock project-orientation evidence

Date: 2026-10-31. Scope: [Task 022](../../../tasks/022-loredock-project-orientation.md)
after accepted PR #25. These are implementation-agent checks over synthetic sources,
not owner scores or acceptance of complete system understanding/20-repository scale.

## Production-service evaluation

[orientation-result.json](orientation-result.json) records the original/changed revision
vectors and initial, updated, historical and revoked-scope orientation projections.
Every quoted line is reopened from original evidence; the artifact includes file/span
hashes and exact index/revision/range locators for all original/updated reading links.

- The frozen three-repository corpus supplies three original README contexts and three
  manifest reading links. The API README's outdated `orders.created.v1` stays verbatim;
  it is not silently reconciled with `orders.placed.v2` configuration.
- A controlled API introduction change appears only in the new index. Moving the worker
  README to `ORIENTATION.md` produces a missing-root-context gap; the system does not
  infer a role from its name or substitute the moved document.
- Historical context/citations stay pinned. Restart reconstructs the same current view.
  Removing the API fences its context and original citations. Unindexed registrations
  remain separate scope gaps in automated tests.
- Orientation performs zero Git commands or model calls and publishes no durable derived
  claims. Indexing/controlled changes occur only in owned temporary repositories; frozen
  templates, normal source checkouts and Workbench data remain unchanged.

## Automated and browser verification

Full `pnpm check`: **282 tests** (17 Git, 18 AI, 43 storage, 131 LoreDock, 57 daemon,
16 scripts), strict typechecks and production builds. Seventeen new checks cover exact
literal contexts/side effects, root-name casing, missing/ambiguous documentation, code-only
README, source instructions/HTML, UTF-8/line limits, multi-span excerpts, byte/span/input
budgets before reads, README priority across sources, exclusion, incomplete inventories,
damaged evidence/ranges/metadata, update/restart/history, new-source isolation,
revocation/policy and protected session/no-store HTTP. Normal response size is checked
against the output bound; the service rejects any oversized final response.

[browser-result.json](browser-result.json) records the real Chrome workflow: initial
cards, preserved outdated text, original README evidence/focus, escaped hostile source,
Guide me navigation/focus, a deliberately delayed flow response with an explained
unavailable step, historical isolation, changed/missing README, restart, 390px rendering
and delayed-orientation revocation fencing. An older response containing real fixture
README prose is held across source removal, then released; it cannot restore that text.
Existing map/flow/correction/concurrent-draft, explicit reapplication, refresh, source and
policy scenarios also pass. The browser waits for each requested citation's content,
including when an earlier evidence panel is already open.

See [desktop overview](desktop.png), [390px overview](mobile.png) and
[Guide me](guide.png). The exact browser API snapshots are
[initial context](browser-initial.json) and [updated context/gaps](browser-updated.json).
The owned browser fixture adds adversarial HTML to the portal README and package label;
it remains literal text with no image or handler execution. It changes the API's first
paragraph and moves the worker README during refresh. Frozen templates are unchanged.

[answer-browser-result.json](answer-browser-result.json) records the existing cited-answer
regression with four fake invocations. **Zero real model calls** were made in this
iteration. Original README quotes are not treated as executable application instructions.

## Reproduction and limitations

Use the pinned Node/pnpm versions and frozen-lockfile installation:

```sh
pnpm check
node scripts/loredock-orientation-evaluation.mjs > /tmp/loredock-orientation.json
node scripts/loredock-smoke.mjs
node scripts/loredock-answer-smoke.mjs
```

Run Linux Chrome scripts sequentially with `google-chrome` and free port 4244. They
own/clean temporary source repositories, data directories, profiles and daemons. The
orientation projection adds no DB migration; LoreDock remains schema 6. Read the
[user guide](../../loredock/USER_GUIDE.md#read-the-project-overview) before ordinary use.
Copied acceptance snapshots/backups are outside application-controlled source purge.

Only a single unambiguous supported root README provides context. Selection is a bounded
introductory text aid, not complete Markdown parsing or semantic architecture analysis.
Optional manifests are reading links. Limits are nine documents, 32 KiB/file, 96 KiB
input, eight spans/file, 16 complete lines / 2,000 UTF-8 bytes per excerpt and 128 KiB
output. Gaps/omissions remain visible and each active recorded repository has a card.
Guide me opens existing partial views and preserves candidate/engineer-review labels;
it does not make their path or source prose authoritative.

Broader synthesis, terms/rationale, production framework qualification, answer-review
integration, semantic/AI refresh, scale/retention and the Workbench bridge remain separate
milestones. See [ADR 0027](../../decisions/0027-loredock-project-orientation.md).
