# ADR 0015 — Portable report export and v0.1 acceptance

## Status

Accepted for Task 011 implementation, 2026-09-11.

## Decision

Add a protected, read-only Markdown attachment endpoint for an explicit report ID.
The daemon projects allowlisted provenance and snapshot fields into Markdown. It
never serializes the complete run, external configuration, diagnostics or evidence
source bodies. Human/model text is escaped; known credential patterns, URLs and
absolute paths are redacted. This protects the export structure without claiming
complete secret detection or changing immutable source reports.

Export includes original task/constraint/challenge context, requested model/effort,
CLI/prompt/schema versions, previous report/intervention IDs, pinned repository and
artifact references, explanation and unresolved questions. Lifecycle/freshness and
source availability describe export time. Check each locator through the existing
owned evidence reader; unavailable/busy sources retain their locator with an honest
status. No model invocation, persistent export table or new migration is needed.

The user downloads the selected version in the browser. Responses use attachment,
no-store, nosniff and restrictive CSP headers. Authentication and ownership checks
are identical to report reads. There is no arbitrary output/source path API.

Fix AEW-001 by allowing a user-initiated, top-level GET navigation to non-API UI
routes only when no Origin header is present. Host checks always apply; cross-site
API access, frames, untrusted Origins and mutations remain forbidden. This exception
serves the UI shell and does not authorize its later privileged requests.

Release acceptance uses three generated histories and a separate opt-in real CLI
runner with explicit configuration selection. Keep the known-defect behavioral
checks and fake browser runs in deterministic verification. Review real reasoning
against expected history/evidence; do not equate a schema-valid report with a
correct conclusion. Preserve every local attempt and publish only reviewed evidence.

Ship v0.1.0 as private workspace packages and a documented Linux source build.
No registry publication, release tag, installer, new service manager or support
claim for untested operating systems is introduced by the task branch.
