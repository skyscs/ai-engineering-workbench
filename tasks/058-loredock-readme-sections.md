# Task 058 — Source-backed README section navigation

Status: implemented and locally verified, 2026-11-01. Scope committed before code as `078c48d`.

Return from the completed storage diagnostic sequence to the roadmap's broader project
orientation. The overview currently exposes the introductory paragraph and undifferentiated
README parts. Help readers reach documented architecture, terminology and setup sections
without another form, model call or inferred repository role.

## Contract

- Extend the existing bounded orientation projection with original Markdown-style ATX
  headings from each single supported root README. Reuse already authorized, completely
  validated document text and issued spans; do not read more documents or change budgets.
  Recognize top-level `#` through `######` lines with at most three leading spaces.
  Exclude fenced/indented code, quoted/list-contained headings and conservative HTML
  blocks/comments. Other Markdown constructs, including setext headings, are outside
  this navigation profile; the complete original remains available.
- Record literal heading labels, level, inclusive source ranges and every issued span
  overlapping the section. Sections end before the next recognized same/higher-level
  heading; nested sections remain within their parent. All recognized boundaries apply
  even when a label is empty, too long or outside the output count budget.
- List at most twelve headings per README with at most 160 UTF-8 bytes per label, in
  source order; omit whole labels and expose omission counts. Never truncate a heading
  into a different label or claim complete document structure/semantic understanding.
  Version the orientation schema/adapter and preserve existing introductory prose,
  manifest reading, source coverage, historical identity and uncertainty labels.
- Add a collapsed Browse README sections control to each overview card, with escaped
  labels, line ranges and original-part buttons using the existing evidence viewer.
  Preserve full README reading and existing source/index/policy late-response fences.
  Do not change answer retrieval, parsers, model prompts, persisted schema or Workbench.
- Test nesting, fence lengths/closers, HTML/comments, quote/list/indent exclusions,
  empty/long/over-count boundaries, Unicode, duplicate labels, multi-span sections,
  read-only/Git-free behavior, corruption, historical refresh and revocation/policy fencing.
  Verify browser navigation, hostile headings, narrow layout and delayed old responses.

## Delivery and isolation

Commit scope before code. Build in an isolated owned worktree so the running demo's
compiled assets and process remain untouched. Browser verification uses an owned synthetic
catalog and isolated transport/profile, never the live port-4244 data. Retain screenshots/
checks, update English documentation and an ADR, run strict/full checks/builds, review and
publish a PR, and merge after both exact-head CI events pass. Preserve all frozen results
and exhausted model budgets. This is document navigation, not semantic acceptance or a
Workbench bridge; subsequent glossary/synthesis work remains separately scoped.

## Verification

Implementation `a59da3a`, layout `7e66e29`. Strict checks, 434 tests and production builds
pass. The 23-test focused run and nine-condition compiled browser scenario cover the
contract above. Original-part links gained explicit spacing after screenshot review.
See [verification and reproduction](../docs/fixtures/loredock-readme-sections/README.md)
and [ADR 0047](../docs/decisions/0047-loredock-readme-sections.md). Existing user demo,
frozen evaluations and model budgets remain untouched. Large-project navigation costs
and broader glossary/synthesis are not qualified by this three-source browser check.
