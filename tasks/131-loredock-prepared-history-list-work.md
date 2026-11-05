# Task 131 — Bound prepared-answer history list work

Status: implemented; first ordinary observation retained; exact-head CI and merge pending.

Task 130 was accepted through PR #163 after both complete exact-head CI logs passed
1,034 tests each; merge `12b1392` has the identical tree. The
[summary contract](../docs/decisions/0060-loredock-answer-history-summaries.md) precedes
implementation. The [first result](../docs/fixtures/loredock-history-summary/README.md)
returns twenty useful rows at both history sizes, using 257,241 aggregate work units
and 29.708/20.914 ms production HTTP time. Full history, authority and corruption checks
remain covered. [Task 132](132-loredock-native-context-size.md) is the next scoped step.

## Evidence and objective

The retained Task 128 ordinary history observation measures 3,168,560 work units
for a twenty-row answer list at both twenty and sixty-four stored answers, against
the unchanged aggregate limit of 1,000,000. `Answers.state()` calls `get(id, false)`
for every row, which still reads and validates the complete prepared witness before
discarding its content. A compact response does not imply bounded underlying work.

Design and implement the smallest correct summary-read boundary. Keep the complete
saved-answer/witness validation on content reads and dispatch. Do not silently turn
a summary into a claim that its complete evidence was validated during that request.

## Sequence

1. Review summary fields, source/policy fencing, review freshness, corruption behavior
   and current tests. Specify which fields require stored original/witness content
   and which can come from authorized metadata. Preserve the meaning of each returned
   field; if a contract change is necessary, document it before implementation.
2. Declare ordinary twenty- and sixty-four-answer controls using the existing
   controlled runtime, with zero real model calls. Preserve required twenty-row
   content/status behavior, actual aggregate work accounting and production HTTP
   timing. Do not replay the consumed kiln family or edit historical observations.
3. Implement the minimal bounded summary path if the contract supports it. Avoid
   unconditional full witness materialization for rows that omit content, but retain
   authority, version, dependency and relevant integrity checks. Do not move that
   cost into unbounded startup, unmeasured caching or per-row budget resets.
4. Add meaningful regressions for summaries, full detail validation, corruption,
   source revocation and stale review state. Observe first ordinary results, preserve
   complete stopped catalogs and exact public responses, and compare real aggregate
   work with the unchanged limit. Required useful rows cannot be replaced by refusals.
5. Verify relevant checks and both exact-head CI events before merge. Record remaining
   failures separately and scope the next smallest supported change.

## Boundaries

No corporate sources, model calls, schema changes without a justified design,
default activation, Workbench bridge or qualification claim. Task 130 improves cold
startup but does not meet 100 ms; startup, near-limit heap, browser RSS and required
native-output size remain separate unresolved checks. Complete repaired qualification
still requires a fresh prospective family. Preserve Task 127/128 frozen inputs,
driver, manifest and consumed first result.
