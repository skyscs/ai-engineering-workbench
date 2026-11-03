# Streaming snapshot candidate validation

Task 081 is functionally verified on 2026-11-03. Scope `25764e9`, implementation
`94ccbdf`. Full pinned Node 22.23.2 checks pass 519 tests, strict typechecking and
builds. No frozen corpus, profiler or resource qualification is executed here.

The [opt-in factory](../../../scripts/loredock-streaming-snapshot/README.md) replaces
only snapshot header allocation. Actual SQLite differential checks preserve empty
and mixed parsed/unparsed snapshots, escaped/non-ASCII manifest input, ordered IDs,
late-row corruption detection, count/byte/checkpoint rules, parser/limits/policy/
publication fences, missing inventory and revocation. Exactly 10,000 saved headers
pass and 10,001 fail in both implementations. The candidate still succeeds when
complete header-array materialization is explicitly prohibited. Subsequent reads
after a refused iterator retain exact baseline equality.

The full child-process regression uses the independent three-source locker fixture.
Candidate preparation and capture, baseline reopening and a fresh candidate control
all run eight operations: first, three repeats, selected path, offset-four page,
isolated path and history after eviction. All 24 operations pass, with byte-identical
receipt/projection content, complete original support and identical shared work.
History performs no nested path/fact/snapshot work. Process stdout/stderr/exits are
retained automatically on failure; the first process regression succeeds.

The first focused snapshot run passes one test and fails the other because the
test calls the real revocation transaction inside its rollback savepoint. That
test-only setup error is fixed by running final revocation outside the savepoint.
The original failure log remains; the corrected three-test suite, focused typecheck,
process regression and first full check pass. `validation.json` records every log's
exit, raw byte length and SHA-256; `.log.gz` files preserve exact content.

Production source hashes match the pinned baseline. The normal daemon and all old
measured code/results remain unchanged. Allocation reduction and history RSS are
unmeasured. A fresh uninstrumented complete-capture/history qualification with
unchanged limits must precede any production promotion.
