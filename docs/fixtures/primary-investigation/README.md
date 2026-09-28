# Primary investigation workflow acceptance

Recorded on Linux, 2026-09-28, with Node 22.23.2 and headless Chrome against the
production build. The data directory, configuration, repository, uploaded text
and CLI executable were synthetic and isolated. No real model was invoked.

- [Desktop composer](composer.png)
- [390px composer](mobile.png)
- [Browser checks](browser-result.json)
- [Advanced workflow regression](advanced-browser-result.json)

Reproduce after `pnpm build` with a free port 4242 and Chrome installed:

```bash
node scripts/investigation-flow-smoke.mjs
```

The scenario saves a draft and attachment, excludes text, reloads, restores inclusion,
selects an explicit setup, recovers from a failed configuration check, launches via
real daemon/storage/Git services, opens evidence, revises and exports a report,
cancels a subsequent attempt and restarts the daemon. Two successful synthetic
invocations and one cancelled invocation verify version preservation and no automatic
restart. It also copies composer inputs into a new draft and checks mobile overflow.

The screenshot paths are ephemeral fixture directories, not user data or accounts.
These results verify UI behavior and service integration, not real-model output
quality. Historical real-model acceptance remains in the release fixtures.

`AEW_SMOKE_RELEASE=1 node scripts/workspace-smoke.mjs` also passed on `/advanced`,
including nine synthetic attempts, preserved model settings, artifact ranges,
historical versions, cancellation, failures, export and restart.
