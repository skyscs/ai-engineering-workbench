# Task 009 — Historical investigation and evidence-backed root cause

Status: accepted through the user's merge of PR #10 into main (af4c820). See [implementation contract](../docs/decisions/0013-investigation-pairs-and-evidence.md) and [user/API guide](../docs/investigation.md).

## Goal

Implement the first real product workflow: run an AI-assisted historical investigation and store a versioned result with evidence.

## Scope

- Task stage state machine through ROOT_CAUSE_READY
- integrate the StageRun persistence introduced in Task 006
- investigation instruction template
- include task description, active constraints, selected repositories/worktrees, and imported artifact references
- prohibit implementation in the investigation prompt
- parse/store structured investigation/root-cause result
- evidence model and UI rendering

## Acceptance criteria

- investigation result is versioned
- root-cause result references at least one evidence item when claiming a concrete cause
- UI can navigate evidence to a human-readable repository/artifact locator
- failed/invalid structured output does not silently become a successful result
- previous successful versions remain immutable

## Review additions

- Start with one AI invocation producing investigation and root cause together;
  validate both and publish the pair transactionally. Preserve the previous pair
  on malformed output, missing evidence, cancellation or storage failure.
- Snapshot requested model/profile, CLI version, prompt/schema version, description,
  repository SHAs, artifacts/hashes and active constraints. Do not snapshot tokens.
- Verify every locator deterministically: selected repository/artifact ownership,
  pinned revision, existing path and valid range. Distinguish locator validity
  from whether evidence actually proves a hypothesis; the engineer reviews meaning.
- Evidence must reference the pinned revision, not mutable current branch lines.
  Unavailable history/artifacts are visible; never fabricate a successful locator.
- Insufficient evidence is a valid structured conclusion with unresolved questions;
  concrete causes require evidence. Optional confidence is not calibrated probability.
- Render Markdown without executable raw HTML and restrict link schemes; source
  paths and artifact contents are untrusted. Never offer arbitrary-path file reads.
- Run one real synthetic end-to-end investigation now; do not defer all product
  validation to Task 011. Test malformed output and unsupported artifact disclosure.
