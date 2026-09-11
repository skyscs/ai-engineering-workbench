# Export an investigation report

Choose a **Report version**, then **Export Markdown**. The browser downloads that
version as `investigation-<report-id>-v<version>.md`. Exporting starts no AI run,
changes no stored report and works for active, superseded or stale versions.

The document includes the original task description, report/root-cause/run IDs,
publication time, lifecycle and freshness at export time, prior report and triggering
intervention IDs, challenge text, original constraints, requested model/effort,
recorded CLI version, prompt/schema versions, repository pins, selected artifact
hashes/ranges, reasoning, timeline, unresolved questions and evidence locators.

Each locator is checked through the existing pinned evidence reader during export.
A missing source or busy repository is marked **Unavailable or busy**. The original
locator remains in the document; no new source content or fabricated replacement
is substituted. Availability is an observation at export time, not a guarantee that
another machine can reopen the same source. Evidence validation does not prove the
explanation's causal claims.

The export deliberately omits source bodies, executable/configuration directories,
configuration fingerprints and raw runtime diagnostics. Known credential patterns,
URLs and absolute paths in prose are redacted. All human/model prose is escaped as
text so raw HTML, Markdown links and images are inert. This is a portable report,
not a database backup or a complete secret scanner: review it before sharing.
Repository paths in locators remain relative; repositories/artifacts are identified
by IDs, commit hashes and content hashes without machine-specific checkout paths.

## API

`GET /api/workspaces/:workspaceId/tasks/:taskId/investigations/:reportId/export`
requires the local session and returns `text/markdown; charset=utf-8` with attachment,
`no-store`, `nosniff` and restrictive CSP headers. The report must belong to the
specified task/workspace. Unknown reports return 404, expired sessions return 401,
and forbidden cross-origin requests return 403. The endpoint accepts no output path
or source path from the caller.
