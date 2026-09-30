# LoreDock L2 foundation and remaining gates

Date: 2026-09-30. Task 015 reached main through merged PR #18 (`769c652`).
Task 016 is **in progress, not accepted**. This checkpoint adds an internal retrieval
and mechanical answer-validation module plus reproducible runtime experiments.
The application still provides the model-free source catalog. No answer endpoint,
answer persistence, model execution or question/answer UI is enabled.

## Runtime observations

The [probe](../../scripts/loredock-runtime-probe.mjs) uses disposable synthetic files,
empty HOME/CODEX_HOME, an allowlisted environment and a loopback HTTP server returning
fixed responses. It never reads/copies an existing account's credentials, starts a
real model, or changes the installed CLI/configuration. The selected executable and
native sandbox helper are recorded by canonical path and SHA-256. Results and precise
limits are in the [recorded artifacts](../fixtures/loredock-answer-foundation/README.md).

The installed CLI reports `codex-cli 0.158.0`. Its actual syntax is
`codex sandbox -P <profile> -C <directory> <command>`, without a `linux` subcommand.
This explains the earlier L0 `execvp linux` failure. The development sandbox itself
still prevents nested execution, so the probe was explicitly approved to run outside
it; the tested child commands still ran inside the CLI's sandbox.

An explicit read-only profile granted the synthetic input directory, minimal system
runtime paths and the exact native Codex helper binary. Network access was disabled.
The helper binary grant is necessary when it is installed outside the minimal system
paths. No grant to the user's entire home or source directory was used.

| Experiment | Observed result | Limit |
| --- | --- | --- |
| Read admitted input | Passed | Synthetic helper command only. |
| Read neighboring file | Denied after command-start sentinel | No claim about every possible tool path. |
| Follow symlink outside input | Denied | Synthetic symlink case. |
| Write admitted source | Denied; original bytes unchanged | Helper shell write, not model-generated apply_patch. |
| Read outside input in nested shell | Denied | One child-shell case. |
| Connect to loopback listener | Allowed in positive control, denied with network disabled | Command network only; provider transport is separate. |
| Cancel running sandbox command | Shared process helper reports CANCELLED | Does not establish provider-side cancellation or billing. |
| Structured response | Exact schema forwarded; fixed response and synthetic usage emitted | Mock protocol result, not model/schema quality. |
| Provider error | One synthetic HTTP 400 becomes turn.failed and exit 1 | No automatic retry observed for this case. |
| Feature restrictions | All requested feature flags report false | Advertised tools still include collaboration.spawn_agent and functions.exec. |
| Instruction discovery | Ancestor/project AGENTS canaries absent; HOME canary present with project_doc_max_bytes=0 | No production discovery policy has been qualified. |

These observations **do not pass the mandatory runtime gate**. A sandbox helper is
not proof that every `exec` tool follows the same policy. Advertised delegation despite
disabled flags is an unresolved capability, not proof that a subagent was launched.
No subagent was launched by this probe. Disabling `code_mode_host` in an additional
exploratory run produced an error item while still advertising the same top-level
tools; it is not an accepted workaround.

The [official permissions reference](https://learn.chatgpt.com/docs/permissions)
describes custom profiles and warns that legacy sandbox configuration can supersede
them. The [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
documents feature/configuration controls. Installed help and measured behavior take
precedence over assuming those controls provide the required boundary. No Workbench
version allowlist or production runtime code was changed.

## Internal context and answer boundary

`apps/loredock/src/answer-context.ts` retrieves issued spans from one published,
authorized build using literal FTS5 terms. It bounds candidates at 120, issued spans
at 30 and text at 64 KiB measured as UTF-8 bytes. It omits whole spans and records
budget gaps rather than inventing new citation ranges or silently truncating evidence.
Source identity is retained even when two repositories contain identical text.

The context records the question, retrieval version, input hash, exact span identities,
revision vector, build policy/source-set version, current registry version, coverage,
freshness and unknown deployment coherence. Empty retrieval explicitly says it does
not prove system-wide absence. Historical source-set versions remain inspectable;
revoked source text is excluded. Coverage counts describe the historical full build.

The validator accepts bounded facts, inferences, conflicts and unknowns. Every claim
must cite an issued ID; a conflict requires at least two distinct citations. It rejects
malformed/extra executable fields, unknown or out-of-context/build citations, duplicate
IDs, modified input, damaged evidence and policy/registry changes. It reopens all
issued evidence, including uncited input. It does not validate semantic truth: tests
deliberately demonstrate that false prose can cite a valid locator.

This is an **internal foundation**, not a durable issuance/publication protocol.
The next implementation must persist the context before dispatch and validate it
again inside the atomic publication boundary. No HTTP endpoint accepts client-supplied
context objects. Runtime identity/model/effort, attempt lifecycle, usage and failure
history still require implementation.

## Retrieval measurement

The [offline evaluator](../../scripts/loredock-retrieval-evaluation.mjs) indexes the
real frozen three-repository corpus through the production catalog. Only question
strings enter retrieval; oracle expectations are used afterward for comparison.

The first lexical baseline retrieves all expected evidence for **10 of 20 questions**.
This is evidence recall, not a 10/20 answer score. There are no model answers,
unsupported-claim results or semantic reviews. The recorded per-question misses show
weaknesses in matching natural language to camelCase identifiers, filenames and related
implementation files. Russian questions are tokenized, but cross-language semantic
retrieval is not implemented and must not be advertised as supported.

Keep this first measurement as a baseline. Improve retrieval generically and version
the next experiment; do not add question IDs, oracle answers, repository names or
fixture-specific expansions to product code. Evaluate filename/symbol tokenization
and bounded query expansion before introducing embeddings or fetching whole corpora.

## Next steps within Task 016

1. Prove restrictions through actual `exec` tool calls against synthetic canaries,
   including patching and all advertised capabilities, using a bounded local protocol
   fixture. Establish a verified way to prevent delegation/extra calls and unwanted
   instruction/config discovery. Keep model execution disabled until that succeeds.
2. Improve and remeasure generic retrieval, including mixed-language questions and
   README/code conflicts. Preserve the frozen 20-question oracle and this baseline.
3. Implement the minimal qualified runtime request and durable attempt/publication
   state, including request replay, cancellation races and restart ambiguity.
4. Add the question/answer UI and verify escaped prose, citations, conflicts, abstention
   and retained history after failure/cancel in a browser.
5. Only then run the separately bounded real-model corpus evaluation using the explicitly
   permitted connection/model. Require the original 18/20 useful-answer and safety gates;
   do not substitute mock responses or lexical recall for acceptance.

No external setup change or additional account access is requested at this checkpoint.
The remaining uncertainty concerns runtime enforcement and application work, not GitHub
authorization. Full graph extraction and Workbench routing remain later tasks.
