# Task 034 — Frozen interface answer qualification

Status: in progress. Follows Task 033 / merged PR #37 (`582d438`).

## Scope and acceptance

1. Execute the already frozen fourteen-question interface contract once, with at
   most fourteen application attempts, Terra / medium, 120 seconds per attempt and
   no automatic retry. Do not change questions, source bytes, retrieval or prompt.
2. Qualify the owner's previously selected personal CLI connection without a model
   call. Commit the execution contract, implementation/build hashes and identity
   before dispatch. A durable local run claim must prevent accidental repetition
   under another output directory; a failed run also consumes that claim.
3. Checkpoint each dispatch before calling the runtime and preserve raw output,
   usage, exact source context and derived interface comparisons before validation.
   Fail closed on contract/runtime changes and stop at the first operational failure.
4. Exercise the runner with a fake runtime, including raw failure retention, durable
   checkpoints, duplicate-run rejection, identity drift and contract tampering.
   Ordinary CI must make no real model requests.
5. Review every actual claim, unknown, required proposition and forbidden assertion
   against original evidence. Generate a reproducible provenance audit and a separate
   unchecked human review worksheet. Report omissions and unsupported extra claims;
   resolving citation IDs alone is not semantic acceptance. Preserve historical failures.
6. Verify saved history after restart, exact replay without a new call and revocation
   fences/purge. Full checks, documentation and both exact-head CI runs must pass
   before autonomous merge. Continue to the next justified phase without another
   command; missing private-pilot inputs remain explicit prerequisites.

This is a small synthetic, same-agent conformance evaluation, not independent or
private-project acceptance. Four interface cases lack their specific derived clue
under the existing six-comparison cap; keep that measured limitation unchanged.
