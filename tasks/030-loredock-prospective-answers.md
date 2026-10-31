# Task 030 — One-shot prospective answer qualification

Status: in progress. Follows Task 029 / merged PR #33 (`b4f29f9`).

## Scope and acceptance

1. Preserve the frozen Task 028 questions, propositions, qualification rules, original
   corpus/oracle and historical results. Freeze prompt v8, retrieval v7, source hashes,
   answer schema and runtime settings before dispatch. No question/prompt/ranking tuning.
2. Recheck the previously selected personal connection using the existing restricted
   production adapter. Retain gpt-5.6-terra / medium and CLI 0.166.0 / text-only-v2.
   Never inspect authentication stores or fall back to another account/model.
3. Run the twenty-four questions once, in their frozen development-then-reserved order,
   through production Catalog/Answers. Only question strings and production-selected
   context reach the model. Save exact prompts, original evidence, raw outputs, immutable
   attempts, runtime identities and usage. Keep the benchmark outside model input.
4. Budget: at most 24 application attempts total, one active invocation, 120 seconds
   per attempt, no automatic retries and no second run. Persist a dispatch checkpoint
   before each external call; stop on operational failure. Disclose unknown usage and
   unobserved CLI-internal request counts. This budget belongs to Task 030; Task 028's
   zero-model contract remains an unchanged historical record.
5. Review every claim and every required answer/qualification against its issued
   original evidence. Record equivalent support explicitly. Optional background is
   not mandatory, but every volunteered claim must be grounded. A case passes only
   when all required propositions/qualifications pass and no material unsupported or
   forbidden assertion occurs. The prospective gate requires 24/24 cases passing;
   report development and reserved scores separately. Do not rewrite Task 027's gate.
6. Add fake-runtime tests for oracle separation, budget/failure/checkpoint boundaries,
   existing-output refusal and frozen-contract mismatch. Independently reconstruct
   source bytes and verify every claim/requirement has a recorded judgment. Preserve
   restart/replay/revocation evidence and unchecked independent human-review boxes.
7. Publish all results, including failures, exact usage and limits. Run full checks,
   review the diff and merge only after both exact-head CI runs pass under the owner's
   standing authorization. No product/UI changes unless a separate evidenced task is needed.

The reserved wordings have been inspected for retrieval and were authored by the same
agent after earlier failures; they are not an independent blind benchmark. Successful
engineering checks or agent scoring do not establish L5/private-project acceptance.
After this single assessment, prioritize the evidenced product gap or the next bounded
framework/retention capability rather than repeatedly tuning against these answers.
