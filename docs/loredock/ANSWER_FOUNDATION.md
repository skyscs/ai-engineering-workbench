# LoreDock L2 answer workflow and acceptance checkpoint

Date: 2026-09-30. Task 015 is merged through PR #18. Task 016 now includes the
source → index → bounded context → model → cited answer workflow, but is **not accepted**.
The answer pilot requires `LOREDOCK_ANSWERS=1`; ordinary startup remains model-free.
See the [usage guide](USER_GUIDE.md#ask-a-question-opt-in-pilot),
[ADR 0020](../decisions/0020-loredock-bounded-answers.md) and
[recorded evidence](../fixtures/loredock-answers/README.md).

## Delivered

- Separate text-only runtime for the selected Linux Codex 0.159.2 installation,
  `gpt-5.6-terra` / medium. Workbench runtime compatibility is unchanged.
- Question retrieval with filename/identifier normalization, one bounded literal-symbol
  expansion and source README orientation. Original evidence bytes/locators are preserved.
- Durable attempt intention, immutable issued context and provenance before dispatch;
  idempotent request replay, explicit retry, usage receipts and atomic publication.
- Cancellation, restart, registry/policy changes and revocation fence late results.
  Failed attempts retain the previous authorized answer; revocation purges derivatives.
- Local protected API and browser question/answer panel with saved setup, model-free
  preview, escaped prose, source citations, conflicts, unknowns, freshness and history.

Schema 1 catalogs migrate transactionally through schema 2 (question FTS) and schema 3
(answer workflow). The browser shows the saved answer's index instead of silently
presenting an older answer as current. Source search continues to use its original
literal AND semantics; question retrieval is a separate index/query path.

## Runtime qualification and its limits

The original CLI 0.158.0 experiments remain in the
[foundation record](../fixtures/loredock-answer-foundation/README.md). After the owner
completed the CLI update, synthetic qualification ran on 0.159.2. Eight sandbox-helper
checks passed. Actual Code Mode tool calls verified the available tool inventory,
blocked patching and unavailable shell. `agents.enabled=false` removes delegation;
feature flags alone were insufficient. No subagent was launched.

Ancestor/project instruction canaries and the skill canary were absent from requests.
The global HOME instruction canary remained present, so production preflight rejects
selected configuration homes containing global AGENTS files. The selected personal
`.codex-plus` connection passed preflight, with no model call or authentication-store
inspection. Exact CLI version, disabled features, enabled MCP absence and canonical
connection metadata are checked before dispatch. The CLI reads its own authentication.

The standalone probe deliberately retains `gate: not-qualified`: by itself, a synthetic
configuration does not qualify a production connection or answer quality. The separate
selected-connection preflight, application tests and real runs supply that additional
evidence. They do not qualify arbitrary CLI versions, accounts, profiles or platforms.

Production uses an empty owned cwd and disabled model tools with read-only execution.
It does **not** use the strict filesystem namespace tested separately by the sandbox
helper. Trusted CLI internals may read their installation/configuration and contact the
provider. This capability boundary and its trust assumptions are explicit in ADR 0020.
A configuration directory is not proof of account identity. Launcher/config metadata
fingerprints are change detection, not hashes of all transitive installation files.

## Measured retrieval and answer quality

The frozen oracle and repository corpus were not changed or placed in model inputs.
Generic retrieval improved complete expected-evidence recall from **10/20** to **19/20**.
Question q14, frontend module conventions, still has no admitted lexical matches.
Russian tokenization is available, but cross-language semantic retrieval is not.

Two explicitly bounded real-model evaluations ran, each with at most 20 attempts and
no automatic application retries. The first prompt produced 19 mechanically accepted
answers and one rejection; its duplicate-delivery inference was too strong. The second
prompt clarified citation placement, unsupported guarantees and uncertainty handling.

The second evaluation produced **20 structurally accepted answers and 90/90 resolving
claim citations**. Conservative agent semantic review scores **17/20 useful and correctly
presented answers**. This is not human acceptance:

| Question | Remaining issue |
| --- | --- |
| q06 — production topic | Correct abstention, but the explanatory ORDER_TOPIC fact is in unknowns without a structured citation. |
| q13 — Java framework | Safe but unhelpfully terse abstention despite available Java 17/no-framework evidence. |
| q14 — frontend conventions | Retrieval misses all relevant spans; the model correctly abstains. |

The second run does not identify unsupported affirmative claims or unsafe assertions
in the reviewed conflict/unknown cases, but q06 prevents claiming that every material
assertion has a usable citation. The original **18/20 usefulness threshold is not met**.
Human review of all assertions, unknowns and their source support remains pending.
The ten routing cases were not run and no production routing is delivered.

Reported usage across both runs is 572,202 input tokens and 12,909 output tokens,
including 222,208 cached input tokens. These are CLI-reported counts, not money or a
prediction for large real projects. CLI/system overhead is substantial even with small
source contexts. The first failed answer still has a usage receipt; raw rejected prose
was not retained in that evaluator version. The second evaluator records raw output
for diagnosis outside product publication.

## Verification and continuation

`pnpm check` passes **182 tests**, strict typechecks and production builds. Browser
acceptance with a test-only injected runtime covers escaped prose, conflict, citation
opening, abstention, failure/cancel retention, restart/history and 390px layout. The
existing catalog browser flow also passes. Browser fixtures make no model calls and
cannot be selected through production API/configuration.

Before default activation or L3 work:

1. Improve the generic separation of missing information from source-backed explanation;
   keep every substantive explanation in a cited claim. Avoid question-specific fixes.
2. Improve useful summaries when evidence explicitly records an absent implementation,
   and investigate bounded vocabulary/path-based retrieval for the q14 class of miss.
3. Run another explicitly bounded, separately recorded evaluation after a justified
   change. Preserve both earlier runs; do not choose the best answer per question.
4. Obtain human semantic review against the frozen oracle and original spans. Enable
   answers by default only after the unchanged quality and safety gates pass.

The pilot implementation and review evidence are ready in draft PR #19. Acceptance is
left open rather than equating schema success with a complete source-understanding tool.
