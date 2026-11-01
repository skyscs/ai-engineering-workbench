# ADR 0043 — Exact short Java names

## Status

Accepted for Task 049, 2026-11-01. Extends the matching contract in
[ADR 0042](0042-loredock-exact-symbol-search.md) under query response version
`loredock-code-symbols/2`. The endpoint and response fields are unchanged.

## Decision

For a validated `java-method` symbol, derive two additional literal aliases from its
stored full class name: the final class segment and that segment plus the method name.
For example, `synthetic.stock.StockProjection.accept` is also discoverable through
`StockProjection` or `StockProjection.accept`. Derive aliases only when the stored
qualified method equals its full class plus method name and the short class is nonempty.
Existing simple-method, fully qualified method and full-class matches remain available.

These are exact case-sensitive names, not arbitrary suffixes, substring matches or regex.
Do not infer imports, choose a package, resolve overloads or join types across repositories.
Return each matching symbol with its original full qualified name, source identity,
revision and distinct range. Duplicate display names and overloaded methods remain
separate; source-balanced count and output limits still apply. JavaScript/TypeScript
filenames do not become classes, and their existing matching behavior is unchanged.

Only the query path changes. Existing manifest/original validation, time/input/output
bounds and UI response fences remain. Durable facts, parser fingerprint and database
schema do not change, so compatible saved inventories do not need another analysis.
Query results are not persisted; version 1 measurement artifacts remain immutable.

## Consequences

Users can search for familiar class/method spellings without first knowing the package.
Multiple results are evidence of multiple syntax matches, not one resolved runtime type.
The Task 048 full-volume measurement remains historical; its frozen product-hash guard
intentionally requires the earlier checkout for reproduction. No new benchmark or model
run follows from this small matching change. Broader question-context selection remains
separate from symbol navigation.
