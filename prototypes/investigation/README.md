# Investigation interaction prototype

Task 012 implements the first iteration of the
[UX simplification plan](../../docs/ux-simplification-plan.md).

This is a standalone static prototype, separate from the production web app and
daemon. It has no dependencies or build step. It makes no API or model requests,
does not inspect Git or Codex configuration, and does not read selected file
contents. Filenames/sizes and typed input remain in page memory. Reloading clears
the preview, including its setup choices, drafts and sample reports.

## Open locally

From the repository root:

```bash
python3 -m http.server 4243 --bind 127.0.0.1 --directory prototypes/investigation
```

Open <http://127.0.0.1:4243>. Port 4243 keeps the preview separate from the real
application on port 4242. Stop the static server with Ctrl+C.

The source includes a restrictive Content Security Policy (`connect-src 'none'`)
and uses only local assets. It is a disposable interaction prototype, not the
implementation of durable drafts or production launch orchestration.

## Owner walkthrough

Start on the empty page. Without explaining controls first, ask the participant
to investigate a pricing issue, identify the selected setup and included files,
inspect the evidence, and request a revision. The page supplies a sample case.
Then use **Preview controls** to simulate a missing setup or failed analysis and
observe whether the next action is clear. Record points of hesitation in the
task's acceptance record rather than explaining away the difficulty.

The sample report is fixed regardless of entered text. Actual filenames are
shown for interaction testing only. Unsupported/oversized inputs are visibly
excluded; a sample log supplies synthetic evidence. Report revision is predefined,
with submitted feedback retained for demonstrating version history. Markdown
export is a clearly labeled sample, not a real investigation result.

## Developer verification

Use the repository's pinned Node.js 22.23.2 and an installed `google-chrome`:

```bash
node --check prototypes/investigation/app.js
node scripts/prototype-smoke.mjs
```

The browser smoke creates an ephemeral loopback server and a fresh headless Chrome
profile. It verifies explicit setup selection, cancellation, preserved inputs on
setup failure, safe attachment labels, evidence, failed and successful revisions,
version history, export, keyboard dialog behavior and mobile layout. It asserts
zero API calls, external page requests and browser-storage writes. Screenshots and
a JSON result are written to a printed temporary directory. No app database,
normal browser profile or Codex account is used.

## Next gate

Automated behavior checks do not establish usability. The owner walkthrough must
be recorded before moving to the next iteration's production integration. The user has
authorized the overall simplification direction; this gate collects interaction
feedback, not renewed permission to implement it.
