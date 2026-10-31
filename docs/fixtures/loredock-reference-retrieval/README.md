# Literal-reference retrieval qualification

Task 029, 2026-10-31. Retrieval `fts-question-v7`, prompt `loredock-answer-v8`.
No model calls, runtime preparation or private sources. Frozen corpus, oracle and
prospective question contract are unchanged. Historical raw answers and scores remain
unchanged; Task 027's expanded semantic gate still fails.

| Corpus | Prior v6 | Current v7 | Artifact |
| --- | --- | --- | --- |
| Twenty-source original questions | 20/20 | 20/20 | [Original recall](scale-result.json) |
| Prospective development wordings | 12/12 | 12/12 | [Prospective recall](prospective-result.json) |
| Prospective reserved wordings | 10/12 | 12/12 | [Prospective recall](prospective-result.json) |
| Original three-source pilot | 20/20 | 20/20 | [Pilot regression](pilot-regression.json) |

Before measurements: [Task 026 v6](../loredock-scale-retrieval/README.md) and
[Task 028 v6](../loredock-completeness/README.md). The latter pins the prospective contract
and historical original/answer/review hashes. The evaluator verifies those pins again.
The selected shared StockReserved JSON and Reservations method body now cover the two
previously missing references. The old h02 input already contained equivalent message
fields in code; missing chosen-reference recall never established answer impossibility.

Both twenty-source suites repeat on fresh catalogs: no changed selected locators or
requirement outcomes; zero-hit orientation still represents twenty sources. Maximums:
30 spans / 8,775 text bytes / 32,338 prompt bytes across the expanded/prospective questions.
The pilot reaches at most 17 spans / 5,928 text bytes. Limits remain 120 final candidates,
30 spans / 64 KiB text / 96 KiB prompt. Owned source checkouts remain unchanged and are
removed after evaluation. Only question strings enter production retrieval; expectations
stay in the evaluator.

## Development comparisons

[Experiment summaries](experiments.json) preserve every trial's pass/miss outcomes.
All use the same improved expansion; only candidate admission differs:

- Equal direct/expanded turns: 23/24 prospective; misses d04's plugin source and s09's
  additional consumer configuration in the original expanded suite (19/20).
- Expansion-first: 22/24 prospective; misses d04/h04's plugin source; original suite 20/20.
- Two direct turns per expansion: 24/24 prospective and 20/20 original, with unchanged
  20/20 pilot recall. This is the final published v7 contract.

An independent single-word `Journal.append` handler scenario was added before tuning;
it failed under v6 and passes under v7 without a repository hint in the question.
Unit checks cover distracting identifiers, query affinity, source identity stability,
repeated text, complete quoted references, seed/name limits, duplicate handling and
direct-query opportunity when both queues exceed the final context allowance.
See [ADR 0032](../../decisions/0032-loredock-literal-reference-retrieval.md).

Reserved wordings were authored after earlier failures and inspected for retrieval;
they are not a blind independent benchmark. No answer model has seen the prospective
questions. All prospective semantic judgments remain unperformed. A separately budgeted,
fixed-prompt real-model run is the next step; no semantic acceptance follows from this
engineering qualification or autonomous merge.

## Reproduce

After the repository build, with the pinned Node/pnpm versions:

```bash
node scripts/loredock-scale-retrieval.mjs > /tmp/loredock-scale-result.json
node scripts/loredock-completeness.mjs > /tmp/loredock-prospective-result.json
node scripts/loredock-retrieval-evaluation.mjs > /tmp/loredock-pilot-result.json
pnpm check
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-reference-answer node scripts/loredock-answer-smoke.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-reference-preview node scripts/loredock-scale-retrieval-smoke.mjs
```

Run browser checks sequentially; both use port 4244 with owned synthetic sources and
fake runtimes. Both checks pass: [answer/review/history](answer-browser-result.json) (four fake calls)
and [twenty-source preview](preview-browser-result.json) (no runtime preparations or attempts).
Full `pnpm check` passes 314 tests, strict typechecks and builds. Wall times and
temporary IDs vary; stable original locators/hashes and required-evidence outcomes are
the comparison basis.
