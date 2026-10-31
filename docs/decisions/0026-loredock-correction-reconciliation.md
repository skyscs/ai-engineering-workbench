# ADR 0026 — Explicit reapplication of earlier engineer corrections

Date: 2026-10-31. Status: implemented in Task 021, a bounded L4 continuation.

## Decision

Keep engineer corrections local to their recorded index. After an update, offer a
separate deterministic comparison with an earlier review scope. Only an explicit human
action creates a new correction. The original source projection, note history and answer
prompts are unchanged. Matching support is not semantic verification of the statement
in a newer system, and human environment scope never becomes deployment evidence.

Default to the selected index's fixed refresh baseline. Permit explicit selection of
an older recorded ancestor to recover skipped reviews, with a 20-index discovery bound.
Stop on cycles, missing/unpublished records, old policy or revoked source scope. Disclose
gaps and limits. Never search arbitrary historical indexes or silently backtrack past
a skipped review/withdrawal to resurrect an older decision. Only the latest active
version for each original target participates.

## Matching and evidence

Reconstruct supported declaration-map v1 / `json-declarations-v1` and code-flow v1 /
`pilot-code-v1` projections from authorized original saved source. Verify the correction's
recorded claim can be reconstructed exactly, apart from the whole projection hash:
historical staleness/registry metadata can legitimately change that hash after publication.
Reject unsupported provenance or unreconstructable originals as unavailable comparisons.

Logical identity is link kind plus endpoint kinds/labels, source IDs and original file
paths. Code direction is significant; declaration comparisons use canonical symmetric
endpoints. Require a unique match in both source and target projections. Names alone,
file renames and heuristic source reassignment are insufficient. Missing means absent
from a bounded projection, not proof that a connection cannot exist in the system.

Eligibility additionally requires identical schema/adapter, link kind/status/reason,
environment/gaps, endpoint properties/scope/provenance or source ranges, and all edge/
endpoint supporting descriptors. Each descriptor includes source/path, inclusive line
range, full-file content hash and original span hash. Reopen evidence through existing
integrity/authorization checks; do not compare snippets. Evidence IDs, index IDs and
commit IDs are excluded from content equality because reuse issues new citations and
unrelated commits may advance HEAD without changing support. Contract/configuration
clues included by source projections remain part of the complete support comparison.

Expose unchanged support, changed support, missing, ambiguous, unsupported and already
reviewed states. Only unchanged-support entries can be applied. Existing target decisions
including withdrawal always win. Changed support needs a newly written correction.
Show original/current evidence and the wider revision scope before the apply control.
Even byte-identical support cannot establish that a human statement is still correct.

## Publication, replay and lineage

Protected preview uses `loredock-reconciliation-v1`, bounded to 20 corrections from one
chosen source index and 512 KiB. Counts/omissions and ancestor bounds are explicit.
Hash the deterministic preview, current review revision and source/target projection
provenance. No timestamp of the current request enters the hash. Publication/staleness,
registry/policy and correction changes invalidate a pending comparison.

Reapply accepts exactly request ID, target build, source correction ID, target link ID,
preview hash and expected global review revision. Reconstruct the comparison server-side
and recheck original active version/target vacancy. Copy the original action/text/scope;
clients cannot substitute a statement or forge lineage. The existing correction write
path computes fresh target evidence/affected flows. One transaction publishes the new
version, flow/source dependencies, origin checksums and monotonic revision; any failure
rolls back the complete action, including output/history validation failures.

Schema 6 adds an immutable `correction_reapplications` table referencing the exact source
and new correction versions, content checksums, preview hash and lineage checksum. Only
opaque IDs/hashes are added; no extra derived plaintext survives source purge. Migration
preserves earlier source/answer/correction bytes. Optional `reappliedFrom` summary data
links to the original version; ordinary summaries keep their existing fields/meaning.
Checksums are local integrity checks, not signed authorship attestations.

Normalize request fields and distinguish the reapply operation's payload hash from
ordinary correction saves. Check exact replay before recomputing a now-stale comparison.
Reauthorize both scopes; identical retry returns its own immutable result even if later
superseded/withdrawn, without changing current state. Changed inputs conflict. Once
published, the new decision is independent of later edits/withdrawal of the source note.
Origin history remains inspectable at its exact version.

## Source lifecycle and UI

Exclude revoked sources from the preview revision scope, including a fenced target's
metadata list. Store the union of source/target correction dependencies, retaining it in subsequent
edits/withdrawals. Revocation fences list/history/preview/replay immediately; existing
resumable logical purge clears every dependent statement/environment/target snapshot.
Opaque lineage remains subject to authorization. Policy changes fence older history.
Backups, copied acceptance artifacts and exported external copies cannot be recalled.

Reading the new note validates its own evidence plus original row/lineage integrity and
authorization. It does not recursively reopen all older evidence; damage to an old
index after a successful reapplication must not make a valid new correction impossible
to withdraw. Reading the original history validates its original evidence separately.

The system-map panel shows earlier notes as proposals, with no active review effect.
Opening a proposal exposes both claims/citations and the explicit apply decision. New
source/index/policy boundaries discard old UI state; review revision/selection keys ignore
late preview/apply responses. Existing inline drafts survive overlay refresh. Origin
buttons open the exact earlier note. All human/source text uses escaped React rendering.

No new dependency, setup input, model invocation, source execution or Workbench mutation
is introduced. Semantic/AI reconciliation, broader orientation, answer-review integration,
production-framework qualification, scale/retention and the Workbench bridge remain
separate milestones. This does not close full L3/L4 acceptance.
