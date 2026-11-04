# Native compiled qualification driver

Task 109 connects the actual compiled native capture/history service to the independent
assessor. It is a developer-owned driver, with no product endpoint, model request or
source import UI. Existing experimental workers and all exhausted measured families
remain unchanged.

The same-process arm imports the compiled application, records its 37-module runtime
closure plus TypeScript payload hash, prepares owned sources, indexes/analyzes them,
closes the catalog and copies its exact stopped data. The catalog UUID and snapshot
hashes must match before the same process reopens and before a second process starts.
No receipt preexists either arm. The first process retains its real preparation memory;
there is no forced collection, cache clearing, source-service facade or diagnostic hook.
The second process loads the same compiled modules and exact initial snapshot.

Each process records first capture, three repeats, selected capture, root page four,
isolated capture and history after two inventory replacements. Capture uses one actual
OperationBudget across paths, originals, codec and guarded publication. Page navigation
also uses the actual budget. History reopens every saved original, with no path/fact/
snapshot reads and no publication lock. Counters wrap real service calls with scalar
increments only. Source writes, Git calls and legacy history rows must stay unchanged.

An outer 5 ms sampler covers the complete awaited operation. Its final sample and
scalar observations are taken before raw output archiving; filesystem publication and
source-guard completion are inside the measured operation. Native receipt bytes are
read from the fixed catalog/hash location, never from a returned arbitrary filename.
Raw outputs/receipts are saved before evaluation, including partial results on errors.
The observed service metrics must exactly match the retained output artifact.

The parent starts owned process groups with explicit watchdogs, retains stdout/stderr
and exit/signal information, and checks bounded regular-file reports. Cancellation
stops the group and escalates if necessary. A child failure, missing/malformed report,
changed snapshot, changed runtime/catalog identity or failed cleanup cannot disappear
from the required denominators. All operations, seven raw cross-process comparisons,
full typed flow sequences and exact original ranges remain separate from resources.

The unchanged limits are 5,000 ms, 1,000,000 work units, 150 ms sampled intervals,
384 MiB RSS, 64 MiB heap growth, 512 KiB projections, 640 KiB receipts, 64 KiB original
text, 30 spans and 20 sources. Resource limits may only decrease. Preparation/child
watchdogs bound the whole process lifecycle independently of the per-operation limits.
The final family must freeze those lifecycle deadlines as well as all source/compiled
inputs before its first run.

`runNativeQualification({ output, config, configuration, caseId })` requires a new
absolute output directory, trusted configuration module and independently expected
corpus/oracles. It executes compiled `services.mjs` through `child.mjs`. Test-only child
overrides supply failed exit, ignored termination, malformed report, changed snapshot
and a real closed-owner cleanup failure. The normal driver uses the fixed child.

The functional development cases reuse Task 108's small permit examples with a complete
and unsupported consumer. The complete-path oracle independently lists every node and
edge in order, the union of nodes, all root entries, exact original ranges and all four
dependencies. The parser's `java-method` role and extractor's exclusion of the final
empty newline line are explicit. Both initial oracle mistakes and all first test
failures remain retained; no production parser or resource bound was changed.

Run the focused tests with Node 22 after installing and building workspace packages:

```sh
node --test scripts/tests/loredock-native-qualification.test.mjs
```

The tests compile the actual LoreDock entry point once because the normal check runs
tests before the final build. They assert functional completeness and honest resource
rejection separately: loaded CI timing may fail a resource dimension, and that failure
must remain visible. A zero RSS ceiling always fails the resource gate. A successful
small driver regression does not qualify a large project or establish semantic/L5
acceptance. The next task freezes a fresh final-composition family before any large run.
