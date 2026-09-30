# Task 016 — First bounded, source-backed LoreDock answer

Status: in progress, 2026-09-30; Task 015 merged through PR #18. The runtime gate
is not passed and the complete cited-answer workflow is not delivered.
See the [foundation checkpoint](../docs/loredock/ANSWER_FOUNDATION.md) for implemented
internal retrieval/validation, measured gaps and the remaining work below.

## Objective

Ask a question about the indexed system and receive a useful answer with exact source
citations, conflicts and explicit unknowns. Keep the interaction to sources, question
and answer; show model/configuration and limits when they require a user decision.

## Mandatory runtime qualification

Qualify the explicitly selected executable and configuration directory with synthetic
files before any real-model run. The observed CLI 0.158.0 is outside the current
Workbench adapter allowlist. Verify actual help/config behavior, structured output,
supported restrictions, configuration discovery, enabled tools, cancellation and errors.
Do not merely add its version string or fall back to another executable/account.

Prove allowed input reads, denied outside reads and source writes, symlink handling,
ancestor/project instructions, subprocess scope and source-controlled network restrictions
with inside/outside canaries. Use an isolated home for diagnostics. A failed canary is
a blocker requiring a verified boundary or disabled model execution, not a prompt fix.
Use only the explicitly selected permitted connection for the eventual synthetic model
run. Configuration-directory choice alone is not proof of account identity. Preserve
Workbench compatibility tests when changing shared runtime code.

## Implementation

1. Retrieve a bounded set of issued spans from the selected immutable build using FTS5.
   Expose coverage/environment before generation; do not send the entire source set.
2. Introduce a minimal LoreDock runtime request without task-storage dependencies. Persist
   the exact input IDs, model/effort selection, configuration fingerprint, policy and
   prompt/schema versions. Enforce [budgets](../docs/loredock/CONTRACTS.md).
3. Require structured claims with issued evidence IDs plus unresolved questions. Reject
   unknown/out-of-build/revoked IDs and malformed output. Render escaped text and reopen
   citations through the authorized evidence service. Locator validity is not grounding.
4. Publish the validated answer and successful attempt atomically. Cancel, failure, changed
   policy and interrupted external completion cannot replace a previous good answer.
   Persist usage when available, otherwise unknown; retry/resume is explicit.
5. Add a single question/answer view with sources, contradictions, gaps and build freshness.
   Keep source instructions as untrusted data. No automatic fan-out or query execution.

## Acceptance

- Exercise the real source → index → retrieval → answer → evidence path on the synthetic
  UI/API/Kafka/worker/MongoDB flow. Never feed the oracle into retrieval or the prompt.
- Run the 20 frozen questions under a separately bounded evaluation budget. Record
  retrieval misses separately from answer errors, per-question pass/fail, unsupported
  claims, scope, abstentions, exact model/runtime/prompt identity and reported usage.
  Require at least 18 useful correct answers, all conflict/unknown safety cases, and
  100% mechanical citation resolution plus human review of semantic support. Do not
  relabel a narrower single successful answer as full corpus acceptance.
- The ten incident-routing cases remain a frozen later acceptance set; no production
  automatic routing is delivered here. Do not tune their answers into product code.
- Regression tests cover malicious source text, invalid IDs, malformed output, revocation,
  duplicate requests, cancellation/publication races and restart before/after dispatch.
- Browser review verifies a useful answer, opened citations, a conflict, an abstention
  and retained history after failure/cancel. Existing Workbench checks remain green.

## Non-goals

No embeddings, full system graph, connectors, live production queries, automatic code
changes, Workbench routing or multi-agent platform. Full relation extraction follows
in L3 only after this useful vertical slice and its measured gaps are reviewed.
