# LoreDock first-slice contracts

Status: Task 015 delivered the source catalog. Task 016's bounded cited-answer slice
is owner-accepted through PR #20. Task 017's declaration map was accepted through PR #21.
Task 018's model-free code links and partial static outlines were accepted through
PR #22. Task 019's human correction overlay was accepted through PR #23. Task 020's
validated text-file reuse and bounded inventory comparisons were accepted through PR #24.
Task 021's explicit review/reapplication across recorded refresh ancestors was accepted
through PR #25. Task 022 adds source-backed README orientation and reading navigation
through merged PR #26. Task 023 connects bounded matching engineer notes to answers.
Semantic/AI refresh and Context Packs remain separate work.
See the [owner acceptance](L2_ACCEPTANCE.md),
[map decision](../decisions/0022-loredock-declaration-map.md),
[code-flow decision](../decisions/0023-loredock-static-code-flows.md),
[correction decision](../decisions/0024-loredock-engineer-corrections.md),
[refresh decision](../decisions/0025-loredock-incremental-refresh.md),
[review reapplication decision](../decisions/0026-loredock-correction-reconciliation.md),
[orientation decision](../decisions/0027-loredock-project-orientation.md),
[answer checkpoint](ANSWER_FOUNDATION.md) and [user guide](USER_GUIDE.md).
The [executable fixture](../../fixtures/loredock/README.md) uses a smaller, versioned
fixture manifest. Do not treat its IDs or JSON shape as a public product contract.

Declaration-map/code-flow v1 expose source projections, not current human review state.
Consumers must read the correction overlay and its project revision before presenting
a flow as current with respect to engineer review. Human text/scope remain unverified;
active affected-flow dependencies require review even when the original source hash
has not changed. Another index requires its own review; no note is carried by name alone.

`loredock-reconciliation-v1` is a separate bounded review preview, not a source graph or
an active correction overlay. It defaults to the selected index's fixed baseline;
an explicitly chosen earlier source must be within 20 recorded authorized ancestors.
Only the latest active version per source target is proposed. No implicit search past
a skipped review/withdrawal occurs. Up to 20 corrections and 512 KiB are returned with
explicit omissions. Older-history discovery limits are disclosed.

Identity includes link kind, endpoint kinds/labels, source IDs and file paths, with
unique matches on both sides; declaration comparisons use symmetric endpoints and
code links remain directional. Eligibility also requires exact supported schema/adapter,
relationship semantics, endpoint properties and complete supporting file/span hashes and
ranges. Reissued IDs or an unrelated commit alone do not change content. Changed, missing,
ambiguous, unsupported and already-reviewed targets cannot be reapplied, including targets
whose current decision is withdrawal. Matching support never verifies the human statement.

`POST /api/corrections/reapply` accepts exactly `{requestId, buildId, sourceCorrectionId,
targetId, previewHash, expectedRevision}`. The server reconstructs the preview, checks
current source/target authorization and the active original version, and copies its human
action/text/scope into a new index-local correction. Global review CAS, exact replay and
all existing limits still apply. Schema 6 atomically records immutable opaque lineage
and the union of original/current source dependencies. An optional `reappliedFrom`
summary field identifies the exact earlier correction ID/build/version; existing v1
summary fields and source projections retain their meaning. Subsequent edits/withdrawals
are independent; replay returns the original result without reactivating it. Revocation
fences/purges every dependent version; old-policy history/replay remains unavailable.

## Project orientation and reading navigation

`loredock-orientation-v1` / `readme-orientation-v1` is a separate disposable read
projection. Each authorized recorded repository has an original README excerpt or a
gap, selected revision and coverage. New registrations outside that index remain
separate unindexed gaps. Read only a single unambiguous supported root README and
optional root package/Maven manifests; do not infer roles from names or replace absent
documentation with nested text. Failed/truncated inventories cannot establish absence.

Excerpts retain exact original text, inclusive subranges and all overlapping issued
span IDs. Their provenance is documented/unverified. Older/contradictory prose is not
rewritten to match code/configuration. Check metadata budgets before reading and validate
complete original file/span coverage. Limits are nine documents, 32 KiB/file, 96 KiB
input, eight spans/file, 16 lines / 2,000 UTF-8 bytes/excerpt and 128 KiB output. Gaps
and omissions are explicit. The projection adds no DB schema, command execution or
model work. Guide me navigates existing source/map/flow/coverage views; it is not a
semantic course or a new architecture claim store. Current policy/revocation and late
response fences cover all context and citations. See ADR 0027 for selection details.

## First source manifest and data ownership

