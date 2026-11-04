# Task 117 — Save and reopen the selected connected path in the browser

Status: scoped, 2026-11-04. Begin implementation after Task 116 exact-head acceptance.

Add the smallest usable browser workflow over the existing protected native capture and
history API. A user viewing a connected path can explicitly save that exact pinned
selection and open its recorded content from the returned confirmation. No raw receipt-ID
input, new configuration, model call, background save or automatic retry is needed.
The confirmation must distinguish a new save from an already saved exact selection.

Give each confirmed save an ordinary local link containing only the issued receipt ID.
Opening that link, reloading it and using a bookmark must reopen the recorded path through
the authenticated history API, independently of current code-inventory availability.
Keep it reachable from the confirmation and provide an explicit return to current browsing.
Define URL/navigation and history-view behavior before implementation. Do not put source
paths, content or session/CSRF tokens in the URL, invent a persistent browser-side index,
or claim a complete receipt list. Discovering all records without a saved link requires
an authorized listing service and remains a separate follow-up.

Render history as a clearly recorded path, with original source names/revisions, exact
saved original passages, complete source scope, current applicability explicitly unchecked,
and stale index/scope state separated from current authorization. Reuse existing presentation
where its semantics fit; never reconstruct history through current path/fact endpoints or
silently replace it with newer content. Do not let recorded paths inherit current analysis
controls, root pagination or other actions that imply rederivation of the saved record.

Scope/cancellation rules apply to save, open and displayed originals. Navigating away,
source revocation, policy/index changes and newer requests must fence stale responses and
clear unauthorized content. Saving a pinned view after its inventory is unavailable must
show an explicit outcome, not silently save the latest default. Known busy/capacity/limits
and unavailable errors should explain the next supported action without exposing technical
inputs or claiming deletion/repair exists. Failed operations leave the existing saved file
unchanged. A confirmed save that cannot immediately reopen must remain visibly distinct
from a failed save.

Test actual compiled HTTP/browser behavior on fresh owned synthetic sources: default and
selected save, duplicate, open saved originals, reanalysis/eviction, scope fences, delayed
save/open/original responses, direct-link reload/bookmark, cancellation/navigation,
busy/error/retry and capacity.
Review keyboard focus and desktop/mobile layout. Keep first failure logs/raw artifacts,
strict checks, both exact-head CI events and self-review before merge. Preserve the
qualified native producer/codec/storage/authority/schema/fingerprint/limits; do not rerun
exhausted resource families. Listing, deletion, repair, semantic context, private pilot,
L5 and Workbench remain separate. Record any next task before implementation.
