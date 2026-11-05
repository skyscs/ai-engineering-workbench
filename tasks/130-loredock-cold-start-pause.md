# Task 130 — Attribute and reduce the daemon cold-start pause

Status: ordinary attribution and minimal loading improvement complete; result awaiting
exact-head CI and merge. See the [retained result](../docs/fixtures/loredock-cold-start/README.md).
The raw startup-gap limit remains failed.

## Evidence and objective

The four ordinary Task 129 daemons all exceed the unchanged 100 ms raw timer-gap
limit in their first interval, at approximately 283–333 ms. The consumed Task 128
run also failed this limit in all fourteen observations. Useful context in the
Task 129 controls does not resolve this resource failure.

Attribute startup work before choosing a fix. Implement only the smallest justified
change that reduces blocking while preserving readiness and real analysis behavior.
If the cause cannot be fixed safely within this slice, retain the evidence and scope
the specific remaining work; do not substitute another measurement for the failed one.

## Sequence

1. Review the actual production entry, its eager import graph, initialization and
   passive monitor ordering. Separate measured facts from suspected causes. In
   particular, a large dependency in the graph does not prove its timing contribution.
2. Declare a bounded ordinary diagnostic before executing it. Retain the first
   whole-entry observation and a small set of fresh-process component observations
   with exact module/runtime identities. Diagnostic import timings are attribution
   evidence, not production resource acceptance. Do not use the consumed kiln inputs.
3. Choose a minimal change only when supported by those observations. Preserve the
   service's readiness contract, cancellation/shutdown, bounded work, errors and
   useful analysis. Do not move the pause after listen, exclude startup samples,
   warm the candidate before its first observation, relax limits or hide work in an
   unmeasured worker. An off-thread design requires explicit total-resource ownership.
4. If changed, add focused regression coverage for the affected behavior and run
   one declared ordinary production comparison through actual source registration,
   indexing, analysis and public preparation. Retain the entire lifetime, first
   failures, raw timer/memory samples, sources and complete stopped catalogs.
   Original-backed useful context and truthful partial coverage remain required.
5. Record what improved and every remaining failure. Verify relevant checks and
   both exact-head CI events before merge. Scope the next bounded fix from evidence.

## Boundaries

- No corporate inputs, model calls, default activation or Workbench bridge.
- Preserve Task 127/128 original inputs, driver, manifest, raw results and failed gate.
  Any future qualification requires a new prospective family and contract.
- This is ordinary development diagnosis and repair, not semantic/resource acceptance.
  Component timing or a faster startup alone cannot qualify the complete product.
- Near-limit heap, list work, browser RSS and required native-output size remain
  separate known failures. Do not broaden this task to repair them.
- No parser capability expansion or schema changes without separately scoped evidence.
