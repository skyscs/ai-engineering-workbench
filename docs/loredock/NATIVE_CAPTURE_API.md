# Native saved-path HTTP contract

Status: prospective Task 116 contract; these routes are not implemented yet.

This local API slice exposes the existing authorized NativeCaptures service. It adds
neither a receipt format nor another budget/storage owner. The public path GET routes
remain read-only. Browser save/open navigation, listing and explicit deletion follow
separately; no raw receipt-ID input form is part of this task.

| Method and route | Input | Successful output |
| --- | --- | --- |
| `POST /api/path-captures` | Empty body. Query has required `buildId`, optional paired `inventoryId`/`generationId`, and optional `rootId` with that pair. | Actual native `captured` result: `receiptId`, `created`, `metrics`. HTTP 201 for a new record, 200 for an exact duplicate. |
| `GET /api/path-captures/:receiptId` | Lowercase 64-character hexadecimal receipt ID. No query parameters or body. | Actual native `recorded` result: `receiptId`, `projection`, `originals`, full `dependencies`, `stale`, `currentApplicability: not-checked`, and `metrics`. HTTP 200. |

The POST reuses the existing strict path query parser, including duplicate/unknown key,
paired generation, page/root and size validation. Keeping the flat selection in the
query avoids a second JSON decoder and preserves the current selection without a
translation. The body must be empty or whitespace; JSON objects, including `{}`, are
rejected. Neither route accepts offsets, filesystem paths, work limits, fingerprints,
catalog overrides or arbitrary output locations. Tokens stay in existing headers/cookies.

Existing exact loopback Host/Origin, session, 16 KiB body and no-store rules apply.
POST additionally requires the existing Origin/CSRF proof. Invalid input must fail
before source/path/receipt work. Requests propagate actual abort signals. Normal startup
injects one NativeCaptures instance using the same CodePathsV2 owner, and shutdown stops
capture/history before paths, analysis and catalog storage.

Public types are derived from the actual service results. Capture publishes the native
content-addressed receipt with the complete shared work/source guard. Exact duplicates
remain available even at storage capacity. History revalidates every saved original
and every source dependency, including undisplayed sources; it does not derive paths or
read current code facts. `stale` refers to recorded index/scope, while current runtime
applicability remains unchecked. Source authorization can deny an otherwise intact file.

| Known native outcome | HTTP status | Public meaning |
| --- | ---: | --- |
| Invalid selection or receipt ID | 400 | Choose a valid index/paired generation or issued receipt ID. |
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
