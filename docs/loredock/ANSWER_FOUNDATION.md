# LoreDock L2 answer workflow and acceptance checkpoint

Date: 2026-10-30. The initial pilot and quality improvements reached main through
PR #20 (`474cec1`). The owner subsequently acknowledged completion and requested the
next iteration; **Task 016's bounded source-to-cited-answer slice is owner-accepted**.
See the [acceptance record](L2_ACCEPTANCE.md). Cited answers remain an explicitly
selected mode through `LOREDOCK_ANSWERS=1`; indexing and maps need no Codex setup.

Task 023 subsequently adds retrieval v5 / prompt v7: bounded engineer notes separate
from source spans, immutable note snapshots and review freshness. Its fake-runtime/browser
verification does not extend the real-model quality scores below to disputed-link behavior.
See [the review-context decision](../decisions/0028-loredock-answer-review-context.md).
Task 026 now uses retrieval v6 with the same prompt v7: bounded literal-name samples,
stable saved source order and twenty-source fallback opportunity within the existing
30-span / 64 KiB text budget. [Expanded retrieval qualification](../fixtures/loredock-scale-retrieval/README.md)
records 20/20 required-evidence recall and unchanged original-pilot recall, without
real-model answer or uncertainty evaluation. The real-model scores below remain the
historical three-source checkpoint; they do not certify the new twenty-source scope.

