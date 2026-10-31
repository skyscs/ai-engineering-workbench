# ADR 0027 — Source-backed project orientation and reading navigation

Date: 2026-10-31. Status: implemented in Task 022 after accepted PR #25.

## Decision

Provide a useful first reading view without introducing a model prerequisite. Project
overview shows an original introductory README excerpt or an explicit context gap for
every authorized repository in the selected published index. A collapsed Guide me route
connects those cards to the existing declaration map, first partial flow and selected-index
coverage. It navigates existing views and preserves their candidate/engineer-review labels;
it does not create a synthesized architecture, verified role or learning-progress record.

This closes basic source orientation/navigation left open by the accepted cited-answer
slice. Broader purpose synthesis, terminology, rationale and production frameworks remain
separate tasks. Three documented repository descriptions do not imply knowledge-ready
acceptance or a coherent deployment.

## Original source and selection

`loredock-orientation-v1` / `readme-orientation-v1` is a disposable read projection over
authorized saved source. It defaults to the published index and supports historical
selection under the current policy. No table/schema, source execution, Git operation,
model call, dependency or Workbench mutation is added; the database remains schema 6.

Recognize one root `README`, `README.md` or `README.txt`, case-insensitively. Multiple
recorded candidates are an ambiguity gap; do not choose whichever happens to contain a
useful answer. Nested documents are not substituted for a missing root introduction.
Optional root `package.json` / `pom.xml` links provide additional reading, not inferred
technology/role/ownership claims. These documents use existing ingestion eligibility.

Select the first bounded paragraph of original lines, skipping blank lines, ATX/setext
headings, fenced code blocks and leading indented code. This is a small introductory
text selector, not a complete Markdown parser or semantic classifier. Other markup remains
literal. A code-only/oversized introduction is a visible gap, with original reading links
when available. Do not guess a role from a repository name, heading, package or code block.

Keep the exact original LF-normalized text and inclusive subrange, plus every existing
issued span overlapping that range. A paragraph crossing a span boundary needs both
citations. Only complete leading lines can be truncated; disclose line/UTF-8 limits and
offer the complete original evidence. The excerpt's provenance is documented/unverified.
It is not an extracted authoritative claim or engineer correction.

Outdated/contradictory wording stays verbatim: the fixture API README's
`orders.created.v1` is not silently rewritten to the configuration's `orders.placed.v2`.
Readers must compare the original sources. Source instructions and HTML render as escaped
text; they cannot authorize execution or become application controls. Guide navigation
does not run setup snippets or invoke Ask Project.

## Bounds and integrity

Retain the current three-repository pilot limit. Inspect metadata for at most four root
README candidates per source to detect ambiguity, and the two exact manifest names.
Process all repositories' READMEs before optional manifests so one package cannot consume
the reading budget before another repository receives its context attempt.

At most nine documents, 32 KiB per file, 96 KiB total original bytes and eight existing
spans per file are eligible. Check original/stored byte sizes and span counts before BLOB
reads. Reuse the existing complete-document reader: authorize/reopen all spans, validate
raw/text hashes and source/build/path identity, and require complete original span coverage.
Corrupt indexed material fails closed instead of becoming a missing-document claim.

Each excerpt is at most 16 complete lines / 2,000 UTF-8 bytes. Final JSON is capped at
128 KiB. Document/input/excerpt omissions and per-source reasons are visible; an oversized
response is rejected rather than silently dropping repository cards. Every active recorded
source has context or a gap. Incomplete/failed inventory cannot establish README absence.
Source coverage remains distinct from documented context and architecture understanding.

## Freshness, authorization and UI

Use existing Host/Origin/session/no-store protections for `GET /api/orientation?buildId=...`.
The selected index must be published and current-policy. Filter revoked source cards,
reading links and evidence. New active registrations absent from the saved index appear
separately as unindexed gaps; their content is not mixed into historical scope. A source
removal/policy change also fences original citations through the existing catalog.

Hash versioned output, including selected revisions, scope, gaps and current staleness.
Quotes/locators reconstruct from saved source after restart; no derived text cache or
automatic paid work is introduced. Updating source creates new context/evidence while
older authorized indexes retain their original text. Broader source/semantic updates
continue through the existing explicit Update knowledge workflow.

Project overview appears before System map. Guide me is collapsed by default; its buttons
open/focus existing context, map, first supported flow and overview coverage. If a flow is
loading/unavailable, explain that state instead of inventing a path. Diagnostics and optional
manifest reading stay under details. No new setup form, source selector or model control
is required. Reading navigation and notices reset at source/index/publication boundaries;
late responses cannot restore old or revoked text. Existing evidence navigation retains
latest-request-wins and focus behavior. Narrow layouts preserve original source wrapping.

## Follow-up

This is a basic reading aid, not an architecture synthesis engine or acceptance of all
original L2/L3/L4/L5 goals. Semantic review, glossary/rationale, supported real frameworks,
broader Guide me, answer-review integration, semantic/AI refresh, scale/retention and the
Workbench bridge remain separate milestones.
