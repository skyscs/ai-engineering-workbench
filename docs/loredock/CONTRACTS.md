# LoreDock first-slice contracts

Status: the L1 catalog subset is implemented in Task 015; claims, relations, model
attempts and Context Packs remain proposed. See [ADR 0019](../decisions/0019-loredock-local-catalog.md)
for concrete L1 storage, API, extractor and budget decisions and the
[user guide](USER_GUIDE.md) for implemented behavior.
The [executable fixture](../../fixtures/loredock/README.md) uses a smaller, versioned
fixture manifest. Do not treat its IDs or JSON shape as a public product contract.

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
replay and publication fencing. Model-attempt and ambiguous-provider semantics remain L2.

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
| Answer run | One runtime call, 120-second wall timeout, at most 256 KiB captured output and 20 claims. |
| Retry | No automatic model retries; explicit resume after interruption. |
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
HTTP literals, Dojo AMD, Kafka producer/consumer and Mongo access relations.

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
