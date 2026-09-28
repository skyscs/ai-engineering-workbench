# LoreDock catalog browser acceptance

Verified on 2026-09-28 using the production build, headless Chrome, a temporary
LoreDock data directory and the synthetic three-repository corpus. The Workbench
daemon, databases and real repositories were not used.

[Recorded results](browser-result.json), [desktop view](desktop.png) and
[390px mobile view](mobile.png) cover source registration, 18 indexed files and nine
exclusions, three topic matches, an opened exact citation, keyboard focus, source
revocation, policy fencing, a new index and persistence across daemon restart.
Source checkouts stayed unchanged and zero model requests were made.

Reproduce with `node scripts/loredock-smoke.mjs` after `pnpm build`, with Chrome
installed and port 4244 free. The script retains a result directory printed at the
end and cleans up its own processes, input repositories and temporary database.
Set `LOREDOCK_SMOKE_OUTPUT` to an explicit directory to select the result location.

The backend/HTTP suite separately tests checkpoint recovery, pause/cancel and late
publication, request conflicts, source failures, unsupported/malformed inputs,
filters/hooks, dirty originals, source ranges/hashes, budgets, ownership and local
session/CSRF protection. Browser success does not certify semantic understanding or
the still-unqualified future AI runtime. See the [user guide](../../loredock/USER_GUIDE.md).
