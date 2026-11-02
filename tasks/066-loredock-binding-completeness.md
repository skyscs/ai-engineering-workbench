# Task 066 — Binding completeness contract

Status: design completed, 2026-11-02; scope `dc4d625` preceded analysis.

Task 065 fails useful-path qualification because unrelated parser gaps invalidate whole
sources. Specify a narrower, justified uncertainty boundary before another implementation.
This task is design only; retain Task 065's first observations and failed oracle unchanged.

## Scope

- Trace the actual saved index/source inventory and CodeAnalysis unit manifest: distinguish
  known paths with missing facts from unknown path coverage, and parser gaps from eviction
  or integrity failure. Do not infer complete enumeration from parsed-file counts alone.
- Specify per-binding candidate domains for supported relative named imports and Java
  handler/consumer resolution. Keep all alternatives, ambiguity and relevant truncation
  blockers; do not classify arbitrary unsupported syntax as harmless or change parsers.
- Define bounded provenance, coverage summaries and fresh positive/adversarial qualification
  cases, including source path omissions, target exclusions, missing inventories, language
  boundaries, root/branch consequences and maximum admitted file volume.
- Update the integration/roadmap/status sequence. No product/prototype behavior changes,
  parser/schema/API/UI changes, model/corporate access or frozen experiment reruns.

## Delivery

Commit scope before analysis. Add the concrete contract and verify code/document references
and the full diff. Avoid redundant runtime/browser checks for prose-only work. Publish a
separate PR after Task 065 merges; verify both exact-head CI events before merge. A fresh
offline qualification, not production adoption, follows this contract.

## Outcome

Added [the completeness contract](../docs/loredock/BINDING_COMPLETENESS.md). Relative imports
use their exact supported target-path alternatives; Java handler/consumer searches retain
all potential same-source Java files. Relevant gaps/truncation/exclusions and unknown path
coverage still block positive uniqueness. Cardinality and incompleteness remain separate.

The audit also finds that code-manifest completeness alone misses paths omitted by catalog
source shares. The successor must inspect all admitted tree metadata, source readiness and
omission counters, and verify complete metadata against the recorded Git tree ID before
using absent paths as evidence. Independent tree vectors and excluded-row removal cases,
opaque boundaries, bounded metadata bytes, lifecycle fences and useful large-input paths
are included in the next prospective qualification. No Git call is added to projection reads.

Roadmap/integration/status updated; local references and full prose diff reviewed. No parser,
application/prototype behavior, schema, retained measurement or owner demo changes. No
runtime/browser/frozen experiment reruns were needed for this design-only task.
