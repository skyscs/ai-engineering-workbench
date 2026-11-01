# Prospective rebuild-only control

Task 054, 2026-11-01. This is a new comparison, not a rerun or rewrite of Task 053.

Use `createCapacityFixture(5)`: twenty sources, 179 eligible files and 121 code candidates.
Publish exactly two unchanged indexes and one code inventory, then close the preparer.
Copy the database into three isolated directories with identical original/citation IDs.
Do not edit sources or open the user's data. Prepare these fixed variants:

1. `unchanged`: normal schema-8 store, no search rebuild.
2. `rebuilt`: normal schema-8 store, one built-in `search` FTS5 rebuild.
3. `external`: the Task 053 external-content prototype, including stable mapping overhead.

VACUUM each variant once. At `measured` and again at `reopened`, perform deep FTS integrity
checks and retain these comparisons against `unchanged`:

- all ordered `(term,doc,col,offset)` instances from a temporary `fts5vocab` table;
- all document-size rows and the FTS global document/token count record;
- all `(rowid,spanId,source-text SHA-256)` identities;
- ordered non-literal table row counts and SHA-256 digests, including question search,
  original bytes/spans, code inventory and catalog history;
- all fourteen unchanged Task 053 queries against both original generations: exact
  literal hits/ranks/snippets, question-search ranks and complete answer contexts.

There are 112 query-pair comparisons: 14 queries × 2 generations × 2 non-baseline variants
× 2 stages. Store the raw vectors and query data so the assessment can be recounted.
Record per-object allocation, including mapping indexes and prototype marker overhead;
measure all three compacted totals, without attributing FTS packing savings to text sharing.
Keep runtime identity and diagnostic preparation durations; no timing threshold or tuning.

Decision gate: every mechanical comparison passes; external literal-plus-mapping bytes are
at least 10% lower and external total bytes at least 5% lower than `rebuilt` at `measured`.
Passing permits a separate production migration/hardening task. Otherwise retain the result
and choose the simpler approach or diagnose the failure. No production promotion follows
from merging the report. Normal CI exercises separate owned three-source rehearsals and
mutations of raw token positions, identities and query output to verify the assessor.

FTS rebuild and token-instance inspection follow the official
[SQLite FTS5 documentation](https://www.sqlite.org/fts5.html#the_rebuild_command) and
[vocabulary interface](https://www.sqlite.org/fts5.html#the_fts5vocab_virtual_table_module).