Each project owns a source registry and immutable builds. A source has a stable opaque
ID, kind, display name, canonical local location, policy revision and enabled/revoked
status. Display names and file paths are not identity. The first source kind is a local
Git repository. Later remote cloning and document connectors require separate tasks.

An import request snapshots the source set, include/exclude policy and committed
revision of every source before extraction. Dirty worktree changes are displayed as
excluded, never silently mixed into HEAD. Do not fetch, checkout, run hooks, load source
configuration as application configuration, initialize submodules or install dependencies.
Resolve paths against Git tree entries; symlinks, submodules, binary/invalid UTF-8 and
oversized files become explicit coverage gaps. LFS pointer content is not the original.

| Entity | Minimum persisted fields and invariants |
| --- | --- |
| Project | ID, name, active source-set revision, policy revision. |
| Source | Project ID, source ID, canonical location, kind, status, policy; never credentials. |
| SourceRevision | Source ID, commit/object format, tree ID, captured ref label and time; immutable. |
| Build | Project ID, source-set/policy versions, full revision vector, adapter versions, status, environment label and deployment coherence (`unknown` initially). |
| File | SourceRevision, safe relative path, blob ID, content hash, byte size, detected format, eligible/excluded/error reason. |
| Span | Application-issued ID, file hash, 1-based inclusive line range, text hash, extraction version. UTF-8 and LF-normalized display mapping must be explicit; original bytes retain their own hash. |
| Claim | ID, build, statement/type, supporting span IDs, provenance (`extracted`, `model`, `human`), review state, freshness, conflicts. Model IDs must reference an issued span in the same authorized build. |
| Relation | Typed endpoints, relation type, environment/config condition, evidence IDs, provenance and resolution status; unresolved endpoints remain unresolved. |
| WorkUnit / Attempt | Build, stable input/cache hash, kind, state, attempt ID, request ID/hash, lease, timestamps, usage or `unknown`, output/checkpoint reference. |
| Question / Answer | Question, build/policy, retrieval set, prompt/runtime identity, bounded validated result, unresolved gaps and supersedes link. |

File and span IDs must not merge two sources merely because paths or text match.
Generated source summaries retain full dependency edges to their input spans. Source
revocation immediately fences reads, retrieval and exports; derivative purge is tracked
separately and can resume. A previously exported external copy cannot be recalled.

## Coverage before confidence

Question retrieval records lexical, orientation or empty mode. With no lexical hits,
the pilot may use at most six existing first spans per repository and 18 overall from
root README/manifests and representative source languages. This is a visibly labeled
orientation sample; it is not relevance proof or a complete inventory. All existing
authorization, whole-span, 30-span and 64 KiB limits still apply.

New answers use schema `cited-answer-v3`. The decoder's citation enum contains only
the issued input IDs; with no input spans, claims are disallowed. Publication still
revalidates all input and referenced evidence. Unknowns are unanswered questions ending
in `?`; factual explanations and relevant contradictions require cited claims. These
format constraints do not establish semantic grounding. Historical answer prose stays
unchanged and exposes its original prompt/schema identity. See
[ADR 0021](../decisions/0021-loredock-answer-quality-and-cli-refresh.md).

Retrieval `fts-question-v5` additionally freezes `answer-review-v1`: latest authorized,
non-withdrawn selected-index notes whose original evidence overlaps issued passages.
At most ten notes / 16 KiB of serialized UTF-8 note JSON are admitted, with whole-note
omissions and unmatched counts disclosed. Original note/version, human scope and original
relationship scope stay distinct. Prompt v7 treats notes as untrusted assertions; citation
IDs still come exclusively from source spans. These notes do not prove a claim or expand
source retrieval. Context hashes include the global review revision, checked at start,
before dispatch and at publication. Saved answers expose independent review freshness;
older contexts stay unchanged and report `not-recorded`. Source dependencies include
the union of admitted note scopes, including reapplication lineage. See
[ADR 0028](../decisions/0028-loredock-answer-review-context.md).

Every build reports sources resolved/failed, files considered, eligible, extracted,
excluded by reason, truncated and failed, bytes indexed and adapter coverage. Report
coverage per source and language, not just one percentage. A successful file scan does
not imply complete architecture understanding. A failed source never disappears from
the build's requested revision vector. Partial output is labeled partial and cannot
assert absence across failed/excluded material.

The fixture's policy includes 18 text files and excludes nine canaries across three
repositories. Its manifest reports zero extracted files because generating a corpus
is not production ingestion. The separate FTS experiment indexes those 18 files only
to establish local feasibility. No source proves that the three revisions are deployed
together. Local config connects the intended event flow; production topic values and
deployment revisions are unknown.

