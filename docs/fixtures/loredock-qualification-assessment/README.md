# Offline assessment development evidence

Task 084 uses independent tiny owned inputs and saved-artifact mutations. It does
not execute or reinterpret an exhausted resource family. The
[helper documentation](../../../scripts/loredock-qualification-assessment/README.md)
records its API, dependency states, preserved codec boundary and concrete positive/
negative adapter capability review.

Each supported/unsupported-name case executes two real child processes and eight
operations per process. The supported case preserves ten originals and complete
write-ending paths. The negative `onReserved` case preserves seven originals and
an explicit unresolved-consumer gap; applying the positive oracle rejects it.
Neither constitutes large-workload resource qualification.

Saved-byte mutations cover false usefulness, source-support mismatch, missing or
hash-invalid first artifacts, invalid UTF-8/JSON/versions/duplicate keys, changed
history projection/originals/dependencies, invalid resources/counters, process and
cleanup failures, absent operations, malformed wrappers, and bounded-path refusals.
Independent byte/history/resource checks remain available after content failures;
the overall gate still fails. History assessment never calls application services.

The first focused run failed because the extracted codec expected a graph on a
root page, whose real schema deliberately uses `graph: null`. Receipt decoding
stays strict; page decoding now handles this explicit shape. The same first
development typecheck rejected an `assert.throws` overload in the test; its message
argument is corrected. Both original logs and the first child's exact raw files,
worker report, metadata, assessment, stdout/stderr and exit are retained. The
archive excludes databases, source checkouts and any external project data.

`first-child-artifacts.jsonl.gz` contains bounded JSONL frames with relative names
and base64 bytes. `validation.json` records its frame count, archive hash and size,
plus every compressed log's original byte length, SHA-256 and exit. The first
corrected focused run passes; a later review adds explicit wrapper independence,
stable applicable denominators and blocked content dependencies. Full verification
is repeated after those changes: all 529 tests, strict typechecks and builds pass
on Node 22.23.2 with pnpm 10.15.0. No original failure is overwritten.

All measured producers/readers, frozen fixtures and historical scores through
Task 082 remain unchanged. Streaming remains unqualified; no production settings,
corporate code, model execution or user demo is involved.
