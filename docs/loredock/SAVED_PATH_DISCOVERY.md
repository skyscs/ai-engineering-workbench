# Bounded saved-path discovery

Status: prospective Task 118 contract. Implement only after Task 117 exact-head acceptance.
The existing save/open links and immutable receipt format remain the foundation.

## Owned enumeration and pagination

Add a bounded ID enumeration method to NativeReceiptStore. It uses the existing layout
inspection, closed/disabled/busy checks and the caller's actual OperationBudget, returns
at most 64 canonical IDs in lexical order and exposes neither filesystem paths nor raw
bytes. The HTTP/browser layers never inspect directories. Enumeration alone grants no
source authority. Unknown/foreign/unsafe layout entries fail closed and remain preserved.
The layout can be absent for an empty catalog; listing must not create it.

NativeCaptures owns a complete list request under the existing active-store owner and
one shared five-second / 1,000,000-work budget. Default pages inspect at most four stored
candidates. A fixed one-candidate page is also supported for an explicit smaller-page
fallback; there are no client-supplied work/time limits. Do not call public history once
per record with fresh budgets, recursively acquire the owner, or scan beyond the page
to fill a quota of readable records. Keep one decoded record at a time and retain only
bounded summaries plus the minimal final-authorization material for admitted items.

Order by stable record ID, not file mtime or invented save time. A generation digest
binds the catalog UUID, complete ordered ID vector, policy/source versions and published
index. Initial requests select the current generation. Later requests pin that digest
and an offset. Final validation rechecks both source epoch and the owned ID vector;
capture, purge or authority changes cannot produce a mixed-generation page. An exact
duplicate save leaves the ID vector unchanged. No persistent cursor/index/cache is added.

## Authorization and summary content

For every candidate inspected, read/validate the actual native receipt, authorize its
complete dependency vector, and revalidate every original exactly as history does.
Do not derive paths, read code facts/snapshots or open source Git. Only then construct
a summary from its saved graph: receipt ID, recorded build ID, selected root, flow titles,
original count, complete source names/revisions, stale scope and current applicability
explicitly `not-checked`. No original text or raw receipt body is returned by listing.
Opening an item still reauthorizes history through the existing API.

A policy-fenced candidate (`CatalogError` code `POLICY_CHANGED`) contributes only to an
unavailable count. Other source-scope refusals abort the page; do not broadly catch
CatalogError/NativeReceiptError. Missing or
corrupt originals, unexpected storage faults and malformed/foreign receipts fail the
whole page without exposing partial summaries. A source/epoch change during the request
aborts the complete operation, rather than being counted as an initially fenced record.
Final authority checks must cover every returned item.

The authenticated local catalog owner may see total retained count and unavailable count,
but fenced receipt IDs, labels, paths, source names and revisions are not returned. A page
with zero readable items can still have a next page. Do not label it an empty catalog when
retained records exist. Source revocation continues to purge dependent records; listing
does not delete, repair or silently omit structural failures.

## HTTP contract

Add protected read-only `GET /api/path-captures` alongside the existing POST. It accepts
only optional `pageSize=4|1` (default 4), and an optional paired `generationId=<64 lowercase
hex>` / `offset=<canonical integer>`. Offset is a multiple of page size in 0–63 and must
exist in the pinned generation; offset zero is valid for an empty catalog. Reject unknown,
repeated, malformed and oversized query input and all GET body framing before work.
Retain host/origin/session, no-store and request cancellation rules.

Return `schemaVersion: loredock-path-captures/1`, the generation ID, page size/offset,
scanned count, total stored count, unavailable count, authorized summary items and nullable
previous/next offsets. Actual bounded operation metrics may accompany the API result but
are not required user inputs or primary UI content. Bound the full encoded response to
64 KiB. No partial page is returned on deadline/work/response overflow. A generation
conflict is a bounded 409 that asks for explicit refresh. Invalid page/input is 400;
known busy/cancel/resource outcomes retain bounded conflicts; private faults stay generic.

Four individually valid receipts can exceed one combined operation budget. On a size,
work or time refusal for a four-candidate page, the UI may offer **Show one saved path**,
which explicitly retries the same offset with page size one. It must not retry silently
or raise a limit. Subsequent navigation stays at size one until an explicit refresh
starts over. This is an occasional recovery action, not an additional setup field.

## Browser workflow

Add a collapsed **Browse saved paths** section to current browsing. Opening it requests
one bounded page; closing it aborts pending work and clears its displayed summaries.
Use existing saved-path links for each readable item. Show recorded flow titles, source
scope and stale status, with an explicit explanation that order is not recency and current
applicability is unchecked. No raw receipt-ID input, directory picker, model or localStorage
index. Direct bookmarked history pages issue no list request.

Use explicit previous/next and **Refresh saved paths** actions. Changing page clears the
prior page and fences late responses. Source/policy/published-index changes or loss of
project refresh authority clear summaries; access recovery must not silently restore them.
A changed list generation asks for refresh instead of mixing results. New saves made
elsewhere appear after refresh; displayed counts describe the loaded list generation.
Empty, unavailable-only, invalidated, busy, capacity and private-fault states must be
distinct without suggesting that a deletion/repair action already exists.

## Prospective validation

Use fresh owned ordinary fixtures, never exhausted qualification families. Before changing
native modules, retain the accepted source/runtime identities. Add enumeration and actual
service/HTTP tests for exact page summaries, zero write/derivation counters, every-original
revalidation, one shared budget, mixed policy authority, unsafe storage, final source/ID
fences, cancellation, ownership and shutdown. Preserve existing capture/history behavior
and old saved links, including history after inventory eviction and restart.

Use actual compiled services to fill a fresh bounded catalog to 64 records through explicit
capture of default/selected views across new small inventories. Review the expected record
count and page traversal before running it. Check every page against its actual native
receipts, all 64 IDs exactly once, no retained full-body cache, bounded scalar observations
and clean shutdown/reopen. Exercise smaller-page recovery using an internally reduced
shared budget; no HTTP budget override is introduced. Keep the first run's raw observations
and failures. This is functional/capacity validation, not a replay or relabel of Task 114's
capture-resource family, and cannot establish a new general scale/semantic/L5 claim.

Actual Chrome must cover readable and unavailable-only pages, explicit refresh/navigation,
late responses, authority loss, direct-link opening and smaller-page fallback. Retain
desktop/mobile evidence and run strict checks plus both exact-head CI events. Native
module additions change the runtime closure; record that fact rather than claiming the
old byte-identical qualification transfers. Do not alter receipt identity, parser
fingerprint, storage caps, purge/backup rules or fixed operation limits.
