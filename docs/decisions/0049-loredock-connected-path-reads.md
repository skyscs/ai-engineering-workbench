# ADR 0049 — Read-only connected paths from retained facts

## Status

Implemented by Task 068, 2026-11-02, after Task 067 passed its prospective offline
binding-coverage qualification. Task 069 adds the separate browser integration below.

## Decision

Add a strict TypeScript `CodePaths` service and two protected reads over the existing
CodeAnalysis owner. Port the qualified saved-tree proof, manifest join, import/Java
candidate domains, indexed resolver and atomic path admission. Keep parser profiles,
matching rules and original citation authority unchanged. The service neither starts
analysis nor calls Git, repairs data, stores a graph or creates a cache/schema.

The existing `codeFlows` adapter remains authoritative for saved answers, candidate
links, interface previews and engineer corrections. New paths have independent IDs and
no correction controls. A supported static path is a partial navigation aid; it does
not establish runtime dispatch, server authority, deployment or collection ownership.

## Identity and request lifetime

`connected-paths-v1` generation identity includes the build and its recorded source set,
current registry/policy, inventory/parser/analysis limits, manifest, complete canonical
path metadata, declaration adapter/input hash and all effective server limits. Every
root/node ID binds that generation. The response's `projectionId` hashes the selection
and complete bounded envelope, excluding its own hash field. Timings are not content.

The declaration identity includes its older-index status. Publishing another index can
therefore change an authorized historical path generation even when its originals are
unchanged; pinned requests must reload. Stable historical reads and restart retain their
identities. The offline Task 067 IDs are deliberately not production identities.

Explicit root and root-page requests pin inventory and generation together. Foreign,
stale or evicted IDs do not select a replacement. Unpinned reads select the latest
compatible published inventory for the requested index. A newer unpublished attempt
does not replace the retained published inventory.

One connected read per catalog may run at a time, including across service instances.
Further requests fail busy without a queue. Client cancellation and daemon shutdown
abort cooperative work and release ownership before the store closes. The Hono Node
adapter forwards premature connection closure to the request signal; service/API tests
and an owned ephemeral TCP listener verify cancellation and a subsequent successful read.
Other lightweight reads remain available.

Preserve the qualified conservative database-write fence: any SQLite mutation during
an asynchronous scan discards that pending response, even when the write belongs to a
new unpublished analysis attempt. The existing inventory stays published and can serve
an explicit retry after writes settle. No automatic retry loop is introduced. Scope,
inventory, original/fact and metadata integrity checks still precede publication; changed
or failed reads return no pending graph, source names, fact vectors or evidence IDs.

## Bounded envelopes

Default reads admit at most two whole supported paths; explicit selection admits one.
Root pages contain at most four cards in the qualified deterministic order, including
isolated roots. Page navigation does not change binding resolution or silently discard
alternatives. A card and its full original support are admitted together; an oversized
entry remains counted with an opaque ID and explicit unavailable reason.

The entire success envelope fits 512 KiB, including identity, root cards, support,
coverage, gaps and the optional graph. Existing 160-node/240-edge/twenty-step display
limits and work/metadata/resolution bounds remain fixed. Full retained fact and resolution
vectors are internal only. Errors expose bounded domain messages. Assertions at display
integrity/size boundaries become explicit `CORRUPT_CODE_FACTS`/`OUTPUT_LIMIT` errors in
the production port, without changing the qualified admission decisions.

The API accepts validated catalog IDs and selection only. Unknown, duplicate, oversized
or malformed parameters fail before scanning. All reads remain inside the existing
Host/Origin/session/no-store boundary; there is no arbitrary-path or raw-fact endpoint.
See the [API contract](../loredock/CODE_PATHS_API.md).

## Verification and limits

Small owned regressions compare normalized paths, alternatives/omissions and unchanged
legacy derivations with the qualified offline reader. Separate checks cover saved SHA-256
tree bytes, unknown/ambiguous targets, root paging and original support, HTTP protection,
empty/unavailable states, bounds, concurrent writes, busy/cancel/shutdown, scope changes,
inventory eviction, corruption, historical reads and restart.

No frozen experiment is rerun, and no new full-volume timing or semantic acceptance is
claimed for the HTTP port. Task 067's retained measurements qualify the underlying bounded
algorithm on its synthetic family. Cooperative deadlines and sampled resource measurements
do not establish general real-time guarantees. The next phase adds a collapsed browser
view and checks its request/evidence fences without switching existing consumers.

## Browser integration (Task 069)

Mount a separate collapsed connected-path view beside the existing flow adapter. Reuse
map scope/historical identity and the app's original reader; pass `clearEvidence` through
SystemMap. Enable it only when the daemon advertises code analysis. There are no new
settings or persisted UI selections.

The expanded component owns a lightweight analysis poll and one serialized path reader.
A request sequence and component lifetime fence completions independently of AbortSignal;
only the latest pending selection may run. Published compatible inventory changes reset
to defaults once. New unpublished attempts retain the earlier published view. Pinned errors
require an explicit retry or explicit default reload. Collapse/unmount clears originals
opened from this view and cancels owned work. Existing shared session bootstrap remains
independent of an individual request's cancellation.

Historical labeling uses map staleness, which includes a newer published build; the
analysis summary's stale flag only describes registry mismatch. Fifteen owned browser
checks include buffered responses delivered despite cancellation, a real server busy read,
publication/eviction, source/policy changes, empty/unavailable states and keyboard/focus.
These are functional checks, not broader semantic or private-pilot acceptance.
