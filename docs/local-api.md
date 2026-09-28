# Local HTTP API session and transport

For browser usage, follow the [user guide](user-guide.md). This reference is for
clients integrating with the existing local daemon APIs. Feature guides linked
from the [documentation index](../README.md#documentation-and-development) contain
request bodies and endpoint-specific behavior.

## Origin and session

Production binds to `127.0.0.1:4242` and accepts Host `127.0.0.1:4242` and Origin
`http://127.0.0.1:4242`. Development additionally permits `127.0.0.1:5173` and its
exact HTTP Origin for the Vite proxy. There is no wildcard CORS, remote-user login,
network-facing or multi-user mode.

The UI bootstraps a session using `POST /api/session` with the permitted `Origin`
and `X-AEW-Client: web`. The response sets an HttpOnly, SameSite=Strict cookie
scoped to `/api` and returns a `csrfToken`. Keep the session cookie on sensitive
API reads. Mutations additionally require the exact Origin and that session's
`X-AEW-CSRF` token. `DELETE /api/session` uses the same protection and invalidates
the session. Do not put cookies or tokens in URLs, logs or shared examples.

Sessions expire after eight hours or a daemon restart and are bounded to 64 per
daemon. The public `GET /api/health` is minimal and still requires the permitted
Host. These controls defend the browser boundary; they do not authenticate another
local process running as the same user.

A user-initiated top-level GET navigation to non-API UI routes without an Origin
header may arrive from another site. That exception serves the UI shell only;
it does not relax API/session/CSRF or frame protection.

## Responses and storage status

Unknown API routes return JSON errors rather than the SPA page. Sensitive API
responses use `Cache-Control: no-store`. See each feature guide for its JSON,
streaming upload, SSE or attachment contract. JSON mutations normally require
`Content-Type: application/json`; upload and download routes have their own limits.

`GET /api/storage` requires a session and reports schema/SQLite versions,
foreign-key status and journal mode without exposing storage paths. Startup refuses
newer or inconsistent migration histories. The expected experimental `node:sqlite`
warning on the pinned Node release is not a storage failure.

SSE events and terminal state are retained by the daemon; a browser reconnect does
not create or cancel a run. See [runtime events and cancellation](codex-runtime.md#protected-api).
For filesystem location, ownership and backup, use the
[Linux operations guide](linux-demo.md#data-backup-and-upgrades).

## Investigation drafts and launches

The primary page uses the same session, exact-origin and CSRF checks:

- `GET /api/drafts` returns the latest 200 drafts and their byte budget.
- `POST /api/drafts` takes a client-generated UUID `id`; replay returns that draft.
- `GET /api/drafts/:id` includes saved inputs, file metadata, task binding and latest launch.
- `PUT /api/drafts/:id` takes `{ revision, input }`. Stale revisions return conflict.
- `PUT /api/drafts/:id/files/:fileId` streams bounded UTF-8 bytes with a URI-encoded
  filename in `X-AEW-Filename`. Replaying the same UUID and content is idempotent.
  `PATCH` with `{ included }` selects full text; `DELETE` removes a draft file.
- `POST /api/drafts/:id/launch` takes `{ requestId, revision }`. It returns a durable
  operation (202); replaying its UUID returns the original attempt without invocation.
  A deliberately new attempt needs a new UUID. Poll the draft for actual phase/outcome.
- `POST /api/drafts/:id/cancel` takes the launch `requestId`. Cancellation is explicit
  and idempotent; completion can win a race with cancellation.
- `POST /api/drafts/from-task` adopts an existing `{ workspaceId, taskId }` and preserves
  its advanced artifact selections. `POST /api/drafts/:id/copy` with a new UUID `id`
  copies composer input/files into an editable draft; legacy artifact ranges are not copied.
- `DELETE /api/drafts/:id` discards only an editable, unmaterialized draft. Started
  investigations remain in history. Active/materialized inputs cannot be edited.
- `GET /api/drafts/setup-options` returns existing canonical directory candidates,
  without opening authentication files or making a connection claim.

Schema 11 stores bounded draft blobs and launch operations. Stage runs, immutable
reports and full task artifact storage retain their existing contracts. Local setup
checks happen before a new task locks its project; model invocation remains explicit.
