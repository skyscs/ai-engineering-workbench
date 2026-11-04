# Native saved-path HTTP contract

Implemented by Task 116. The route/input/error contract was committed before implementation.

This local API slice exposes the existing authorized NativeCaptures service. It adds
neither a receipt format nor another budget/storage owner. The public path GET routes
remain read-only. Task 117 adds the separate [browser save/open workflow](SAVED_PATH_BROWSER.md)
with ordinary local links. Task 118 adds [bounded discovery](SAVED_PATH_DISCOVERY.md);
explicit deletion remains separate. No raw receipt-ID
input form is needed.

| Method and route | Input | Successful output |
| --- | --- | --- |
| `POST /api/path-captures` | Empty body. Query has required `buildId`, optional paired `inventoryId`/`generationId`, and optional `rootId` with that pair. | Actual native `captured` result: `receiptId`, `created`, `metrics`. HTTP 201 for a new record, 200 for an exact duplicate. |
| `GET /api/path-captures/:receiptId` | Lowercase 64-character hexadecimal receipt ID. No query parameters or body. | Actual native `recorded` result: `receiptId`, `projection`, `originals`, full `dependencies`, `stale`, `currentApplicability: not-checked`, and `metrics`. HTTP 200. |
| `GET /api/path-captures` | Optional `pageSize=4\|1` and paired `generationId`/`offset`; no body. | `loredock-path-captures/1` with bounded authorized summaries, total/unavailable counts, generation and previous/next offsets. HTTP 200; at most 64 KiB. |

The POST reuses the existing strict path query parser, including duplicate/unknown key,
paired generation, page/root and size validation. Keeping the flat selection in the
query avoids a second JSON decoder and preserves the current selection without a
translation. The body must be empty or whitespace; JSON objects, including `{}`, are
rejected. The encoded selection is bounded to 1,024 bytes by the shared parser; native
capture additionally requires canonical v4 UUIDs. Capture/history do not accept offsets;
only listing accepts bounded page offsets. No route accepts filesystem paths, work limits, fingerprints,
catalog overrides or arbitrary output locations. Tokens stay in existing headers/cookies.

Existing exact loopback Host/Origin, session, 16 KiB body and no-store rules apply.
POST additionally requires the existing Origin/CSRF proof. Early API rejections, including
Host/Origin and oversized bodies, also receive `Cache-Control: no-store`. The Node Fetch
adapter omits GET bodies, so history explicitly rejects nonzero Content-Length and any
Transfer-Encoding before service work. Invalid input must fail
before source/path/receipt work. Requests propagate actual abort signals. Normal startup
injects one NativeCaptures instance using the same CodePathsV2 owner, and shutdown stops
capture/history before paths, analysis and catalog storage.

Public types are derived from the actual service results. Capture publishes the native
content-addressed receipt with the complete shared work/source guard. Exact duplicates
remain available even at storage capacity. History revalidates every saved original
and every source dependency, including undisplayed sources; it does not derive paths or
read current code facts. `stale` refers to recorded index/scope, while current runtime
applicability remains unchecked. Source authorization can deny an otherwise intact file.

The projection JSON, originals and dependency vector are the saved content. History
`metrics` describe this read: elapsed time varies, and work includes validation of the
current receipt directory. Saving other receipts can change that work count without
changing the recorded content. History performs zero path/fact/snapshot derivation and
takes no publication lock. Do not compare whole response bytes as an immutable receipt,
or treat successful authorization as a new correctness assessment of the saved path.

| Known native outcome | HTTP status | Public meaning |
| --- | ---: | --- |
| Invalid selection or receipt ID | 400 | Choose a valid index/paired generation or issued receipt ID. |
| `INVALID_CAPTURE_LIST` | 400 | Choose a supported saved-path page. |
| `CAPTURE_LIST_CHANGED` | 409 | Refresh the list after catalog/authority changes. |
| `CAPTURE_LIST_BYTES_LIMIT` | 409 | Explicitly try one saved path at a time. |
| `RECEIPT_NOT_FOUND` | 404 | The saved path is unavailable. |
| `CAPTURE_BUSY`, `RECEIPT_STORAGE_BUSY` | 409 | An owned operation is active; retry explicitly after it completes. |
| `SERVICE_STOPPED` | 409 | Saved-path operations are stopping. |
| `RECEIPT_UNAVAILABLE` | 409 | No compatible path can be saved; inspect Code coverage. |
| `CAPTURE_STORAGE_FULL` | 409 | The fixed receipt capacity is full; existing records are retained. |
| `RECEIPT_FENCED`, `RECEIPT_SCOPE_FENCED` | 409 | Source/scope changed; no partial saved result is returned. |
| `RECEIPT_BYTES_LIMIT`, `RECEIPT_TEXT_LIMIT`, `RECEIPT_SOURCE_LIMIT` | 409 | This selection exceeds the fixed saved-path bounds. |
| `CANCELLED`, `CAPTURE_TIME_LIMIT`, `CAPTURE_WORK_LIMIT` | 409 | The actual shared operation was cancelled or reached its bound. |

Existing CatalogError authorization/generation outcomes keep their domain status and
protected envelope. Unknown native integrity, storage, hook/capability and internal errors
retain the generic 500 response. Known messages are fixed boundary text; no filesystem
location, private exception message, stack or source-derived partial result is exposed.

Keep the complete stopped-directory backup contract: catalog UUID and its owned receipt
files belong together. Source-only backup or compaction is not a native history export.
No deletion, implicit eviction, file transplant, rollback relabel or repair API is added.

## Verification and limits

PR #119 head `2ee112f` passed push 41902894817 and pull-request 41902934334 CI,
then merged with an identical tree at `9427c38`. All 38 qualified native core runtime
modules remain byte-identical. Production changes are confined to the HTTP boundary,
its new input/error/type module and explicit daemon capture ownership/shutdown order.
No receipt schema, source authority, parser fingerprint, resource cap or producer changed.

All **842 full strict tests/builds** pass. Sixty-five focused tests/subtests cover default and injected owners, actual session/CSRF,
malformed/duplicate/oversized input before work, native selected/isolated captures,
duplicates at capacity, complete saved originals and undisplayed source dependencies,
two inventory replacements, restart and stale scope. History revalidates all ten originals
without Git, SQL writes, fact/path/snapshot reads or publication locks; legacy rows and
owned Git working trees remain unchanged. Real TCP checks reject GET bodies and propagate
disconnection to capture and history. Known errors remain bounded; private native faults
return the generic 500 envelope.

The [normal daemon smoke](../../scripts/loredock-public-native-smoke.mjs) passes five
functional checks using three actual compiled daemon processes with model mode off.
HTTP creates an index, follows analysis automatically, saves a native path, reuses a
duplicate and replaces the inventory twice. Restart returns the exact saved content and
current path projection. Policy denies history while preserving bytes; revocation of
the undisplayed dependency purges the file and remains denied after another restart.
All three processes exit zero, release catalog ownership and leave the four owned sources
unchanged. The runner refuses an occupied port before contacting any existing daemon.

The [retained evidence](../fixtures/loredock-native-capture-api/README.md) includes the
first failed focused runs. One failure exposed missing no-store on early API refusals;
others corrected test assumptions about elapsed time, directory-validation work and
original reads performed during fixture preparation. Ordinary fixture cleanup removed
their temporary catalogs; logs remain. The compiled smoke retains its owned catalog,
source repositories and raw responses. No resource family was rerun; no corporate code,
user demo or model request was used. This is API integration evidence, not new scale,
semantic, private-pilot or L5 acceptance.
