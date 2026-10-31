# Task 027 — Expanded answer and engineer-review qualification

Status: evaluation completed; expanded semantic qualification blocked. Engineering
changes are ready for PR/CI review. Follows Task 026 / merged PR #30.

## Scope and acceptance

1. Recheck the previously selected personal connection and qualified CLI without
   reading/copying authentication stores. Preserve gpt-5.6-terra / medium, text-only
   restrictions and explicit connection selection. No corporate/private sources.
2. Run the twenty frozen expanded questions through production Catalog / Answers /
   CodexTextRuntime. Only question strings enter retrieval; oracle expectations stay
   outside model inputs. Preserve complete results, exact issued contexts, raw output,
   runtime identity, per-attempt usage and source/revision/hash evidence.
3. Before any model call, define four additional engineer-review cases: a legitimate
   production-scope dispute, an adversarial instruction in a note, an unsupported human
   production assertion, and withdrawal. Use normal correction APIs and exact history.
   Assert expected note inclusion/exclusion and frozen input before dispatch.
4. Assess every generated claim against its supplied original evidence. Evaluate
   usefulness, required uncertainty, invented conflicts, unsupported runtime/security
   guarantees and human assertions promoted to source facts. Keep agent assessment
   separate from unchecked independent human review; never claim L5 acceptance.
5. Target at least 18/20 useful/correct expanded answers, with no material unsupported
   claim, missing required scope/uncertainty, or note-instruction adoption; all four
   review cases must pass. A citation resolving is necessary but not semantic proof.
6. Budget at most 24 application attempts per complete run, one active invocation,
   120 seconds per attempt and no automatic retries. Stop on operational failure.
   Permit at most one additional complete run after an evidenced bounded fix; preserve
   failures and all earlier outputs, with no best-of assembly. CLI-internal requests
   and unknown interrupted usage must be disclosed separately.
7. Add an explicit opt-in evaluator and fake-runtime/fixture boundary tests. Ordinary
   tests and CI make no model calls. Record restart/history/revocation evidence, update
   documentation/status and run relevant checks before PR review and exact-head CI merge.

If the eligible connection or semantic gate fails, retain a concrete reviewable result
and blocker rather than weaken restrictions or relabel an incomplete run as passing.
Wider framework coverage, retention, independent review and an eligible private pilot
remain separate before the Workbench bridge.

## Result

Both complete 24-attempt runs and every claim assessment are retained. v7 scores
17/20 plus 3/4 review cases; the bounded prompt-v8 fix scores 18/20 plus 4/4. The final
run still omits required context/uncertainty in s04 and s14, so acceptance criterion 5
is **not met**. No further paid rerun is included in this task. All engineering,
source-provenance, history, withdrawal, replay and revocation checks pass.

Full `pnpm check`: 307 tests, strict typechecks and builds. Chrome regression: four
fake calls, zero models. Offline source audit: 1,352 issued span occurrences and
204 reviewed claims across both complete runs. See the [complete record](../docs/fixtures/loredock-scale-answer-quality/README.md)
and [ADR 0031](../docs/decisions/0031-loredock-expanded-answer-evaluation.md).