The final complete run has a provisional **20/20 useful/correct agent assessment**,
**162/162 resolving citation references across 98 claims**, and **20/20 complete
expected-evidence retrieval sets**. This is not independent human approval. Read the
[complete review sheet](../fixtures/loredock-answer-quality/HUMAN_REVIEW.md),
[quality records](../fixtures/loredock-answer-quality/README.md) and
[usage guide](USER_GUIDE.md#ask-a-question-opt-in-pilot).

## Implemented workflow and improvements

The durable source → index → bounded context → model → cited answer flow retains
request replay, immutable input/provenance, reported usage, atomic publication,
cancellation/restart handling and source revocation/policy fencing. Failed attempts
preserve the prior authorized answer; revocation also purges dependent context/results.
The browser provides saved setup, model-free preview, escaped prose, opened evidence,
conflicts, unanswered questions, saved-index freshness and history.

The October improvements address measured failure classes without changing the oracle:

- `fts-question-v4` keeps existing lexical matching and identifier expansion. With no
  lexical hits, it provides a clearly labeled repository sample: root README/manifests
  and first spans from representative source languages, at most six per repository and
  18 overall. Existing 30-span / 64 KiB source-text limits remain. This is orientation,
  not relevance proof, complete language coverage or architecture extraction.
- `cited-answer-v3` constrains decoder citation choices to the issued context IDs.
  Empty context permits no claims. Live publication checks still validate every input
  span and current policy/registry; decoder restrictions alone are not authorization.
- Unknowns are unanswered questions; known explanations and documented absences belong
  in cited claims. Prompt v6 preserves scoped documentation discrepancies, distinguishes
  unknown production settings from actual contradictions, and separates identity
  propagation from authentication/authorization evidence.
- Attempt details expose saved prompt/schema identities. Older answer prose and contexts
  remain byte-for-byte as stored, including contexts without the new retrieval-mode
  field. That answer-quality checkpoint retained schema 3 without a migration.
  [Task 019](../../tasks/019-loredock-engineer-corrections.md) subsequently adds schema 4
  for map/flow corrections, preserving the saved answer bytes and retrieval contract.

The web app now declares its development dependency on the daemon whose transport types
it imports, ensuring packages/daemon build before frontend type checking. No external
package was added. See [ADR 0021](../decisions/0021-loredock-answer-quality-and-cli-refresh.md).

## Requalified runtime

The selected installation now reports **Codex CLI 0.166.0**. Text policy `text-only-v2`
qualifies that exact Linux version with the existing selected personal `.codex-plus`
connection and **gpt-5.6-terra / medium**. Workbench's adapter and qualified versions
are unchanged. Another installed CLI version requires qualification rather than an
account/executable fallback.

Eight sandbox-helper checks passed again, followed by 14 synthetic loopback protocol
requests with no real model. Actual Code Mode inventory contains blocked `apply_patch`
and three MCP resource primitives. Resource/template lists are empty and an outside
file URI through an unconfigured server is rejected. Production preflight requires all
MCP servers disabled; enabled-server rejection is tested. Shell, process/network JavaScript
APIs and delegation remain unavailable. The selected connection passed no-model preflight.
Authentication/session secrets were neither parsed nor copied.

The global home instruction canary still appears in the synthetic request, so the
production global-AGENTS rejection remains necessary. Ancestor/project and skill
canaries are absent. The standalone probe's `not-qualified` field does not certify a
selected connection or answer quality by itself; read it with preflight and application
records. Production uses a disabled-capability/read-only boundary, not the strict
filesystem namespace tested separately by the helper. Trusted CLI internals can read
configuration/installation and contact the provider. Metadata fingerprints detect
configuration changes; they do not hash all transitive native/configuration dependencies
or prove account identity. See [ADR 0020](../decisions/0020-loredock-bounded-answers.md).

## Preserved evaluation history

| Run | Result |
| --- | --- |
| v1, September | 19 published answers; q20 rejected. A duplicate-delivery inference was too strong. |
| v2, September | 20 valid structures, 90 resolving claim references, 17/20 agent assessment. Uncited explanation, under-informative framework abstention and frontend retrieval miss remained. |
| v3, October | Stopped at q18 after a content hash was used as a locator. 18 attempts; 15/20 agent assessment, with two not-run questions and known conflict-presentation failures. |
| v4, October | 20 valid answers, 19/20 agent assessment. The tenant-identity answer omitted the required authentication/authorization caveat. |
| v5, October | 20 valid answers, 19/20 agent assessment. The rationale answer manufactured a conflict between local and unknown production settings. |
| v6, October | 20 valid answers, 162 resolving references, provisional 20/20 agent assessment. Independent human semantic review is pending. |

Each record contains its exact context, model/runtime/prompt/schema identity and usage.
No per-question best answers are assembled across versions. The corpus, revision vector,
20-question oracle, 18/20 threshold and ten future routing cases are unchanged.
The original 10/20 retrieval baseline and September CLI measurements remain available.

Four October runs consumed 78 application attempts and reported 895,489 input / 35,634
output tokens, including 24,320 cached input tokens. There were no automatic application
retries. These are not monetary estimates or predictions for 20 real repositories.
CLI/provider transport can perform internal requests within the wall limit; interruption
does not guarantee zero provider usage. No corporate source ingestion occurred.

## Verification and continuing review

`pnpm check` passes **186 tests**, strict typechecks and production builds. All 35
LoreDock tests also pass after final prompt/history-compatibility updates. Frozen offline
installation succeeds. Browser acceptance verifies model-free orientation preview,
escaped prose, conflict/citation, abstention, failure/cancel retention, restart/history
and 390px layout with four fake runtime calls and zero models. Source fixtures remain
unchanged. The final run's 289 input-span occurrences match original bytes/hashes/lines.

Owner acceptance is recorded separately from the agent's judgments and historical
unchecked review boxes. No separate human numeric score was supplied. Future input
and feature changes still require source-based review: conditional overwrite/receive
language in q10 and q18 deserves particular attention, and source intent is not observed
runtime behavior. Agent scoring and resolving IDs never make new claims authoritative.

The pilot still supports three active repositories and bounded text retrieval. It does
not provide cross-language semantic search, complete architecture extraction, production
queries, routing, embeddings or a Workbench bridge. The first bounded L3 declaration-map
task follows this accepted slice; broader Overview/Guide Me, code-flow extraction, scale
and refresh remain separately scoped work. No further model run is needed merely to repeat the current result; any future evaluation follows a justified
change and a separately bounded, preserved run.
