# Explicit legacy asynchronous compatibility delta

The original synchronous modules and ordinary evaluator sources come from accepted
commit `278830b437727181385d61b958bb66191d9a9175`. Original source, emitted bytes and
SHA-256 values are retained here. `deltas.json` declares line edits to the current
implementation; the verifier reconstructs and checks those edits, exact TypeScript
emission and both new internal modules before returning historical bytes to older
integrity checks. Existing historical manifests, seals and observations stay unchanged.

This is an explicit compatibility migration, not a resource qualification or a replay
of a consumed execution family. Ordinary evaluators await production results. The
reserved prepared-flow driver and native-question-context prototype remain unchanged.
Fresh stopped-catalog comparisons separately verify exact graphs, contexts, corrections,
prompts and saved v1/v2 answers. Added authority reads retain their actual accounting
cost; they are not removed from production measurements by this test-only normalizer.

No application module imports this fixture. Original bytes are never regenerated to
accept a behavior mismatch. Later edits require a reviewed update to the declared
delta and renewed behavioral checks.
