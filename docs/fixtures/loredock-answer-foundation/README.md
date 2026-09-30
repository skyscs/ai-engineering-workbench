# LoreDock answer foundation evidence

Historical checkpoint. The [subsequent answer pilot record](../loredock-answers/README.md)
adds CLI 0.159.2 qualification, improved retrieval, durable answers, browser acceptance
and real-model evaluations. The original results below are preserved unchanged.

Date: 2026-09-30. Linux, Node 22.23.2, CLI 0.158.0. This is a partial Task 016
checkpoint, not answer acceptance. Both experiments made **zero real model calls**.

- [Runtime result](runtime-result.json): eight helper checks passed; two loopback
  protocol requests produced one fixed structured response and one HTTP 400 error.
  Token values inside `structured.stdout` are intentionally synthetic protocol data.
  They are not measured model usage. The runtime remains `not-qualified`.
- [Retrieval result](retrieval-result.json): production catalog/retrieval exercised
  all 20 frozen questions; ten retrieved all expected evidence. Missing evidence is
  recorded per question. No AI answer correctness or semantic-support score exists.

The [interpretation and continuation plan](../../loredock/ANSWER_FOUNDATION.md)
describes remaining gates. These files contain synthetic evidence and installation
identity only; no credentials, normal source checkout or account state was inspected.

## Reproduce

Use the repository's pinned Node/pnpm versions and build first:

```bash
pnpm build
node scripts/loredock-runtime-probe.mjs \
  --executable /absolute/path/to/codex \
  --sandbox-helper /absolute/path/to/installed/native/codex
node scripts/loredock-retrieval-evaluation.mjs
pnpm check
```

The sandbox helper must belong to the same selected CLI installation. For npm installs,
inspect the package's launcher and platform package to locate the native executable;
do not choose a different installation silently. Temporary inputs and homes are removed
afterward. Runtime diagnostics require Linux sandbox support and permission to bind a
loopback listener. Ordinary tests do not execute the installed CLI or a real model.

Verification: `pnpm check` passed 170 tests (17 Git, 14 AI, 43 storage, 57 Workbench
service/HTTP, 23 LoreDock and 16 script tests), strict typechecks and production builds.
No browser review was performed because this checkpoint changes no HTTP or UI behavior.
The L1 browser evidence remains in [the source-catalog record](../loredock-catalog/README.md).
