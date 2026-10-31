# Task 031 — Literal HTTP header and binding comparison

Status: implemented and locally verified.
Follows Task 030 / merged PR #34 (`d11887b`).

## Scope and acceptance

1. Add an independent client/route example with unrelated header and handler names before
   implementation. Preserve all frozen evaluation corpora, prompts, answers and scores.
2. Extract bounded literal header names from supported fetch/Dojo request options and
   same-document JSON handler bindings. Never execute source, follow computed names,
   resolve framework configuration or copy header values into derived properties.
3. Compare ASCII field names case-insensitively on existing method/path candidate hops.
   Distinguish matching names, a missing literal declaration, and unsupported/dynamic
   input. A gap is not proof of a runtime bug: middleware, proxies, runtime headers,
   parameter conversion and deployment remain unresolved. Names never prove identity
   validation, tenant membership, authentication or authorization.
4. Preserve existing document, text, comparison, graph and output caps; add explicit
   header count/name/serialized bounds. Dynamic, malformed, oversized or ambiguous input
   remains visibly unresolved. Include original evidence from both sides.
5. Surface these comparisons in the existing flow view, including candidate links outside
   the two selected outlines. Preserve escaped rendering, original citations, keyboard/
   mobile use and late-response/source/policy boundaries. Add no setup fields.
6. Version changed adapters, preserve immutable correction/answer history and reject
   incompatible correction reapplication. Do not change prompt/retrieval/runtime or
   database schema. Existing failed semantic gates remain historical outcomes.
7. Test mismatches, case-only matches, explicit empty declarations, computed/spread/getter
   inputs, binding ownership, invalid/long names, bounds and history. Run full checks and
   browser regressions with synthetic sources; model budget: zero.
8. Record limitations and evidence, review the diff and merge only after both exact-head
   CI runs pass under standing authorization. Further framework and answer integration
   require their own bounded tasks; do not claim this comparison fixes model answers.

## Outcome

- Added literal header/binding extraction and three-state comparisons to existing HTTP
  candidates; all admitted candidates are inspectable even outside selected outlines.
- Preserved runtime uncertainty, values, original evidence, all existing analysis limits
  and source/policy fences. Added 16-entry, 128-character-name and 512-character-property
  bounds; malformed/ambiguous/oversized input stays unresolved.
- Versioned adapters to v2; historical correction bytes remain readable and incompatible
  reapplication is rejected. Existing answer history and failed semantic gates are intact.
- Full local check: **327 tests**, strict typechecks and builds. Final wording adjustment:
  five focused header tests pass. Independent baseline test failed against the old adapter
  before implementation. Both browser scenarios pass with zero model calls.
- Reviewed production changes, tests, browser reports and documentation; no remaining
  blocking finding. See [ADR 0034](../docs/decisions/0034-loredock-http-header-bindings.md)
  and [evidence](../docs/fixtures/loredock-http-headers/README.md).

Prompt v8, retrieval v7, answer schema v3, database schema v7 and text runtime policy v2
remain unchanged. Further answer integration requires a separately bounded contract;
model budget used by this task: **zero**.
