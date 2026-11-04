# Saved-path browser evidence

Task 117 connects explicit pinned saves to bookmarkable local links and recorded history.
See the [workflow/review](../../loredock/SAVED_PATH_BROWSER.md) and [manifest](validation.json).
This is browser integration evidence on owned synthetic inputs, not resource qualification.

Parent PR #120 head `14fb176fc2d1151ba9a8687f67354b419d13424b` passed push
41906547182 and pull-request 41906567704 CI and merged with an identical tree at `7e7cd19`.
The interaction contract preceded implementation at `7e5e712`; UI implementation is
`8f5fd02`. Reviewed browser head: `ba6e6dc`. Node 22.23.2, pnpm 10.15.0 and Chrome
152.0.7977.82. All 38 qualified native core modules and six public daemon source/emitted
modules remain byte-identical.

| Retained command | Exit | Result |
| --- | ---: | --- |
| Frozen-lockfile install | 0 | Isolated worktree dependencies installed. |
| Full strict typecheck | 0 | All workspace types passed. |
| Workspace build | 0 | Actual application/browser output compiled. |
| First saved-browser smoke, `e1c9162` | 1 | Six scenarios completed; a whole-navigation counter assertion included two previous-page inventory-poll snapshots. |
| Corrected saved-browser smoke, `6ea0a50` | 0 | Fifteen scenarios, per-history counters plus a separately settled saved-page window. |
| Evicted-selection check, `7b0de04` | 0 | Sixteen scenarios and 25 native HTTP outcomes; stale pinned saves refuse substitution. |
| Reviewed saved-browser smoke, `ba6e6dc` | 0 | The same sixteen scenarios, now recording and requiring a zero browser exit without a signal or forced termination. |
| Existing live-browser regression | 0 | Seventeen scenarios and thirty path requests, including keyboard opening, pagination, focus, delayed originals and authority/inventory boundaries. |
| Full `pnpm check`, `7b0de04` | 0 | 842 tests (17 + 18 + 43 + 635 + 57 + 72), strict types and builds. |

Nine gzip command logs and 116 raw artifacts are retained. The latter include sixteen
original PNG screenshots across the attempts, raw native HTTP response bytes, stored
receipt copies, Chrome logs, reports and the initial failure view. The final workflow's
four screenshots and the live regression's two screenshots cover desktop/mobile layouts;
visual inspection also checked earlier equivalent application screenshots.

The [reviewed report](browser-reviewed/result.json.gz) records before/after source/store/
fact/path/snapshot counters and original-read deltas for native HTTP operations. Every
successful history read revalidates every saved original with zero other derivation or
writes and zero publication locks. Opening an original uses the saved response in memory.
The transport never forwards upstream or listens on the user's port 4244. Sessions/CSRF
tokens are not logged; model/answer requests remain zero.

The full strict check precedes only the opt-in runner's shutdown-reporting correction;
application sources are unchanged. That correction was executed by the reviewed smoke.
The manifest binds reviewed source/emitted browser assets, unchanged daemon/core modules,
raw lengths and SHA-256 hashes of original and archived artifacts. No previous failure
or resource result was relabeled or overwritten.

Ordinary fixture teardown removed its source repositories and temporary catalog directories.
Raw responses and receipt copies here are not complete stopped-directory backups. The
owned browser profiles remain outside the repository and are not part of the archive.
No corporate sources, user demo, exhausted qualification family or model run was used.
Agent verification and self-review do not constitute independent product or L5 acceptance.
