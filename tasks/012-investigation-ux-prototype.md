# Task 012 — Investigation UX prototype

Status: implemented and browser-verified; owner walkthrough pending. Scope: iteration 1 of the accepted
[UX simplification direction](../docs/ux-simplification-plan.md).

## Goal

Make the proposed investigation flow concrete and testable before connecting it
to real accounts, repositories and paid model invocations.

## Scope

- An isolated, responsive, English-language clickable prototype.
- One composer with repository, problem description and supporting files.
- Explicit one-time sample setup selection, remembered during the page session.
- Simulated preparation, investigation, cancellation and recoverable setup failure.
- A clearly labeled sample report, evidence, revision and version history.
- Visible prototype boundaries: no API/CLI calls, uploads or durable storage.
- Browser verification and a short unassisted walkthrough by the project owner.

## Acceptance

The owner can start a sample investigation, identify its selected setup and
included files, recover from the simulated failure, and revise the sample report
without reading instructions. Browser checks cover the same interactions,
cancellation, unsupported attachments, keyboard dialog behavior and narrow layout.

Do not connect the prototype to production services in this task. The owner
walkthrough is a product validation gate, not an additional authorization request.
The next iteration implements durable drafts and daemon-owned launch orchestration
after incorporating that feedback. Existing application data and behavior remain
available throughout this iteration.

## Delivery and verification

The [static prototype](../prototypes/investigation/README.md) includes the composer,
explicit sample setup choice, attachment inclusion labels, progress/cancellation,
two simulated failures, evidence dialogs, report revision/history and Markdown
export. All state stays in page memory; selected file contents remain unread.

`node --check prototypes/investigation/app.js` and
`node scripts/prototype-smoke.mjs` passed on 2026-09-28 with pinned Node 22.23.2
and headless Chrome. The browser checks verified the main action fits a 1440×900
initial viewport and the 390px layout has no horizontal overflow. Evidence and
results are recorded under [UX prototype fixtures](../docs/fixtures/ux-prototype/).
There were zero API/model requests and zero browser-storage writes.

The prototype was served locally on port 4243 for the owner walkthrough. Usability
acceptance and subsequent production integration are not yet claimed.
