# Prospective literal-search storage comparison

Task 053 design, 2026-11-01. Freeze this file and cases before candidate implementation.

Baseline: current schema-8 literal FTS5 table `search(spanId UNINDEXED,text)`. Candidate:
the same columns/tokenizer, external content provided by a view joining original spans
to an explicit integer-primary-key mapping. The mapping retains baseline FTS rowids;
it must survive VACUUM independently of incidental span-table rowids. An experiment-only
store adapter supplies mappings for new insertions inside existing file transactions.
Production reads, refresh and source revocation remain the behavioral reference.

Generate `createCapacityFixture(5)` once, register all twenty sources, publish an initial
index and one unchanged refresh, and analyze the latter once. Close before copying the
catalog. Only generated directories enter either adapter. No source edits, model calls,
real data, full-volume run, automatic retry or benchmark tuning are allowed.

Fixed stages, in this order:

1. **converted**: compare all frozen queries against both retained indexes. Compare all
   question-search rows/ranks and complete answer contexts for the same queries. Compare
   every original span through the evidence API and every retained code file. Retain
   non-literal-search logical records and ensure identical content. Compact both copies
   equally before measuring total and literal-search/mapping allocation.
2. **reopened**: close/reopen both stores; repeat the same query comparisons on both indexes.
3. **refreshed**: publish one unchanged refresh on each copy using the normal Catalog
   workflow. Require complete validated file reuse. New generated IDs are compared through
   owner/path/revision/range/content identity, preserving ordered results, scores and snippets.
   Compare the historical generations exactly as well as the new generation semantically.
4. **revoked**: revoke the registered portal source in both variants. Require no remaining
   literal mappings or matches for its original span IDs and unavailable revoked evidence.
   Repeat the queries on the newest and historical indexes with authorized survivors.
5. **compacted**: VACUUM both copies, close/reopen, repeat query comparisons and deep FTS
   integrity checks. Report actual before/after allocation without extrapolating to 20 real
   projects or promising a history cap.

Focused tests additionally cover empty conversion, Unicode/punctuation/duplicate terms,
transaction rollback after the mapping insert, interrupted jobs/restart, and corruption
refusal during conversion. The fixed measurement records failures instead of hiding them.

Gate: all required mechanical comparisons and lifecycle checks pass; compacted total bytes
do not increase at the converted stage; candidate literal FTS plus mapping bytes are at
least 10% lower. Report query durations without a speed gate or performance tuning. This
can justify a production migration task, not implicit adoption or semantic acceptance.

SQLite requires external content/index consistency and deletion of FTS entries while
their original text remains readable. Use its documented integrity check with rank=1:
[official FTS5 external-content documentation](https://www.sqlite.org/fts5.html#external_content_tables).
