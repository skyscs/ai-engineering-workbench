# Saved paths in the browser

Status: prospective Task 117 interaction contract, committed before implementation.
Task 116 exact-head acceptance is required before the implementation begins.

## Save the view already on screen

The expanded connected-path view offers **Save paths** only when it displays a native
path graph. The request pins that displayed build, inventory, generation and optional
selected root. It never substitutes a newer default or saves a root page without paths.
The pending operation has a cancel action and owns an AbortController. There is no
automatic save/retry. A confirmed response says **Paths saved.** or **These paths were
already saved.**, followed by **Open saved paths**. A failed save keeps its bounded error
separate from an earlier confirmed save; cancellation cannot promise that publication
never occurred, and repeating the same selection reuses any completed record.

The confirmation belongs to that displayed selection. Path navigation, collapse,
inventory replacement and the existing project/scope boundary clear it, abort pending
work and discard late responses even if a transport ignores cancellation. Before leaving,
the user can open or bookmark the ordinary local link. No receipt-ID field, new setting,
client-side persistent history index or technical metrics are exposed as required inputs.

## Open a recorded view

The link is `/?savedPath=<issued lowercase 64-character receipt ID>`. It contains no
source path, content, cookie or CSRF token and grants no authority by itself. The usual
local session and authenticated history API apply. Duplicate/invalid savedPath parameters
show an invalid-link message without a history request. Browser reload, direct navigation
and bookmarks resolve the same receipt. The current catalog must still own that receipt.

A saved-path page replaces the current browsing workspace and offers **Return to current
browsing**. It opens history independently of current code-inventory availability; it
must issue no code-path, code-analysis, fact or original API requests to reconstruct the
recorded view. An explicit **Reopen saved paths** action retries the same authorized read.
Failure does not turn a completed save into a failed save, delete the stored receipt or
fall back to a current path.

Show **Saved paths**, recorded index/revisions, static/candidate uncertainty and
**Applicability to current code has not been checked.** separately from the service's
stale-index/scope notice. The exact saved paths retain their connection reasons, topic
witnesses, gaps and original citations. Citations open the saved original passages from
that authorized response, with source/path/revision/line information and keyboard focus.
Complete source scope includes dependencies without displayed nodes. Do not expose root
pagination, analysis controls or new derivation actions in the recorded view.

Project policy, source registry or published-index changes clear the displayed record
and its originals. A failed project-authority refresh also hides them. Explicit reopening
rechecks access once project state is available; late history responses cannot restore
the cleared content. Navigating away aborts the request. The UI rejects an unexpected
history/projection version instead of attempting to relabel it.

The record remains in the catalog after page closure. This first workflow uses saved
links for later discovery; it does not claim a complete saved-path list. Listing,
explicit deletion/repair and any answer/Workbench consumption remain separate tasks.

## Verification plan

Use the actual compiled app/services with owned synthetic sources and an isolated Chrome
transport that never forwards to an existing daemon. Cover default/selected save,
duplicate, exact originals, invalid links, direct-link reload and no history rederivation,
inventory eviction, known errors/capacity, cancellation, delayed save/open responses,
source/policy fences and project-refresh failure. Reuse existing live-browser regression
checks after extracting shared path presentation. Review focus and desktop/mobile layout.
Keep first failures and raw reports/screenshots, run strict checks, and require both CI
events on the exact final head. Preserve all qualified core module bytes and do not rerun
any exhausted resource family or model evaluation.
