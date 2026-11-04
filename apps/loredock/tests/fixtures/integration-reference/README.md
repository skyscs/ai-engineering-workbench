# Portable pre-integration behavior reference

Task 100 preserves exactly two control modules from
`1ddac18c1aed79df9c80f1949f37aeede5c6a721`: `store.ts` and `code-analysis.ts`.
Their original bytes remain in `.ts.txt` files. The manifest records revision,
original paths/hashes, TypeScript 5.9.3 implementation/options, emitted hashes,
explicit import relocations, executable module hashes and thirteen unchanged
runtime dependency files. It also lists external imports. Node behavior remains
the repository's pinned runtime contract, not an archived Node installation.

`compile.mjs` verifies deterministic TypeScript emission and replaces only declared
relative import literals using parsed source positions. It does not execute or
rewrite application code. The committed `.mjs` modules run through the existing
test loader against source dependencies, without generated daemon output, Git
history, network or old worktrees. `index.ts` is a test-only facade for their
unchanged public interface; casts do not claim shared private service ownership.
Never instantiate both analysis classes against one catalog to test a shared guard.

The reference deliberately shares the current `codeAnalysisFingerprint` provider.
That unchanged function hashes current implementation bytes, including production
`code-analysis.ts`. This gives paired behavioral comparisons the same test identity
basis. It does **not** replay a historical runtime/fingerprint. Real upgrades change
that fingerprint; separate production integration tests must cover stale inventory
refusal, explicit reanalysis, changed generations and backward reopen. Original
historical measurements remain at their own recorded revisions and hashes.

## Migrated controls

| Ordinary test/configuration | Preserved control |
| --- | --- |
| `memory-runner-config.ts` | Supplies the archived store and analysis classes to independent tiny memory/streaming/terminal/compact/prepared/worker/canonical configurations. Current other services and unchanged frozen factories remain explicit dependencies. No frozen resource family is imported. |
| `streaming-snapshot.test.ts` | Calls the archived array-based snapshot prototype as the independent reference, retaining late-row corruption, mixed/empty/escaped manifests, limits, authorization and iterator-release assertions. |
| `worker-reads.test.ts` | Uses the archived unscoped worker and its shared module guard. Exact SQL/current bindings, preparation reduction, lifecycle/overlap, receipt/history and refusal assertions remain unchanged. Original manifest hashes resolve these two source paths to their archived bytes. |
| `canonical-pair.test.ts` | Keeps the mechanical fork comparison and every original manifest hash; only those two production source paths resolve to preserved originals. Other dependencies still read current files and must match. |

`integration-reference.test.ts` verifies original source bytes, compiler/relocation,
the recursive runtime import closure and both original manifests. A fresh stopped
tiny catalog is opened with separate reference and production owners: summaries,
snapshots, full file payloads, no-write reads and corrupt-checkpoint refusals agree.
A separate process with an unrelated working directory and no Git executable on
PATH loads the reference successfully. The first focused run occurs before any
daemon build and passes 23 cases/subcases, including all migrated comparisons.

No application module imports this fixture. Changing the source-bound reference
requires an explicit new control/migration decision; do not regenerate these files
merely to make a future behavior mismatch or source-hash failure disappear.
