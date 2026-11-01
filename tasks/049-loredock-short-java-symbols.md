# Task 049 — Familiar Java names in exact-symbol search

Status: implemented and locally verified, 2026-11-01. Scope was committed in `c1e8cb9`.

After the larger lookup qualification, make packaged Java symbols discoverable with
the short class/method spelling engineers commonly know. Reuse validated durable facts;
do not add another input, parser pass, model request or implicit binding resolution.

## Contract

- Retain every existing literal, case-sensitive simple/qualified/full-class match.
  For `java-method` facts only, additionally match the final class-name segment and
  that exact short class plus method name, such as `StockProjection` and
  `StockProjection.accept`. Require the stored qualified method to agree with its
  full class/name before deriving these aliases. No substring, suffix-query, regex,
  fuzzy matching, import resolution or package preference.
- Return fully qualified names, unchanged source/revision/range support and every
  matching overload/source within the existing source-balanced twenty-match bound.
  A short name is a lookup convenience, never proof that identically named methods
  refer to one type or runtime binding. Do not collapse matches by display name.
- Version the query response as `loredock-code-symbols/2` because the matching contract
  is broader. Keep endpoint/input shape and all query/time/output/manifest/original
  fences. Query results are not persisted. Parser facts and fingerprints are unchanged,
  so a compatible existing code inventory remains usable without reanalysis.
- Keep TypeScript/JavaScript/Vue/Dojo matching behavior unchanged. Preserve all frozen
  Task 048 inputs, raw outputs and both oracle assessments. Its historical evaluator
  may refuse this changed product hash; normal CI still checks its immutable contract.

## Verification and delivery

Use owned packaged Java examples with identical short class names in different packages
and sources, overloaded methods and identical display names. Verify short-class, short-
qualified, fully qualified and simple queries, exact case/operator negatives, distinct
source/range identity, no false alias for another language and reuse of an unchanged
inventory. Add a browser query against the existing packaged synthetic method and its
short class, opening originals with the keyboard. Retain existing bounded/fenced coverage.

Run strict checks, full tests/builds and the owned browser workflow. Update usage/API
matching semantics and verification records. Review/create the PR, merge after both CI
events pass for its exact head, and continue the authorized sequence. No corporate input,
new full-volume measurement, parser expansion or model call in this task.

## Outcome

Query response version 2 adds only exact short Java class/method aliases derived from
coherent full names. Every result keeps full qualified identity and original ranges;
packages, overloads and duplicate display names are not collapsed. Existing match forms,
limits and source/policy/query fences remain.

Strict types, all 392 tests and production builds pass. The new owned integration case
checks two packages/sources with identical class/display names and overloaded methods,
literal/case negatives, TypeScript filename isolation, protected HTTP results and reuse
of one inventory. The compiled parser fingerprint still matches Task 048's recorded
`4c7fa6c899ddef2629d18285edacb377425f7298723f71354ea068560377bcbc`.
The historical qualifier correctly rejects changed query implementation hashes without
starting another measurement.

Browser workflow version 3 passes short class/method search, full qualified display and
keyboard originals alongside earlier coverage, search, late-response and 390px checks.
See [verification](../docs/fixtures/loredock-short-java-symbols/README.md) and
[ADR 0043](../docs/decisions/0043-loredock-short-java-symbols.md).
No corporate input, model, new full-volume run or parser change. Next: an isolated
one-command synthetic demo for manual exploration without twenty path inputs.
