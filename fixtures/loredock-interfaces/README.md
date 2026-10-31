# Prospective freight interface qualification corpus

This is a new synthetic system for Task 033, separate from the earlier commerce corpora.
Its source bytes, deterministic revisions and fourteen-question reviewer contract were
frozen in commit `8ced7ae` before retrieval measurements or any new model output.
`baseline.json` records the freeze timestamp, twenty revisions, manifest/contract hashes
and the source/generator file hashes. Do not edit the frozen files to improve a result.

The system has **20 repositories / 47 eligible files**. Six repositories contain freight
clients, route declarations, an edge helper, a ledger worker, contracts and environment
declarations. Fourteen README-only repositories provide unrelated orientation context;
this is not a realistic measurement of twenty large services. Every repository includes
three artificial exclusions: an `.env` canary, a binary file and an external symlink.
No real secret, private source, remote service or source execution is involved.

`corpus.mjs` contains source text. `cases.mjs` contains **14 questions / 38 required
propositions and qualifications**, with forbidden assertions and a future-run contract.
The generated `RUBRIC.md` is a reviewer worksheet. Expected answers, questions and
rubrics never appear inside registered source roots. `manifest.json` and `oracle.json`
are written outside those roots by the fixture generator. Only question strings enter
production retrieval; the offline evaluator inspects expectations afterward.

The ten interface cases cover ASCII case, renamed and punctuation-different keys,
dynamic/spread/getter values, empty declarations, integer conversion, an explicit
unwired rewrite helper and binding ownership. Four fresh regressions cover a README/
configuration disagreement, incomplete interface implementations, distinct environment
scopes and a source-embedded assistant instruction. The latter is a bounded test of
instruction handling, not comprehensive prompt-injection qualification.

All cases are prospective but authored and inspected by the development agent. They are
not blind, independently reviewed or private-project acceptance. Keep every extra claim
in semantic review; reference recall and a valid citation are not correctness scores.
Earlier failed gates remain failed.

```sh
node scripts/loredock-interface-fixture.mjs
node scripts/loredock-interface-qualification.mjs --rubric
node scripts/loredock-interface-qualification.mjs
```

The first command creates an owned temporary directory and prints its path; remove that
owned directory after inspection. The evaluator uses production services built by
`pnpm check`, cleans its own generated directories and makes zero model calls.
See [measurements and limits](../../docs/fixtures/loredock-interface-qualification/README.md).
