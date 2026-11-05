# Task 135 — Design owned compiler isolation

Status: scoped after Task 134; begin after both exact-head CI events and identical-tree merge.

## Evidence and objective

Task 130 removed redundant compiler loading but the ordinary production startup still
exceeded 100 ms. Task 133's unchanged production controls still show 167–173 ms raw
gaps. Task 134 demonstrates a separate browser baseline constraint; it does not resolve
daemon startup or near-limit heap. Keep those failures separate.

Design the smallest owned off-thread boundary that could remove eager TypeScript
loading from the main event loop without moving an unmeasured pause after listen.
This task is design only: no worker implementation, schema/default/model-policy change,
application execution or qualification rerun.

## Required analysis and decision

1. Trace the actual startup import closure and parser call sites from current source.
   Identify synchronous contracts, parser/version fingerprints, cancellation paths,
   source authorization, SQL write ownership and memory-retention boundaries.
2. Compare compiler-only isolation with a complete file-parser boundary. Prefer one
   explicit owner and bounded single-flight work. Describe request/result validation,
   transfer bytes, queue limits, errors, startup, cancellation, shutdown, process exit,
   code-analysis replacement and unsupported/partial analysis behavior.
3. Define whole-resource attribution before choosing worker threads versus a child
   process. A worker's heap/work/time/CPU cannot disappear from accounting. Preserve
   existing global ceilings or explicitly identify where the old observer cannot
   measure the proposed architecture. Do not claim that main-thread heap is total heap.
4. Keep published inventory/source transaction authority in the existing owner. Do not
   let asynchronous parser completion publish stale results, outlive cancellation or
   bypass source/build/policy fences. No source execution or unbounded background cache.
5. Record an ADR and a narrowly scoped implementation task with prospective ordinary
   controls: empty startup, real useful indexing/preparation, cancellation/shutdown,
   malformed/oversized messages, worker failure and near-limit memory. Preserve first
   failures and exact parser meaning; any fingerprint change requires honest reanalysis.
6. Verify source/doc links and both exact-head CI logs before merging the design.

The current browser still fails raw summed RSS. A future browser environment or metric
decision requires its own prospective contract; it is not part of compiler isolation.
Full repaired qualification still requires a fresh family. Preserve all consumed
families, original manifests, driver seals and retained observations unchanged.
