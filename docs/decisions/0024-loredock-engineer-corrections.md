# ADR 0024 — Append-only engineer corrections and flow review invalidation

Date: 2026-10-30. Status: implemented in Task 019, a bounded L3 review slice.

## Decision

Keep declaration-map v1 and code-flow v1 as deterministic source projections. Add
a separate `loredock-corrections-v1` overlay for human review of their relationship
claims. Do not replace extracted statements, change candidate/static status, infer
deployment from human scope, or silently send corrections to an AI provider.
This slice targets declaration comparisons and code links, not answer claims.

A local engineer can **dispute** a link, **clarify** its interpretation and optionally
name an environment. The recorded provenance is `human`, with `unverified` verification;
this is an application input label, not authenticated author identity. The original
relationship and its original evidence remain available beside the correction.
**Withdraw** creates a new version rather than deleting earlier text or review history.

Corrections apply only to the selected index and its recorded adapter/target identity.
Another index does not inherit them automatically, even when revisions are equal.
Historical index selection retains the earlier review. Reapplying/reconciling human
knowledge across refreshed code requires separate work; equal labels are insufficient.

## Persistence and publication

LoreDock schema 4 adds a monotonic project correction revision and tables for immutable
correction versions, source dependencies and affected flow IDs. Migration preserves
catalog evidence, source/build pins and saved answer bytes. Workbench storage is unchanged.

Each version records its target kind/issued ID, original projection hash, original
relationship snapshot/evidence IDs, index/policy/registry, previous version, action,
human text/scope, timestamp and content checksum. SQL triggers reject in-place edits
and deletion; the only permitted content update is a purge backed by a revoked source.
Opaque identity/dependency tombstones remain after purge.

Writes validate exact payload shape, current authorized published index, projection
hash and a supported issued link. Declaration containment/route-owner edges cannot
masquerade as comparison targets. Full graph/extraction validation reopens original
evidence before creating a target snapshot. Request IDs replay exactly normalized
inputs; conflicting reuse fails. A compare-and-set checks both project correction
revision and latest target version. Version, dependencies and revision publication
share one SQLite transaction, including output-budget validation. No index or model
job starts on save/withdraw.

Limits are 100 targets per index, 20 versions per target, 2,000 UTF-8 bytes per human
statement, 80 UTF-8 bytes per optional environment and 8 KiB per original target snapshot.
The final version slot is reserved for withdrawal. Current-overlay output is capped
at 512 KiB and per-target history at 256 KiB; writes that would make those views exceed
their budgets roll back. Active corrections are never silently omitted. Multi-index
retention/storage budgets remain later scale work.

## Dependency invalidation

A correction to a code link invalidates review of each original flow containing that
edge. A correction to a declaration comparison conservatively invalidates flows sharing
its supporting spans: a span can support multiple declarations, so this may request
broader review than a future semantic dependency graph. Persist the affected flow IDs
with each version. Withdrawal removes that version's active effect; any other active
correction continues to require review.

The browser marks affected outlines **Needs review**, keeps original paths visible and
shows the engineer statement/scope. This is freshness of human review, separate from
index staleness and the permanently partial source-analysis boundary. Rebuilding a
source-derived projection does not establish that a human disagreement was resolved.
Map/flow source hashes stay unchanged by review edits. Ask Project still uses original
source evidence; answer-review context integration requires its own provenance contract.

## Authorization and UI

Protected routes are `GET /api/corrections?buildId=...`,
`GET /api/corrections/:id/history` and `POST /api/corrections`, under the existing exact
Host/Origin, session, CSRF, body and no-store boundary. Clients submit issued IDs, not
graphs, evidence lists or filesystem paths.

Conservatively depend on every source in the recorded index. Any of those sources'
revocation fences list/history/request replay immediately, even if the target directly
cites only two sources. The existing resumable source purge clears every dependent
human statement, environment and target snapshot, including withdrawn/superseded
versions. Source/policy fences also apply to historical records. This is logical local
purge; backups and prior external copies remain outside that guarantee.

Inline controls add one correction text field, a dispute/clarify choice and optional
environment details. History and withdrawal remain adjacent to the link. Escaped React
text renders all human/source values. Source/selected-index boundaries hide old content
and invalidate late responses. Review revision updates refresh only the overlay, keep
open drafts and require explicit reconciliation of a newer target version. Pending or
failed review reads are visible and disable edits; unknown review state is never labeled
current. Failed writes can retry the same saved request without creating duplicate versions.

## Follow-up

Full L3 acceptance remains separate from these bounded synthetic deliveries. Broader
Overview/Guide Me, production framework adapters, incremental refresh/reconciliation,
20-repository scale acceptance and the Workbench bridge remain open milestones.
