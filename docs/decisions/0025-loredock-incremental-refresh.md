# ADR 0025 — Validated extraction reuse and committed-inventory comparison

Date: 2026-10-31. Status: implemented in Task 020, the first bounded L4 slice.

## Decision

Keep every index an independent immutable source snapshot. An explicit update still
resolves each active repository and inventories its complete available committed tree;
do not skip a repository because its earlier summaries looked complete. Capture the
previous published index as a fixed baseline when starting the new build. Preserve
the existing pause/cancel/resume and publish-only-after-work lifecycle. Do not fetch,
checkout, execute source, start background Git scans or invoke a model.

LoreDock schema 5 adds the baseline/refresh version to builds and extraction integrity,
reuse lineage, durable Git-read attempts and cache rejection counters to file units.
The refresh version is `git-reuse-v1`. Existing source evidence, answer bytes and human
correction history survive migration. No Workbench storage/runtime is changed.

## Eligibility and integrity

Current path/type/policy/file/project-byte admission runs before cache lookup. An
eligible candidate must belong to the fixed published baseline, same source identity,
path, Git mode/blob/size and exact policy/extractor version. Never deduplicate across
repositories by equal bytes, use unpublished attempts, or search arbitrary older builds
until a result happens to fit. Repository snapshot/inventory must succeed first.
Missing blob-size inventory metadata is a source failure rather than an empty file.

Validate metadata byte counts and complete span-count/byte bounds before loading
stored BLOB/text. Check raw size, SHA-256 and the Git blob object hash from the new
inventory; decode UTF-8, normalize CRLF and validate every original span/range/hash
against the complete file. Validate a derivation checksum covering policy, extractor,
source/path/mode/blob/size, raw hash, metadata and span hashes. This is an integrity
check within trusted local SQLite storage, not a signed source/author attestation.
Schema 4 checkpoints have no checksum and require full re-extraction to qualify their
metadata once. Current fingerprinted checkpoints avoid language/manifest re-extraction.

Copy valid extraction into a new file row and new issued span/search IDs atomically.
Rebuild both search representations with current application code; never transplant
FTS rows or issued citation identities. The new index retains its own revision vector.
Old evidence is unchanged. Reuse saves Git file reads and extraction work, not retained
source storage: the new build still owns its bytes and can be purged independently.

Corrupted cache increments a rejection counter and falls back to the pinned Git object.
Do not hide a failed Git command or treat DB publication failures as ordinary misses.
Read attempts are recorded before dispatch, including interrupted retries; they are
not a precise subprocess count or AI-usage measure. A rejection is not itself proof
of successful repair. Byte-dependent exclusions/failures are retried: on the frozen
corpus, 18 text files are reusable but three binary canaries still need byte reads.

Resume validates completed checkpoints and current path/byte limits before continuing.
It retains the original baseline and pinned revisions even if HEAD advances while
paused. Cancellation/authorization fences win over late results. Complete update
failure retains the prior published index; partial results retain explicit gaps.

## Comparison and UI

Protected `GET /api/builds/:id/changes` compares a selected published index with its
recorded baseline under the same existing Host/Origin/session/no-store boundary.
It reads inventory metadata, not source BLOBs or arbitrary paths. Both indexes must
pass current policy authorization. Revoked source scopes are omitted entirely.

Classify added/changed/removed/unchanged entries by source/path and Git mode/blob/size.
Distinguish changed extraction coverage from changed source content. A new source is
inventoried and visible. Missing entries only prove addition/removal when the relevant
opposite inventory is complete; failed/truncated scopes remain uncompared. Renames are
added/removed paths, not inferred identity. File-inventory completeness does not imply
complete source analysis or coherent deployment.

Read at most 10,000 metadata entries per index. Totals cover those bounded inventories;
details are a round-robin source preview capped at 100 safe paths and 512 KiB output.
Disclose omitted details and gaps. Original/selected first-span IDs allow opening
available evidence on either side. Earlier indexes predating refresh tracking show
comparison/metrics as unavailable rather than inventing zero-work history.

The primary action becomes **Update knowledge** after a published index exists.
Simple change counts describe the selected index; reuse/read/rejection diagnostics
stay under **Update details**. The prior index remains usable during updates. Current/
historical selection, policy/source changes and late-response guards cover comparison
responses too. All source-derived names/path strings use escaped React text.

## Invalidation and follow-up

Maps/flows are recomputed from the new full source inventory; additions and previously
absent consumers therefore participate even when most files are reused. Old answer
attempts retain their original build and existing staleness labels; no paid regeneration
starts. Engineer corrections remain attached to their original index, with no implicit
reconciliation or transfer. Source revocation purges all copied byte/span generations
and extraction fingerprints through the existing lifecycle.

This does not close full L4: semantic/AI unit caching, correction reconciliation,
retention budgets and broader invalidation remain separate. Broader orientation,
production-framework qualification, 20-repository acceptance and the Workbench bridge
also remain open. No new dependency, external persistence or model request is required.
