# Completeness and paraphrase retrieval diagnosis

Date: 2026-10-31. Task 028. **Zero model calls.** Product retrieval v6, prompt v8,
schema v3, source corpus and earlier model results are unchanged.

The [frozen prospective benchmark](../../../fixtures/loredock-completeness/README.md)
separates requested propositions, necessary qualifications, optional context and
forbidden assertions. Read the [complete alignment review and next implementation](../../loredock/ANSWER_COMPLETENESS.md).
Task 027 remains failed under its original criteria; this is not a revised passing score.

[Retrieval result](retrieval-result.json) records two fresh twenty-source generations:

- 12/12 development questions retrieve their complete recorded evidence basis.
- 10/12 reserved wordings do so; h02 misses the shared StockReserved JSON contract,
  and h04 misses the Reservations method body.
- All twenty-four selections and requirement results are stable across fresh IDs.
- Maximum context: thirty spans, 8,429 text bytes, 31,993 prompt bytes. Existing caps
  remain thirty spans / 64 KiB text / 96 KiB prompt.
- Exact locators, reference alternatives, requirement gaps, search/expansion terms,
  selected order and bounded FTS candidate positions are retained. The report also
  diagnoses saved s04/s07/s14/s19/r04 evidence positions and citation use in v7/v8.

The h02 handler record already supplies the message fields even though the chosen
JSON witness is omitted. Missing a recorded reference is a retrieval measurement,
not automatic proof that the answer is impossible or semantically wrong. A reviewer
must assess equivalent supplied evidence and all volunteered claims separately.
The h04 route label does not supply the omitted handler implementation.

After the normal Node 22 / pnpm build:

```sh
node scripts/loredock-completeness.mjs
node scripts/loredock-completeness.mjs --rubric
```

Both commands are offline and use no configured model connection. The first creates
and removes owned synthetic repositories; ordinary checkouts are not modified.
Tests pin the contract and historical files, verify original evidence and alternative
semantics, reject wrong ownership/revision/hash/ranges, and assert that production
retrieval receives only question strings. Full `pnpm check`: 310 tests, strict
typechecks and production builds. No browser run is needed for evaluator/documentation
changes; the product/UI is unchanged.

Reserved wordings have been inspected for retrieval and were authored after the prior
failures by the same agent. They are not a blind independent corpus; no answering-model
output exists for them. Next: bounded literal-reference retrieval/admission improvements
with the existing caps, followed by a separately budgeted answer evaluation.
