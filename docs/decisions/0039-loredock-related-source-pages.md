# ADR 0039 — Explicit bounded pages for related repositories

Status: implemented in Task 043.

## Context

Task 041 retains a relevant contract source outside the first four eligible related
repositories. Task 042 recovers it by sorting on clue kind, but a frozen counterexample
then loses a critical configuration source. That ordering proposal is not promoted.
Users need a way to inspect the remaining admitted evidence within a compact view.

## Decision

Keep the current primary policy and saved-order related selection. Page eligible related
sources in groups of four, retaining two supported links per source and the existing
128 KiB preview output cap. No admission, anchor, traversal or source-authorization rule
changes. The default offset zero preserves the original four-source selection.

`POST /api/candidates/preview` accepts optional `relatedOffset`, default zero. It must be
a safe integer, a multiple of four and below the twenty-source ceiling; a nonzero offset
outside the actual eligible range is rejected with `INVALID_PAGE`. Validation occurs
before retrieval for malformed offsets and after admission for unavailable pages.

The related projection becomes `source-candidate-links-v2` with
`page: {offset, limit, total, previousOffset, nextOffset}`. Previous/next offsets are null
at the boundaries. `omittedSources` means outside the current page; `omittedLinks` includes
other pages and the per-source link cap. Original evidence and review notes are validated
for the selected page. Lexical `source-candidates-v1`, the outer additive preview contract,
answer context/prompt, graph identities, database schema and saved histories stay unchanged.

The UI retains the current page while an explicit next/back request runs and disables
repeat paging. On success it replaces the page, with newly mounted cards collapsed.
Both request start and response publication clear the evidence view and invalidate old
evidence requests. Existing question/build/registry/policy/review generation fences apply
to pages; additionally, a changed original context hash prevents page publication and
requires finding candidates again. No background paging or combined unbounded list.

## Consequences and verification

Every eligible related identity can be inspected, but only four sources and two links
per source are returned per page. This increases explicit reading access without declaring
more repositories to be causes or modification targets. Code/projection omissions and
runtime gaps remain visible; pagination cannot reveal unindexed or unsupported behavior.

Tests cover complete traversal of nineteen identities, duplicate display names, stable
default selection, invalid offsets, source/evidence/policy boundaries and unchanged primary
and broader answer context. Browser acceptance covers next/back, later-page original
citations, keyboard/mobile use and late page/evidence responses. The Task 042 frozen
qualifier refuses changed selector hashes; its historical report and normalized mechanics
remain available. No ranking rerun, model evaluation or full volume benchmark is implied.
