# Saved paths in the browser

Implemented by Task 117. The interaction contract was committed at `7e5e712` before
implementation. PR #120 head `14fb176` passed push 41906547182 and pull-request
41906567704 CI, then merged as identical-tree `7e7cd19` before implementation began.

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

The record remains in the catalog after page closure. Task 117 uses saved links for
later discovery; Task 118 adds [bounded saved-path browsing](SAVED_PATH_DISCOVERY.md).
Explicit deletion/repair and any answer/Workbench consumption remain separate tasks.

## Verification

The [actual compiled browser smoke](../../scripts/loredock-saved-path-browser-smoke.mjs)
passes sixteen scenarios with 25 native HTTP outcomes on fresh four-source inputs. It
uses a verified non-forwarding loopback proxy and isolated Chrome profile; it never
contacts the user's demo. Default/selected saves, duplicates at capacity, explicit
busy/cancel/error retry, private-error masking, delayed save/history fences, direct links,
exact originals, reload/eviction, stale scope, failed project refresh and source/policy
authority all pass. Saving an evicted displayed generation explicitly fails without
substituting current defaults. Unexpected versions and invalid/duplicate links do not
open a replacement view. Source Git revisions and working trees remain unchanged.

Every successful history operation records actual counters before/after and revalidates
all saved originals, with zero Git/SQL writes, fact/path/snapshot reads or publication
locks. Opening saved originals uses the already authorized response. The settled saved
page makes no current code-analysis/path/evidence requests. Previous-page polls can finish
during navigation; the first test incorrectly included those in its whole-navigation
counter window. That failure and raw responses remain retained; the corrected test keeps
per-history counters and separately checks the settled page.

All **842 full strict tests/builds** pass. The existing live connected-path browser also passes all seventeen scenarios after the
presentation extraction, including actual keyboard opening, pages, focus, delayed
originals, source boundaries and dynamic inventory lifecycle. Four saved-workflow and two
live-view screenshots were retained; desktop/mobile layouts were visually reviewed.
All 38 qualified native core modules and all six public daemon source/emitted modules
remain identical. Only the browser and its opt-in smoke change executable behavior.

See the [evidence archive](../fixtures/loredock-saved-path-browser/README.md) for raw
responses, screenshots, first failures and hashes. Ordinary fixture cleanup removes its
temporary source/catalog directories; retained files are not claimed as a database
backup. No exhausted family, corporate code, user demo or model call was used. The result
does not establish independent product, semantic, scale or L5 acceptance.

[Task 118](../../tasks/118-loredock-saved-path-discovery.md) addresses
discovery without a bookmark under a bounded authorized listing contract. Deletion,
repair and answer/Workbench consumption remain separate.
