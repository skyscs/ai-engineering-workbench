# Twenty-source retrieval qualification

Task 026, 2026-10-31, Linux / Node 22.23.2. Uses the independent twenty-source fixture,
production indexing/retrieval, original evidence validation and two fresh catalogs.
Only the offline evaluator sees expected evidence and uncertainty. Product retrieval
receives the question, never the oracle. Frozen source/oracle hashes are unchanged.

| Measurement | Retrieval v5 baseline | Retrieval v6 |
| --- | --- | --- |
| Complete required-evidence sets | 19/20 | 20/20 |
| Sources represented with zero lexical matches | 18/20 | 20/20 |
| Questions whose ordered locators changed across fresh IDs | 18/20 | 0/20 |
| Zero-hit locator order stable across fresh IDs | No | Yes |
| Maximum observed complete prompt bytes | 30,687 | 30,812 |

The missing v5 evidence was `inventory-api/config/routes.json` for the question about
repository versus application boundaries. Name sampling is generic and bounded;
tests separately use colliding names and reject longer identifiers. The original
three-source evaluation remains 20/20. Source text is still limited to 30 spans / 64 KiB,
and complete prompts to 96 KiB. No text or prompt budget was enlarged.

- [Baseline v5](baseline-v5.json): measured against the Task 025 daemon build at
  `c5e8082`, before product changes. The evaluator added in this task was used unchanged.
- [Result v6](result-v6.json): twenty questions, exact source/revision/path/range/blob/
  content-hash recall, ordered-locator hashes, gap disclosure, fresh-ID repeat and
  independent uncertainty rubric. Timing is diagnostic, not a performance target.
- [Original pilot regression](pilot-regression.json): twenty smaller-system questions.
- [Twenty-source browser result](browser-result.json),
  [mobile preview](orientation-preview-mobile.png) and
  [named-source desktop preview](named-source-preview-desktop.png): original evidence,
  focus, 390px layout, removal/reload; zero runtime preparations and answer attempts.
- [Existing answer/review regression](answer-regression.json): four fake-runtime calls,
  zero real models, saved history, review freshness, late responses and revocation.

Reproduce current results after `pnpm build`, with port 4244 free for browser scripts:

```sh
node scripts/loredock-scale-retrieval.mjs
node scripts/loredock-retrieval-evaluation.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-scale-preview node scripts/loredock-scale-retrieval-smoke.mjs
LOREDOCK_SMOKE_OUTPUT=/tmp/loredock-answer-regression node scripts/loredock-answer-smoke.mjs
```

Owned temporary repositories, databases and browser profiles are removed on exit.
Ordinary CI includes the expanded recall, stable-selection and boundary regressions.
These are evidence-retrieval checks, not actual answer correctness, semantic uncertainty
compliance, production routing, a private pilot or L5 acceptance. No real model calls,
private sources, external services or source application execution were used.
