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

Pending the frozen run. No new quality score or acceptance is claimed yet.
