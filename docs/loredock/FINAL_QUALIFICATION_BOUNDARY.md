# Final compiled qualification boundary

Task 102 reviews the production implementation accepted for Task 101 and the
unchanged offline complete-capture harness. **Do not freeze a resource family by
passing the production v1 reader through a schema-renaming adapter.** That reader
does not implement the operation the existing qualification measures.

This review changes delivery order, not previous results or acceptance thresholds.
Task 101 remains a functionally verified representation integration. Task 097 remains
a successful experiment over its exact pinned implementation and marker-heavy input.
Neither establishes scale acceptance for a different compiled composition.

## Source findings

| Boundary | Production v1 | Complete-capture requirement | Consequence |
| --- | --- | --- | --- |
| Operation ownership | `CodePaths.read` accepts request, kind and signal; `PathWork` owns a path-only budget. | Receipt capture owns one budget before reading paths, claims one path, charges every path and receipt unit and retains one deadline through publication. | Passing a fourth argument to v1 is ignored at runtime. Zero path charges or a fresh deadline cannot count as complete accounting. |
| Work observation | Checkpoints report cumulative units at cooperative yields. The final tail and synchronous publication do not emit a final charge report. | The worker independently sums every path/receipt charge and compares both subtotals to operation metrics. | Last-checkpoint units are not exact totals. Monkey-patching `PathWork` would change the measured composition and violate the no-hook observation contract. |
| Topic semantics | The resolver requires one matched `orderTopic` setting plus compatible contracts; literals only reject contradictions. It admits some dynamic expressions as explicitly uncertain candidates. | Every delivery edge carries exact nonempty direct Java literal witnesses at both endpoints, bounded to 256 UTF-8 bytes, with original evidence. | A v1 delivery edge cannot generally supply this witness. Reading/evaluating extra inputs or deleting the edge changes derivation/support. |
| Identities | Envelope/display/adapter are `loredock-code-paths/1`, `loredock-connected-display/1`, `connected-paths-v1`. | The offline validator requires its shared-capture namespaces, topic rule and accounting identity. | The unchanged validator correctly refuses native v1 output. Renaming these fields is not a transparent format conversion. |
| Derived IDs and selection | Generation hashes the complete identity; node/edge IDs include generation and adapter; flow IDs and graph/projection hashes also depend on versioned content. The reader checks generation-bound root selection. | Repeats and both processes must preserve exact bytes; selected roots/pages must address that same generation. | Updating only the envelope hash leaves inconsistent provenance. Rewriting all IDs and translating pins creates a new producer, not the actual v1 reader. |
| Publication/history | Production serves a read-only path projection. It has no native capture publisher or receipt-history API. | Capture validates all originals/dependencies and publishes once inside a final synchronous guarded handoff. History reopens exact bytes after two replacement inventories without reading facts or paths. | A path-only timing run cannot satisfy the sixteen complete-capture operations or their publication/history gates. |

The relevant source is explicit:

- [Production reader](../../apps/loredock/src/code-paths.ts),
  [work owner](../../apps/loredock/src/code-paths-work.ts),
  [resolver](../../apps/loredock/src/code-paths-resolve.ts) and
  [admission](../../apps/loredock/src/code-paths-admit.ts).
- [Offline shared work](../../scripts/loredock-capture-memory/paths.mjs),
  [literal rule](../../scripts/loredock-literal-topics/topic.mjs) and
  [receipt validator/publisher/history](../../scripts/loredock-capture-memory/receipt.mjs).
- [Worker](../../scripts/loredock-streaming-qualification/run.mjs),
  [observation validator](../../scripts/loredock-streaming-qualification/validate.mjs),
  [independent assessment](../../scripts/loredock-qualification-assessment/assess.mjs),
  [complete-support assessment](../../scripts/loredock-terminal-memory/complete.mjs)
  and [process coordinator](../../scripts/loredock-compact-qualification/coordinator.mjs).

The Task 101 compiled reader has the same three-argument surface and native v1
identities. Task 099's [typed operation budget](../../apps/loredock/src/operation-budget.ts)
exists but is not connected to it. Hashes of reviewed source and the already checked
Task 101 build are [recorded](../fixtures/loredock-final-qualification-boundary/review.json).
No application observation or frozen corpus execution was needed for these findings.

## Corrected delivery order

1. Keep Task 101's integrated v1 service and current browser behavior. Its independent
   controls, exact SQL/work/output regressions and explicit fingerprint transition
   remain the functional acceptance basis. Do not add an optional path-only scale
   experiment merely to substitute for missing complete-capture evidence.
2. Implement an internal **versioned typed path producer** using direct-literal
   witnesses and Task 099's real shared budget. Preserve full validation, compact
   canonical entries and scoped reads. Use distinct native v2 envelope/display/
   derivation identities from the start, without exposing a route or switching the
   browser. Require one path owner per catalog across both v1 and v2 services.
3. Separately scope typed capture/history and its trusted storage ownership,
   interruption, publication, purge and recovery contract. Port actual validation,
   all charges and the final guard; do not depend on an experimental publisher in
   production. There is still no receipt endpoint or answer/review consumer before
   these lifecycle decisions. Port independent assessment for the native version,
   explicitly preserving semantic/support/accounting checks and old test controls.
4. Prove the final compiled composition on independent tiny inputs first. Then freeze
   a fresh source-authored resource family, source/build identity, oracle and complete
   process plan **before** observing it. Run the unchanged numerical/resource gates
   over the actual typed producer and capture implementation in both processes.
5. Only after that composition passes, scope the browser migration and its real HTTP,
   lifecycle, historical-version and desktop/mobile checks. Native history/answer/
   review consumers follow their explicit acceptance order. Private-project knowledge
   quality, incident relevance and L5/Workbench routing remain separate gates.

This replaces the conditional v1 identity-translation option in Task 098. It avoids
building a second adapter whose semantic and accounting repairs would themselves
require qualification. Distinct identities are deliberate: old v1 or experimental
records must never be relabeled as native v2 output.

## Preserved acceptance contract

The later complete operation still has a single 5,000 ms / 1,000,000-unit budget,
150 ms maximum sampled interval, 384 MiB sampled RSS and 64 MiB heap growth. Retain
512 KiB projection / 640 KiB receipt / 64 KiB original text / 30 spans / 20 sources.
No GC/profiler/phase/query/owner hooks in the qualification; ordinary read/write/Git
counters, exact aggregate charges and the outer 5 ms resource sampler remain.

Both processes start from identical stopped catalog bytes. Preserve first capture,
three exact repeats, selected root, page 4, isolated root and recorded history after
two replacements: **16 operation denominators**, 14 useful projections and seven
cross-process exact byte comparisons. Preserve complete source support, every scope
dependency, all originals, unchanged legacy consumers and normal owner shutdown.
Missing or blocked work remains a rejected gate. Archive raw artifacts before
independent assessment, including first failures and watchdog/process exits.

Native v2 identity changes require a separately reviewed strict decoder/assessor;
they do not justify accepting arbitrary aliases or editing old expected hashes.
No earlier failed family is rerun, discarded or reinterpreted. No corporate or model
input enters this work. The next bounded implementation is
[Task 103](../../tasks/103-loredock-versioned-path-producer.md).
