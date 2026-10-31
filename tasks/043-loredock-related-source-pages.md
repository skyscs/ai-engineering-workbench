# Task 043 — Bounded browsing of remaining related sources

Status: implemented and locally verified, 2026-11-01.
Follows PR #46, merged as `b9cc358` after exact-head CI succeeded.

Task 042 rejects unconditional strongest-link-first ranking because it can displace a
critical configuration source. Keep the current saved-order selection and make the
remaining eligible related sources inspectable through explicit pages of four.
No corporate input, model request, semantic/routing acceptance or broader parser work.

## Product contract

- Default previews retain exactly the current primary list, Other matches, first four
  related sources and selected links. Preserve all admission/anchor rules and two links
  per source. Each page still fits the existing output budget.
- Extend the existing model-free candidate preview with an optional bounded integer
  related-source offset. Validate it at the API/service boundary; default zero. Page
  positions are multiples of four within the twenty-source ceiling. Reject offsets
  outside the actual eligible range instead of silently showing a different page.
- Return explicit offset/limit/total and previous/next availability in a versioned related
  projection. The lexical candidate policy stays v1; paging is not a new relevance score.
  No saved answer, source context, graph identity, prompt, database schema or correction changes.
- Keep the related section compact and initially collapsed. Inside it show the current
  range and accessible Previous/Next controls when needed. A page request preserves the
  current result until success, disables repeat paging and clears any open original.
  New source cards start collapsed; original citations remain one action away after opening.
- Recompute each page from the same question/build. Refuse to combine it with a response
  whose original context hash changed. Clear originals again when switching pages to
  fence requests started during loading. Question, index, registry, policy and review
  changes invalidate the pending page through the existing request-generation boundary.
- Review notes cover the current page's original links plus the unchanged broad context.
  Retain explicit projection omissions and runtime gaps. Remaining eligible pages do not
  expose unindexed, revoked, unauthorized or second-hop sources.

## Verification

Test offset bounds/types, all pages without duplicate/skipped eligible identities, stable
default selection, independent two-link/output caps, evidence ownership and revoked/policy
fences. Verify original context and primary selections remain unchanged between pages.
Retain the Task 042 frozen qualifier; it must refuse changed production hashes rather
than silently relabel its historical report. Keep its normalized mechanics executable.

Extend the owned twenty-source browser scenario: next/back navigation, original evidence
from a later page, keyboard access, compact mobile presentation and a held page response
discarded after question/scope change. Existing escaping, review, historical-index and
revocation scenarios remain mandatory. No new full capacity benchmark or real-model run.

Document API/UX behavior and the bounded-page decision, run appropriate checks, review,
create the PR and merge only after push/pull-request CI succeed for its exact head.
Continue to the next bounded roadmap task without waiting for another command.

Outcome: related projection v2 pages eligible sources in groups of four without changing
default order or original context. Strict types, 364 tests, builds and the extended browser
scenario pass. The default small-corpus diagnostic reproduces all earlier first-page
selections; two fresh generations retain 22/22 critical occurrences. See
[verification](../docs/fixtures/loredock-related-pages/README.md) and
[ADR 0039](../docs/decisions/0039-loredock-related-source-pages.md).

Next: measure complete file-by-file code-fact extraction on the frozen volume corpus with
the existing bounded parsers, keeping production graph limits/schema unchanged. Record
cost, provenance and unsupported coverage before designing persistent code analysis.
