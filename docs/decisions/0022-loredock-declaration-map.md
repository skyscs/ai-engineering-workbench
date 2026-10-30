# ADR 0022 — Read-only declaration map before code-flow extraction

Date: 2026-10-30. Status: implemented in Task 017, the first bounded L3 slice.

## Decision

Derive a system-map projection from an explicitly selected, published, currently
authorized LoreDock index. Do not add a graph database, model invocation, source
execution, background refresh or new SQLite migration. Original immutable files and
issued spans remain the durable inputs. The view is recomputed on request, with stable
build/source/file/declaration identities and a deterministic projection hash.

The first version recognizes direct JSON package identity, existing conservative
Maven coordinates, JSON route/handler declarations, flat event-contract declarations
and top-level scalar values in JSON files under `config/`. Scope comes from an explicit
`environment` string, never a filename or presumed deployment. Unsupported shapes and
contract extensions are omitted with counts; raw source remains searchable. No framework,
service role, producer/consumer role or handler implementation is inferred.

Repositories and packages are separate entities; repository names cannot identify
services. Equal contract names/text remain distinct nodes in their own sources.
Identical supported contract shapes and equal configuration keys/values under the same
declared environment produce **candidate comparisons**, with citations to both sources.
Different same-name/version contract content or same-key scoped settings are displayed
as declaration differences, not confirmed runtime conflicts or compatibility verdicts.
Different explicit environments are not compared. Unknown scope stays unknown.

## Bounds and integrity

Read candidate metadata before loading any BLOB. Select documents in deterministic
round-robin source order so a large repository cannot consume the entire document cap.
Admit at most 100 documents, 32 KiB per file and 256 KiB total source text, with at most
eight issued spans per file and 100 collection members. Validate original bytes and
all cited spans through the existing evidence service before extracting declarations.
Reparse source bytes instead of trusting mutable derived metadata.

Bound the projection at 150 nodes, 250 links, 2,000 eligible cross-source comparisons
and 512 KiB serialized output. Budget omitted nodes/links cannot leave dangling edge
endpoints. Count unsupported/omitted work and always mark this adapter's map partial.
These are first-pilot engineering limits, not evidence of complete architecture coverage.

The projection stores no new source-derived bytes. Revocation therefore removes the
source and all related comparisons on the next authorized read; existing catalog purge
handles the underlying original text. Policy changes fence historical maps. Historical
indexes retain original source revisions and display freshness relative to the latest
published index/current registry. No historical snapshot becomes a claim of co-deployment.

## API and UI

`GET /api/system-map?buildId=...` uses the existing exact Host/Origin, session and no-store
boundary. It accepts no client-supplied graph or filesystem path. It returns typed nodes,
links, original evidence locators, coverage, omissions and unresolved scope. It omits
absolute checkout paths and never queries brokers, databases or remote services.

The browser groups declarations under repositories and exposes cross-repository clues
with original-source buttons. All source-derived labels/properties render as escaped
React text. Working data is tagged with policy/registry/selected/latest-index boundaries;
late responses cannot restore a previously hidden map after a source/policy change.
Implementation limits stay under coverage details, while partial/unverified scope is
visible alongside matches. No extra setup is required to read the map.

## Consequences and follow-up

This read projection deliberately precedes durable semantic graphs and human edits.
Later tasks must version code-to-declaration adapters, resolve actual caller/producer/
consumer ownership, reconstruct two static flows and add engineer-supplied corrections
with derivative invalidation. Those capabilities are not inferred from this first map.
Answer retrieval remains the accepted bounded text path; unreviewed candidate edges
are not silently promoted into model facts or Workbench repository-selection authority.
