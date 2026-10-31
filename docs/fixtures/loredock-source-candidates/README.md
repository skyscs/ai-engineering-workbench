# Source candidate preview evidence

Task 036 follows merged PR #39 (`73e5c18`). The owner continues with synthetic inputs.
Ranking rules and eight fresh adversarial source/context cases were committed before
implementation in `9d27d17`; `4105abd` moves the unchanged design into an immutable file
separate from mutable task status, still before implementation or measurement.

[Frozen design](../../../fixtures/loredock-candidates/DESIGN.md) ·
[Candidate diagnostic](candidate-result.json) · [Browser checks](browser-result.json) ·
[Bulk/orientation regression](bulk-browser-result.json) ·
[Architecture decision](../../decisions/0036-loredock-source-candidate-preview.md)

## Outcome

The default model-free UI now provides **Where should I look?** with one question field,
original supporting evidence and **Other matches**. No answer context is narrowed, no
AI connection is required and no investigation or source edit is started.

| Measure on Task 035's observed development incidents | Broad answer-context owners | New primary suggestions |
| --- | ---: | ---: |
| Critical repository occurrences | 22/22 | 18/22 |
| Candidate count range | 11–17 | 1–4 |
| Mean candidate count | 14.7 | 2.4 |
| Cases within the frozen useful bound | 0/10 | 10/10 |
| Cases retaining every critical repository within the bound | 0/10 | 6/10 |
| Automatic routing/abstention | Not implemented | Not implemented |

Four primary shortlists miss a required repository: ir01 `contract-library`, ir02
`order-worker`, ir06 `inventory-api`, ir07 `order-api`. **All four remain inspectable
in Other matches.** Do not confuse a smaller list with complete investigation scope.
The fixed policy is retained with these failures; no case-specific allowlist, threshold
tuning, source/prompt change or extra model run is used to improve the score.

Both fresh generations select the same sources/support. The complete original answer
context hashes and Task 035 keyword/answer-context summary metrics remain unchanged.
Original verification covers the same 583 span occurrences and 77 Git files. The eight
fresh cases test distinct symbols, a shared declaration/producer/consumer, common-only
and zero-hit inputs, duplicate labels, ties beyond the cap, source-name-only matches
and a negative mention. They validate mechanics, not independently reviewed semantics.

## Verification

- `pnpm check`: 345 tests, strict typechecks and builds. Three new tests cover the eight
  frozen cases, fresh identities, ownership, non-multiplying repeated terms, authenticated
  model-free API input, original support, historical/stale scope and source/policy fences.
- Initial strict compilation caught a widened version-string type; explicit result
  typing fixes it without changing the frozen ranking policy.
- The candidate browser smoke uses twenty owned synthetic repositories with answer mode
  disabled. A source label containing HTML remains escaped. Keyboard citation opening
  focuses original evidence; 390 px rendering has no horizontal overflow.
- The browser verifies accessible other matches, no-match uncertainty, refresh/history,
  separate engineer notes and delayed response/evidence fences after question, review,
  source revocation and policy changes. The existing bulk/orientation smoke passes too.
- Two early browser harness errors were corrected: waiting for registration completion
  before clicking Index sources, and supplying the CDP Enter character for native keyboard
  activation. Neither required a product behavior workaround.
- A final frontend build and browser run cover singular-label wording and hiding an empty
  engineer-notes section after the full check. All ordinary tests and browser fixtures
  are model-free; no corporate source is accessed.

Reproduce with the repository toolchain after building:

```sh
node scripts/loredock-candidate-evaluation.mjs
node scripts/loredock-candidate-smoke.mjs
```

Run browser scripts sequentially: each owns port 4244 and temporary synthetic data.
The diagnostic verifies the retained Task 035 source selection instead of overwriting it.
Independent semantic review, missing-implementation decisions, useful routing across
all cases and an eligible private pilot remain open. Historical answer gates stay failed.
