# Larger exact-symbol qualification design

Frozen prospectively for Task 048, 2026-11-01. This evaluates the merged Task 047
lookup path; it is separate from the Task 041 capacity benchmark and Task 044 offline
inventory feasibility result. Historical corpora, raw reports and scores remain unchanged.

## Inputs and attempt budget

Use the unchanged Task 041 workload: twenty sources, 180 added 2,048-byte TypeScript
functions per source, 3,679 eligible files / 7,389,669 bytes and sixty known exclusions.
Its 3,621 code candidates include original Java/JS/TS/Vue/Dojo examples. Verify all frozen
parent manifests, revision vectors and hashes before measurement. Generated source code
is never executed. Only owned temporary repositories and data directories are permitted.

Commit this design, cases and baseline before the harness. Commit the verified harness
before the measurement. One fresh full-size generation, one initial index, one durable
analysis if indexing publishes, and two ordered passes of the nine cases are allowed.
No refresh, resume, retry, repeated generation, real model or production code change.
Unpublished stages stop dependent work and are reported, not silently restarted. Individual
query errors are retained once; remaining cases still execute within the fixed budget.

The query list is fixed in cases.mjs: first/middle/last-source tail functions, qualified
Java method, a shared simple name in four repositories, Java class name, unsupported Vue,
wrong case and nonexistent name. Expected source/file/symbol sets are predeclared.
Original corpus knowledge informs this mechanical oracle; it is not a blind semantic set.

## Measurement

Use compiled production Catalog, CatalogStore, CodeAnalysis and lookupCodeSymbols with
their unmodified limits. Capture code/parser/build/dependency identity, Node version,
actual generated baseline, index and analysis results. Time fixture setup, indexing and
analysis separately. For each lookup, time only the asynchronous production call. Count
JSON response bytes and retain the entire raw response/error. Independently reopen every
returned original and compare its owner/path/revision/blob/content and line text with
the fixture manifest and Git at the recorded revision, outside lookup timing.

Record per-query start/end sampled RSS and a 100 ms process RSS peak. This is shared-process
memory, including fixture/indexing allocations; it is not isolated query memory or a hard
peak bound. Record elapsed times individually, then median and maximum. The second pass
uses the same inventory and a warm process/filesystem; there is no query/parser cache claim.
Compare normalized result identities, ranges, original references, limits and coverage.
The default graph is inspected once only to verify the predeclared omitted Java method.

## Prospective interpretation

Mechanical success requires every expected match with no extras, all 3,621 retained files
checked for every query, valid original support, no lookup time/output omission, consistent
repeat results, unchanged source checkouts and zero answer attempts. The known six affected
syntax files / seven gap messages remain explicit. Unsupported/no-match responses must
retain the limitation that absence is not established. All responses stay within production
twenty-match / 256 KiB bounds. No automatic source selection or answer-quality conclusion.

The local practical target is at most 5,500 ms per lookup. Report this separately from
mechanical success. The production five-second check is cooperative between files; manifest
and final validation overhead can extend total wall time. A target miss is retained even
when the result is otherwise valid. No threshold adjustment, tuning or rerun in this task.
This simple synthetic volume does not represent complex frameworks, 20 corporate repositories,
independent semantic acceptance or a production latency commitment.

## Small checks

CI may verify the frozen contract and pure protocol/comparison logic. A separate five-file-
per-source shape may exercise the harness using mapped tail probes 0004, while preserving
all other queries and clearly labeling the result as a smoke. That check does not consume
or replace the single full-size measurement. No full-volume generation runs in CI.
