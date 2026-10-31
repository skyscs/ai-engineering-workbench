# Expanded answers and engineer-review qualification

Date: 2026-10-31. Task 027. **Evaluation completed; semantic qualification failed.**
The final complete run receives an agent assessment of **18/20** expanded answers
and **4/4** engineer-review cases. It meets the numeric threshold but still omits
required context/uncertainty in s04 and s14. It is not L5 acceptance, independent
human approval or evidence of readiness for private production repositories.

## Complete runs and remaining blockers

The [contract](evaluation-contract.json) and [four review cases](../../../fixtures/loredock-scale/review-cases.mjs)
were fixed before the first model call. The twenty-source corpus, oracle, model,
effort, retrieval and budgets are unchanged between runs. Only question strings enter
retrieval; expected answers never enter the model. Every issued prompt, original
passage, runtime identity, raw response and immutable attempt is retained.

| Complete run | Expanded score | Review cases | Hard-gate failures |
| --- | ---: | ---: | --- |
| [v7 raw](answer-result-v7.json), [assessment](semantic-review-v7.json), [review sheet](HUMAN_REVIEW-v7.md) | 17/20 | 3/4 | s04 omits the StockReserved contract/live-subscription distinction; s07 omits the storage-implementation limitation; s19 omits documented missing scheduling. r04 speculates about convergence from an unimplemented storage interface without prerequisites. |
| [v8 raw](answer-result-v8.json), [assessment](semantic-review-v8.json), [review sheet](HUMAN_REVIEW-v8.md) | 18/20 | 4/4 | s04 still omits the contract/live-subscription distinction; s14 omits the unresolved dynamic-plugin/build-wiring limitation. No material unsupported claim found in this agent review. |

The scoring applies the frozen completeness rubric, not keyword matching. In particular,
s04's stated local topic values are correct; its failure is missing expected context,
not an invented value. The different omissions in the second run show why selecting
the best answer per question or declaring success from resolving citations is invalid.
All independent review boxes remain unchecked. Conditional wording in v7 r04 is
explicitly rejected: “could” does not establish database/atomicity/index prerequisites.

Prompt v8 adds generic configuration/contract/port distinctions, complete documented
limitations and a prohibition on unsupported tentative reliability claims. The
[rerun contract](rerun-contract.json) was saved before the single permitted rerun.
It fixes s07/s19/r04 in that run but does not close the overall quality gate. No further
model reruns are authorized by this iteration's budget. The opt-in product boundary,
retrieval v6, schema v3, model, runtime restrictions and text limits are unchanged.

## What was verified

Both runs complete 24/24 application attempts with 20/20 complete expected-evidence
sets. Each supplies the latest matching review note through the normal corrections
API, then tests withdrawal with no note in the new input. Disputed production scope
stays unresolved; the malicious note is not followed; unsupported human assertions
are not promoted to source facts. The fourth v7 answer still fails for its separate
unsupported convergence inference. Each run verifies 24 immutable records across
restart, an exact replay with zero additional calls, unchanged historical note/result
bytes and source revocation fencing/purging all 24 dependent stored answers.

[Offline audit](audit-result.json) regenerates the original Git sources and checks
all **1,352 input-span occurrences**, file/span SHA-256 values, revision/blob/range
locators, raw response equality and assessment coverage of all **204 claims**.
v7 has 151 citation references / 97 claims; v8 has 182 / 107. These are mechanical
checks plus separately recorded agent judgments, not automated semantic proof.
The [browser regression](browser-result.json) uses four fake calls and zero models:
citations, escaped notes, history, withdrawal, stale review/source fences, restart
and a 390px layout. No UI changes were needed.

Full `pnpm check` passes 307 tests, strict typechecks and production builds. Two new
fake-runtime tests exercise all 24 scenarios, oracle isolation, exact input, history,
revocation, existing-output refusal, durable attempt IDs, raw failed-output retention
and stop-without-retry. Two offline artifact tests recheck both complete runs against
fresh original source bytes and reject tampered source identity even when export hashes
are internally consistent. CI and ordinary startup do not make model calls.

## Connection, usage and limits

The [zero-model preflight](selected-preflight.json) reuses the explicit personal
configuration, canonical launcher, CLI 0.166.0 and text-only-v2. No authentication
or session stores were parsed or copied. The chosen model remains gpt-5.6-terra /
medium; no account fallback, model upgrade or direct API was introduced.

| Run | Application attempts | Input tokens | Output tokens | Cached input tokens |
| --- | ---: | ---: | ---: | ---: |
| v7 | 24 | 408,873 | 8,712 | 0 |
| v8 | 24 | 412,685 | 11,472 | 0 |
| Total | 48 | 821,558 | 20,184 | 0 |

All attempts report usage; CLI-internal request counts are not exposed by the
production adapter and must not be equated with application attempts. Each run has
one active call, a 120-second limit per attempt, zero automatic retries and a new
output directory. The maximum observed v8 prompt is 32,892 bytes, below 96 KiB.
These measurements are not monetary estimates or production-scale performance results.
Each prompt has one complete run on this fixed corpus; paraphrase robustness is not
established. The original three-source real-model suite was not rerun under prompt v8;
its earlier scores remain historical, while fake-runtime/browser regressions pass.

The implementation was checked against [OpenAI Docs for non-interactive Codex](https://learn.chatgpt.com/docs/non-interactive-mode),
the [selected model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
and [reasoning prompt guidance](https://developers.openai.com/api/docs/guides/reasoning-best-practices).
Those references do not certify this application's isolation or semantic quality;
local runtime qualification and the recorded evidence provide those narrower checks.

## Reproduction and next step

After the normal Node 22 / pnpm installation and build, recheck saved evidence without
any model or connection:

```sh
node scripts/loredock-scale-answer-audit.mjs
node scripts/loredock-scale-answer-audit.mjs --write-review
```

The second command deterministically regenerates the two readable review sheets.
An explicit **new paid evaluation**, outside this exhausted iteration budget, uses:

```sh
node scripts/loredock-scale-answer-evaluation.mjs \
  --executable /absolute/path/to/codex \
  --config-home /explicit/personal/configuration \
  --output /new/evaluation/directory
```

The evaluator refuses existing output directories. Reports use atomic serialized
checkpoints; dispatched work records its attempt ID before model execution. This
checkpoint hardening followed the two runs and is covered by fake-runtime tests;
it changes neither their model input nor their retained final output.
SQLite ledgers stay local. Synthetic checkouts were verified unchanged and removed.
These separate review exports retain pre-revocation evidence; revocation of application
data cannot recall already exported files.

Next: a bounded answer-completeness investigation before broader qualification.
Inspect which supplied contract/README limitations short answers omit; define held-out
paraphrases before changing selection or output structure. Preserve these failed runs
and the original rubric, examine question/rubric alignment explicitly, and avoid more
unmeasured prompt additions or silently lowering the gate. Framework coverage, retention,
independent review and an eligible private pilot still precede the Workbench bridge.
