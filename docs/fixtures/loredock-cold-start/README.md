# Ordinary daemon cold-start attribution

[Task 130](../../../tasks/130-loredock-cold-start-pause.md) follows the accepted
[Task 129 diagnosis](../loredock-partial-inventory-diagnosis/README.md). PR #162 passes
both exact-head CI events with 1,032 tests at `f3615e6`, before identical-tree merge
`aaec8fd`. Complete CI logs and their hashes are retained in
[accepted-diagnosis-ci.json](accepted-diagnosis-ci.json).

## Prospective first observation

One actual production launch comes first. It registers the four ordinary permit
sources, indexes twelve files, completes analysis of five code files and prepares
the required original-backed path once. The prior ordinary observer retains raw
HTTP bytes, full sources/catalog and the unchanged passive timer/memory journal.
No answer admission or model call occurs.

Then five fresh processes run once each, in this fixed order:

1. Empty control using only the diagnostic runner and passive preload.
2. ESM import of the installed TypeScript compiler.
3. `createRequire` of that exact same compiler file.
4. Import of the actual compiled code adapter.
5. Import of the actual compiled HTTP application, without constructing services.

The compiler is CommonJS. The ESM/CommonJS comparison tests a possible loading cost;
it does not assume the cause or replace production loading. Each component retains
import start/end times, complete raw timer/memory samples, process arguments and
normal exit. Component times overlap in what they load and must not be added or
subtracted as exclusive production costs. They establish neither application
readiness nor resource acceptance. Fresh process/module state does not imply a
flushed operating-system filesystem cache.

The existing external owner bounds the whole diagnostic to five minutes and one
declared catalog root. Every process uses pinned Node with the passive preload;
there are no compile-cache, profiler, heap or GC overrides. The first raw interval
remains included against 100 ms. Unknown errors stop subsequent components; first
results remain immutable. Exact executable inputs and runtime/module identities
are saved before execution. This committed plan precedes the first observation.

## Decision boundary

Only measured attribution may justify a minimal loading change. Such a change must
preserve the same parser and facts, readiness, later analysis/preparation and complete
resource visibility. Deferring work after listen or hiding it in an unmeasured worker
is insufficient. A product comparison must retain its first ordinary result, including
any remaining failure. The consumed Task 128 gate stays unchanged; future qualification
requires new prospective inputs. Defaults, schema and model eligibility do not change.