## Bounded jobs and recovery

- A request ID is unique within a project and operation. Same ID and identical payload
  return the existing operation; a different payload is a conflict. Persist this before
  starting work. An input hash is not an external provider idempotency key.
- Persist each attempt intention before calling the runtime; atomically publish validated
  output and completed status. Failed validation cannot replace a previous good answer.
- `pause_requested` stops scheduling new units and lets the current bounded unit finish.
  `paused` preserves completed checkpoints. Pause is not cancellation.
- Cancel aborts the owned subprocess and prevents late result publication. Preserve prior
  completed units for audit. A new retry is explicit; it never silently resumes billing.
- On restart, expired `running` attempts become `interrupted`, with usage/completion
  unknown when no reliable receipt exists. Do not automatically repeat an ambiguous
  external call. Explicit resume schedules a new attempt using validated completed units.
- Cache keys cover source set/revision vector, policy, extractor/schema/prompt/runtime
  configuration and selected model/effort. A changed, added or removed source/file must
  invalidate queries and negative/absence claims even if their old positive spans survive.
- One active mutating build per project in L1; one model attempt per project in L2.
  Compare-and-set publication checks build, policy, cancellation and source revocation.

The L0 SQL experiment checks persistence primitives and interruption classification.
L1 now verifies deterministic file checkpoints, pause/cancel/resume, restart, request
replay and publication fencing. L2 additionally verifies persisted model intentions,
request replay, reported/unknown usage and explicit retry after interruption.

## Provisional budgets

These are visible engineering defaults for the synthetic pilot, not claims
about cost or the eventual 20-repository workload. L1 wall exhaustion pauses resumably;
file/path/total-byte caps produce explicit partial coverage and require a narrower
policy/new build. Limits never silently drop coverage or start another model call.

| Boundary | Initial limit |
| --- | --- |
| L1 pilot | 3 registered repositories; 10,000 candidate paths per build. |
| Text files | 1 MiB per file; 50 MiB total admitted text per build. |
| Extraction units | One file per unit; bounded parser work; 5-minute build wall budget with checkpoint. |
| Retrieval | At most 30 spans and 64 KiB UTF-8 text after deduplication. |
| Complete prompt | 96 KiB UTF-8, including metadata and instructions; CLI overhead is separate. |
| Answer run | One runtime invocation, 120-second wall timeout, at most 256 KiB captured output and 20 claims. |
| Retry | No automatic application retries; explicit new attempt after interruption. CLI transport requests remain bounded by the wall limit, not an HTTP request count. |
| Usage | Record reported tokens; use `null` plus a reason if unavailable. No invented monetary total. |

Both character/byte and token limits must be distinguished in the UI and runtime
contract. If token measurement is unavailable, call the input cap a byte budget.
No hidden paid fan-out per repository or per file. Later scale work changes defaults
using recorded measurements, not by silently increasing budgets.

## First adapters and evidence treatment

L1 provides Git metadata, bounded README/text extraction, JSON manifests/config and
Maven XML metadata without external entity resolution. It never runs Maven or npm.
L2 first uses text retrieval and source inspection; it does not need full language
parsers to answer one question. L3 adds Java call/config mapping, TS/Vue imports and
HTTP literals, Dojo AMD, Kafka producer/consumer and Mongo access relations. Task 018
implements only the versioned synthetic interface profiles and client syntax described
in ADR 0023; it does not qualify production framework adapters or infer config/dispatch
wiring. Static syntax and candidate cross-source hops have separate statuses and citations.

Only patterns supported by actual inputs receive structured adapters. Framework-specific
extensions wait for explicit, permitted sample manifests. Dynamic environment values,
reflection, aliases, custom wrappers and incomplete parser support stay visible as
unresolved links. Code and documentation disagreement remains a conflict with both
citations, not a vote or an automatic claim that code is deployed truth.

## Context Pack outline for the later Workbench bridge

Versioned immutable JSON plus a readable view: pack ID/hash, project/build IDs, policy
version, source revision vector, environment/deployment coherence, question/purpose,
candidate repositories and selection reasons, claims/relations with resolvable spans,
conflicts, unknowns, coverage, freshness and review provenance. Exclude credentials,
unbounded files and model-invented paths. Include size limits and schema version.

Workbench validates a pack and pins its exact bytes/revisions to a new task; it cannot
silently substitute current HEADs. Search candidates are separate from proposed code
modification targets. A live provider and automatic routing come after frozen-pack
acceptance. Define revocation/retention behavior across both applications before enabling
that bridge; do not promise that an immutable historical snapshot remains readable after
its source authorization is revoked.
