# Connected path reads

The model-free connected-path API is available when the normal code-analysis service is
enabled. It reads a published index and an existing compatible published code inventory.
It never starts analysis or accesses a working tree. The existing **Browse connected
paths** screen consumes the same native v2 responses. Static-flow, answer, candidate
and review consumers remain unchanged. GET derives paths from the selected saved index;
it does not create a saved receipt or validate current runtime behavior.

Use the existing [LoreDock session boundary](USER_GUIDE.md#local-api). These LoreDock GET routes
require the LoreDock browser session and exact loopback Host/Origin rules. Responses use
`Cache-Control: no-store`. Query parameters never accept filesystem paths or work limits.

| GET route | Parameters | Successful content |
| --- | --- | --- |
| `/api/code-paths` | Required `buildId`; optional paired `inventoryId` and `generationId`; optional `rootId` with that pair | Up to two default paths or one selected path, plus the first four entry points. |
| `/api/code-paths/roots` | Required `buildId`, `inventoryId`, `generationId`, and four-aligned `offset` | Up to four entry-point cards and original support; `graph` is null. |

Build/inventory IDs are canonical UUIDs. Generation/root IDs are lowercase 64-character
hashes. Offsets use canonical nonnegative decimal notation, are divisible by four, and
must name an available page. Offset zero is valid for an empty root catalog. Unknown,
repeated, incompatible or oversized parameters fail before resolution. Root pages do
not reset to the first page when an offset or generation is invalid.

## Response identity and coverage

An available response has schema `loredock-code-paths/2`, `status: available`, a `kind`,
`generationId`, `projectionId`, `identity`, `selection`, `coverage`, `roots` and `graph`.
It always carries `partial: true` and `deploymentCoherence: unknown`.

`identity` records the exact build, inventory, parser, metadata, declaration and scope
used. `selection` records the chosen root or null and the page offset. The root page
includes `total`, `previous`, `next`, `outsidePage`, `unavailableEntries`, `items` and
its original `evidence` references. Use the returned offsets rather than inventing page
positions. An unavailable card retains its ID and reason, with no partial citation set.

The native adapter is `connected-paths-v2`; graph schema is
`loredock-connected-display/2`. Identity also records `direct-java-topic-literal/1`
and `shared-capture-work/1`. An event-delivery candidate carries `topicCheck` with the
matching direct literal, rule and publisher/subscriber expressions/evidence IDs.
Dynamic expressions, escapes, differing literals and unsupported bindings remain explicit
omissions. The witness does not establish runtime broker/dispatch/deployment coherence.
Version-1 generations cannot be relabeled or silently reused as native v2 generations.

Coverage separates scanned/retained files, known path coverage, parser gaps, incomplete
binding domains, resolution totals and omission reasons. A zero or partial result does
not prove absence of dependencies or runtime behavior. The graph preserves the static
versus candidate edge distinction and whole-path omissions.

Every complete success envelope fits 512 KiB. Paths retain the fixed 160-node, 240-edge,
two-default-path/one-selected-path and twenty-node-per-path limits. Internal facts,
lookup indexes and alternative vectors are never HTTP response fields. Open issued
original IDs through `/api/evidence/:id`; graph/root metadata is not new citation authority.

## Availability, errors and retries

A missing, incompatible, unpublished or evicted inventory returns HTTP 200 with a small
`status: unavailable` envelope containing the requested `buildId` and `reason`. Inspect
Code coverage to start or finish analysis explicitly. A read never substitutes another
build or starts a background attempt.

Invalid parameters, foreign roots/pages and changed pinned generations return HTTP 400.
Busy, cancellation, scope/integrity failures and resource limits use the existing protected
error envelope and domain HTTP status, usually 409. It contains `error.code` and
`error.message`, with no pending source-derived result. Unauthorized/foreign-origin reads
remain 401/403. Unexpected server failures use the existing generic 500 response.

Actual shared-budget cancellation and limits return HTTP 409 with codes `CANCELLED`,
`CAPTURE_TIME_LIMIT` or `CAPTURE_WORK_LIMIT` and bounded path-request messages.
Internal capability/observer errors remain generic 500 responses. HTTP parameters never
construct budgets or select their limits. Clients must discard a failed pending view.

Only one connected read runs per catalog. `PATHS_BUSY` permits an explicit retry after
the current read finishes. The conservative `METADATA_CHANGED` fence rejects concurrent
database writes, including progress from a newer analysis attempt. It does not unpublish
the earlier inventory; retry after writes settle. A newer unpublished attempt is never
selected instead of the last compatible published inventory.

Changing selection or losing a generation should clear pending paths and original
evidence in clients. Never retry a pinned page against a new generation silently.
Daemon shutdown and client cancellation release owned work. The five-second work deadline
is cooperative, not a hard scheduling promise.

The [original read decision](../decisions/0049-loredock-connected-path-reads.md) and
[native producer contract](NATIVE_PATHS_V2.md) record identity, concurrency and compatibility.
The [fresh complete-operation qualification](BOUNDED_WRITE_FINAL_QUALIFICATION.md) precedes
this public migration. Synthetic verification does not establish
independent semantic/private-project acceptance or change the failed earlier evaluations.
