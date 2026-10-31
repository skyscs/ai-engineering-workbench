# Prospective interface qualification design and retrieval

Task 033 freezes a new twenty-source freight system, fourteen questions and 38 required
propositions/qualifications before evaluating any new model answer. The source/contract
freeze commit is `8ced7ae`; contract SHA-256 is
`6ad7b2d57f3a55e391e778f634813dffeba5d4baa5821759eb6c33132cb04ba6`.
See the [corpus](../../../fixtures/loredock-interfaces/README.md) and
[review rubric](../../../fixtures/loredock-interfaces/RUBRIC.md).

## Observed result

`retrieval-result.json` records production retrieval v7 / prompt v9 over two fresh
generations. All **14/14** questions receive their recorded reference basis; all **38**
requirements have their listed originals. The evaluator verifies **388 span occurrences**
against **47 original Git files**, including source ownership, revision, blob, full-file
hash, line range and span hash. Original selection fingerprints, comparison support sets
and requirement availability are unchanged across the generations. Maximum context is
30 passages, **5,157 source bytes** and **34,124 prompt bytes**, within existing limits.
Source checkouts remain clean and generated data is removed. Model requests: **zero**.

The six-comparison budget is visible: the question's specific comparison is supplied in
**6/10** interface cases (`i01`, `i02`, `i03`, `i05`, `i06`, `i09`). In `i04`, `i07`, `i08`
and `i10`, the original reference basis is complete but that particular derived clue is
not in the supplied block. Preserve this limitation in the next run; do not change the
product, question wording or expected outcome to hide it. The model can still reason
from the originals; the planned semantic gate applies to the complete answer.

The initial recorder compared citation arrays in their emitted order. Those arrays sort
by ephemeral evidence IDs, so fresh generations can reverse otherwise identical source
references. The final metric canonicalizes **only each comparison's original support
set**, retaining endpoint/claim changes and comparison selection order. The separate
`changedSupportOrder` field records raw reference-order changes. This is a diagnostic
metric correction, not product tuning or a changed answer score. A focused test rejects
ownership or comparison-status changes despite normalization.

## Next execution contract

One future run may use at most **14 application attempts**, 120 seconds each, with no
automatic retry or second run. Before dispatch, freeze implementation hashes and the
qualified selected runtime identity for `gpt-5.6-terra` / medium, prompt v9, retrieval v7
and answer schema v3. Preserve raw outputs, exact context/prompt, usage, failures and
original source support. A failure is retained; it is not silently retried.

Review every claim, citation, unanswered question, required proposition and forbidden
assertion manually against originals. Equivalent source evidence can satisfy a
requirement even if a named reference is absent. Passing requires all fourteen cases and
no materially unsupported extra claim. Independent review stays separate from the
development-agent assessment. Neither this small synthetic corpus nor a future pass
will establish broad framework coverage, private-project acceptance or L5 readiness.
Tasks 027 and 030 remain failed regardless of the new outcome.

## Reproduction

```sh
pnpm check
node scripts/loredock-interface-qualification.mjs > /tmp/loredock-interface-retrieval.json
```

Use the supported Node 22 toolchain. Fixture/evaluator tests check frozen source hashes,
repeatability, original ownership/bytes, exclusions, oracle separation and support
normalization. Task 033 changes no product, UI, prompt, schema or runtime; the Task 032
browser acceptance remains applicable. No real model has been called for this corpus.
