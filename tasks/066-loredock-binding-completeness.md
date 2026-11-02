# Task 066 — Binding completeness contract

Status: scoped before analysis, 2026-11-02.

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
