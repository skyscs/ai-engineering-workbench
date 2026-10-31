# Frozen interface answer qualification

Task 034 executes the [Task 033 prospective contract](../../../fixtures/loredock-interfaces/README.md)
without changing sources, questions, retrieval v7 or prompt v9. Same-agent synthetic
coverage is not a blind benchmark or independent acceptance. Historical Tasks 027
and 030 remain failed and unchanged. Four of ten interface cases lack their specific
derived clue under the existing six-comparison cap; all recorded originals are present.

## Execution boundary

- One run, at most fourteen application dispatches, no automatic retry, 120 seconds
  per attempt. Stop at the first operational failure; do not replace a failed case.
- Qualified selected personal CLI, `gpt-5.6-terra` / `medium`, `text-only-v2`.
  `selected-preflight.json` records non-secret identity metadata and zero model calls.
- `evaluation-contract.json` pins the frozen question/source baseline, daemon source,
  runtime/core source and consumed compiled package bytes, dependency lock and runner.
  The CLI loads daemon TypeScript through the repository's `tsx` dependency, avoiding
  stale daemon build output. Commit the contract before the first dispatch.
- A repository-local exclusive claim in `.loredock-evaluations/task034-interface.json`
  blocks accidental repetition with another output path or freshly dated contract.
  It survives process failure; this is a local guard, not a cross-clone spending service.
  Do not remove the claim to repeat the exhausted protocol. Tests use isolated ledgers.
- Each attempt is checkpointed before dispatch. Raw returned text and token usage are
  saved before answer validation. Exact issued prompt, original spans, derived comparison
  block, versions, runtime identity and failure details remain in `answer-result.json`.
  CLI-internal provider retries/requests are not exposed by the adapter.
- Only owned synthetic Git fixtures are indexed. Reviewer requirements stay outside
  source roots and model inputs. The runner removes its fixtures after execution.

The historical invocation is recorded for reproducibility, not authorization to rerun:

```sh
pnpm --filter @loredock/daemon exec node --import tsx \
  ../../scripts/loredock-interface-answers.mjs \
  --contract /absolute/path/to/evaluation-contract.json \
  --output /new/owned/output-directory
```

## Review boundary

Review every claim, original citation, unanswered question, required proposition and
forbidden assertion. Retain known source disagreements and scoped missing implementation
facts. Do not substitute reference recall, citation resolution or schema validity for
semantic review. Equivalent original evidence may satisfy a requirement even if a
particular reference was not selected.

The independent worksheet remains unchecked. A reproducible audit verifies original
Git bytes, ownership, hashes, ranges and complete judgment coverage; it does not prove
the agent's semantic judgments. The raw run remains immutable after review, so its
pending review labels are superseded only by separate review artifacts.

## Result

Frozen in commit `e2205be` before dispatch. The only run started at
2026-10-31T20:43:42.373Z and finished at 20:45:40.153Z. All fourteen attempts completed
operationally. Agent semantic review passes **8/14: 5/10 interface and 3/4 regression
cases**. The all-case gate **fails**. This is a different corpus/rubric from earlier
runs, not a controlled score comparison or evidence of a causal prompt improvement.

| Cases | Recorded problem |
| --- | --- |
| i01 | Both header names are stated, but their case-only equivalence is left implicit rather than explained. |
| i02, i05, i06 | A README listing missing HTTP infrastructure is expanded into a claim that the entire API repository supplies declarations only. The same frozen repository contains `src/Helium.java`. |
| i06 | The missing `resolveDepot` implementation qualification is omitted; an eventual transmission question does not explain that implementation gap. |
| i08 | A compound conclusion repeats the client assignment without citing the client original in that claim. Claim 3 cites it correctly elsewhere. |
| i14 | A claim calls the Java record matching while citing only Java, without the JSON contract it compares against. The contract is cited correctly elsewhere. |

The two last cases are claim-local citation defects, **not fabricated field values**.
All material parts of each claim are reviewed against that claim's own citations.
Independent reviewers can assess these judgments in the unchecked worksheet; a passing
schema or a true statement elsewhere in the answer does not automatically approve a
compound claim's citations. The i01/i06 omission judgments require the frozen specific
qualification, rather than inferring it from a generic intended-flow/runtime question.

- 36/38 required propositions/qualifications are met under agent review. The recorded
  original reference basis is available for all 38; neither omission is a retrieval miss.
- All 63 claims and 49 unanswered questions are reviewed. Five claims have insufficient
  support as written: three scope overstatements and two local citation defects. All
  forbidden assertions were reviewed as absent; independent review remains pending.
- The audit verifies 388 input-span occurrences against 47 original Git files, including
  owner/revision/blob/range/content hashes; 85 citation references resolve to 33 spans.
- Maximum input: 30 spans, 5,157 source bytes and 34,124 prompt bytes. No caps or product
  behavior changed. Four cases still lack the specific comparison clue measured in Task 033.
- Reported usage: 252,097 input / 6,002 output / 0 cached tokens; all attempts report usage.
  These counts exclude unknown CLI-internal request/retry details.
- All fourteen stored contexts/results are byte-identical after reopening the store;
  exact request replay adds zero calls. Source revocation fences all fourteen and purges
  their stored context/result. This exported synthetic evidence retains its own copy.
- Full verification: 341 tests, strict typechecks and builds. No product/UI change;
  Task 032 browser evidence remains applicable. The real-model budget is exhausted.

[Raw run](answer-result.json) · [Agent judgments](semantic-review.json) ·
[Independent review worksheet](HUMAN_REVIEW.md) · [Provenance audit](audit-result.json)

Reproduce the model-free audit with `node scripts/loredock-interface-audit.mjs`.
The next phase freezes the roadmap's ten incident-routing cases and measures the
current candidate evidence without model calls or production routing. This addresses
an unmeasured readiness condition while retaining the answer failures. Independent
quality acceptance and an eligible private pilot still precede the Workbench bridge.
