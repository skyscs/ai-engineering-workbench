# Prospective answer qualification

Task 030, 2026-10-31, after PR #33 (`b4f29f9`). One complete run through the production
Catalog/Answers/CodexTextRuntime, using the unchanged twenty-source synthetic fixture
and all twenty-four [Task 028 wordings](../../../fixtures/loredock-completeness/RUBRIC.md).
Prompt v8, retrieval v7, schema v3, gpt-5.6-terra / medium and the selected personal
CLI 0.166.0 / text-only-v2 remain fixed. No second run or tuning against these outputs.

**Agent assessment: 11/12 development and 12/12 reserved cases pass. The prospective
semantic gate fails.** All 62 required answer/qualification judgments pass, but d10
adds a materially unsupported cross-component claim. Required-reference recall is
24/24; recall does not establish the support of every generated assertion. Task 027's
earlier failed gate and all historical scores remain unchanged.

## Evidence and judgments

| Artifact | Purpose |
| --- | --- |
| [Frozen execution contract](evaluation-contract.json) | Budget, model/prompt/retrieval identities, source hashes and unchanged rubric hash; frozen before dispatch. |
| [Selected preflight](selected-preflight.json) | Metadata-only qualification, zero model calls; unchanged selected configuration fingerprint. |
| [Complete raw run](answer-result.json) | All prompts, exact input spans/originals, raw outputs, attempts, runtime identity and usage. |
| [Agent semantic review](semantic-review.json) | Every claim, unanswered question, required proposition and forbidden assertion, with support or rejection rationale. |
| [Human review worksheet](HUMAN_REVIEW.md) | Every answer and cited original, with unchecked independent-review boxes. |
| [Offline audit](audit-result.json) | Fresh source reconstruction and judgment coverage/integrity checks; no semantic grading by code. |

The development-agent review covers **122 claims, 85 unanswered questions, 62 required
propositions/qualifications and 185 citation references**. The audit reconstructs **699
input-span occurrences** against fresh original Git objects, checking revision, owner,
blob, line range and SHA-256. It reads 74 original files; 41 distinct spans are cited.
Every claim has an explicit judgment. The audit validates provenance and review coverage,
not whether a human would agree with the semantic judgments.
Historical audit checks the retained frozen contract; new dispatch checks current code
against its hashes. Later implementation work must not invalidate historical source evidence.

## Failure and next product improvement

d10 asks whether `TenantContext` establishes tenant membership. Claim 1 correctly says
the library only carries an identifier and does not authenticate, validate membership
or authorize. The answer correctly leaves enforcement elsewhere unknown. However,
claim 2 states as fact that checkout and order code propagate a caller-provided header
into the handler and event. Its own cited sources disagree on the literal binding:

- `checkout-bff/src/checkout.ts` sends **`x-tenant-id`**.
- `order-api/config/routes.json` binds `Orders.accept.tenantId` to **`X-Tenant`**.
- `Orders.java` supports parameter-to-event delegation, but includes no actual HTTP
  server or header-rewrite implementation connecting those two distinct names.

Header names are case-insensitive; these differ beyond case. Matching route paths and
the presence of a tenant value do not establish the missing mapping. Optional context
still requires evidence, so this claim fails the frozen grounding rule despite complete
answers to the narrow membership question.

h10 is assessed separately: it names the two header literals in separate claims,
labels broader interface propagation as inference and explicitly leaves the live
connection unverified. Its broad wording still merits independent review; the assessment
must not be interpreted as proof that `x-tenant-id` maps to `X-Tenant`.

Next, address this class with a bounded **model-free comparison of literal request
headers and route bindings**, retaining exact evidence and distinguishing a possible
mapping gap from a confirmed runtime defect. First inspect existing HTTP/code-flow
declarations and add an independent mismatch/mapping example before implementation.
Keep matching names separate from authentication, membership and authorization proof.
Do not run another prompt-tuning cycle on these reserved answers.

## Execution, usage and limits

The contract was frozen at 17:55:56 UTC, committed as `6e8b7d0`, before dispatch began
at 17:56:13 UTC. All 24 application attempts completed by 18:00:20 UTC. Each invocation
used a 120-second limit, one active call and no automatic retry. The runner persisted
the issued input and dispatch count before calling the runtime, rejected changed
identities/contracts, and refused an existing output directory.

Reported usage: **415,474 input tokens, 11,540 output tokens, 0 cached input tokens**.
All attempts have usage receipts. Application attempts are counted separately from
CLI-internal requests, which the adapter does not expose. Maximum input: 30 spans /
8,775 source-text bytes / 32,338 prompt bytes, within the unchanged limits. No private
or corporate sources, credential-store reads, account fallback or direct API were used.

All 24 saved attempts survive restart byte-for-byte; exact request replay adds zero
calls. Source revocation fences all attempts and purges their application-stored context
and results. This separate synthetic export retains pre-revocation evidence; external
copies are outside application purge. Owned source checkouts remain unchanged and are
removed. The temporary SQLite run ledger stays local and is not committed.

Reserved wording was authored by the same agent after prior failures and inspected for
retrieval. It is now also used for model evaluation and is **not held out**. This small
synthetic result, an engineering merge or an agent assessment is not independent review,
private-project acceptance or L5 qualification. Wider framework coverage and retention
remain open before a Workbench bridge.

## Verification and reproduction

Ordinary tests use fake runtimes and make no model calls. They cover the frozen sequence,
question/oracle separation, dispatch checkpoints, changed runtime/contract rejection,
failure/raw-output/usage retention, no retry, output refusal and history/revocation.
Offline tests reject missing requirement judgments and consistently rehashed wrong
source ownership. Full `pnpm check` passes **319 tests**, strict typechecks and builds.
Product behavior, UI, prompt, runtime and configuration are unchanged,
so the Task 029 browser qualification remains the relevant unchanged-product checkpoint.

After a repository build, reproduce the source audit without model calls:

```bash
node scripts/loredock-prospective-audit.mjs
pnpm check
```

The opt-in runner accepts an explicit frozen contract and a new output directory:
`node scripts/loredock-prospective-answers.mjs --contract /path/to/contract.json --output /new/directory`.
Task 030's one-run budget is exhausted; the recorded command is not authorization for
another paid run. A later evaluation needs a separate task and budget, without silently
reusing this reserved set as an unseen test.

The local adapter remains the compatibility authority for this pinned CLI. Current
official documentation describes [JSONL/schema-based non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode)
and [model/effort configuration](https://learn.chatgpt.com/docs/config-file/config-reference);
these general references do not certify the selected account identity or prove that
unqualified CLI versions satisfy the application's stricter text-only restrictions.
