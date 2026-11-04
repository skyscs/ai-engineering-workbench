# Task 118 — Discover saved paths without retaining a bookmark

Status: implemented and locally verified, 2026-11-04; exact-head CI pending.

The [prospective discovery contract](../docs/loredock/SAVED_PATH_DISCOVERY.md) fixes owned
enumeration, four-candidate pages with explicit one-item fallback, generation/source
fences, authorized summaries, HTTP inputs and browser behavior before implementation.

Add the smallest authorized saved-path list so a user can find existing records after
closing a tab without keeping individual links. Reuse Task 117's recorded view and
links. No new user configuration, filesystem picker, raw ID field, model call or
client-side persistent index. Keep explicit deletion/repair and retention-policy changes
outside this task; existing files, capacity and full-directory backup remain intact.

Before implementation, commit the exact storage enumeration, page/cursor, authorization,
response and UI contract. Enumeration belongs to catalog-owned native storage; the HTTP
or browser layer must not scan arbitrary directories, bypass the storage owner, or infer
authorization from filenames. Bound both candidates inspected and results returned per
request, including pages containing only fenced records. Do not scan all history without
one complete operation deadline/work budget or reset a separate budget for each record.
Keep unknown/corrupt/foreign/closed storage fail-closed and preserve affected bytes.

Summary labels, source names, recorded revisions and selected roots require native
integrity and current authorization before display. Define how policy-fenced and purged
records affect pages without leaking retained source-derived content or silently claiming
an empty catalog. Define stable pagination, concurrent capture/purge invalidation and
explicit refresh/retry. Opening an item must still reauthorize the complete history;
listing cannot grant future access or imply current applicability.

Use one explicit request owner with cancellation and shutdown, shared fixed resource
bounds, no fact/path rederivation and no catalog/source/Git writes. A bounded summary
must not retain full receipt bodies between requests or accumulate an unbounded browser
cache. Do not change receipt identity/format, parser fingerprint, storage capacity or
source-purge semantics to make listing convenient. A changed native runtime module must
be acknowledged; define proportionate functional/resource validation prospectively for
the new composition instead of claiming old byte-identical qualification still applies.

Test fresh owned catalogs with empty, mixed-authority, multiple-page and full-capacity
history; duplicate/new capture, policy changes, undisplayed-source revocation, restart,
corrupt storage, interrupted requests, concurrent ownership and delayed UI responses.
Verify every displayed summary against the actual saved native record and source authority,
including records whose code inventory was evicted. Review keyboard navigation, layout,
clear empty/fenced/unavailable states and direct-link compatibility. Retain first failures,
actual compiled/browser results, strict checks and both exact-head CI outcomes before
merge. Do not rerun exhausted resource families or introduce corporate/model work.

Implemented with owned enumeration, generation-pinned four/one-candidate pages and
the collapsed browser workflow. The actual compiled full-capacity check passes across
64 records and restart. Fourteen actual Chrome scenarios pass, including explicit
smaller-page recovery and unavailable-only pages; initial harness failures are retained.
Existing emitted native members remain unchanged; the runtime closure intentionally
grows from 38 to 39 modules. All 862 strict tests/builds pass. First failures, raw
responses and screenshots are [retained](../docs/fixtures/loredock-saved-path-discovery/README.md).
Next, after exact-head acceptance:
[Task 119](119-loredock-native-question-context-contract.md) returns to question context
with a prospective integration/evaluation design. Deletion/repair remains separate.
