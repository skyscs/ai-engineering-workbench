# Challenges and persistent constraints

For step-by-step usage, see the [user guide](user-guide.md#guide-the-next-version).

Use **Human interventions** below a task's investigation report to guide subsequent
runs without losing earlier reasoning.

## Persistent constraints

Enter a rule in **Persistent constraint** and choose **Save constraint**. The rule
applies to future runs of this task, including challenges and ordinary investigations.
Saving makes existing reports stale and does not start AI.

Choose **Deactivate constraint** when a rule is obsolete. Deactivation also makes
existing reports stale without starting AI. Old reports and run snapshots keep the
rules that applied at their creation. Rules cannot be edited or reactivated; add a
replacement after deactivating an incorrect rule.

There are at most 32 active constraints with 32 KiB of UTF-8 text in total. A single
intervention accepts up to 8192 characters, subject to the API's 16 KiB JSON limit.
These are model instructions, not an additional filesystem permission mechanism.
They cannot expand the read-only runtime or change the workspace connection.

## Challenge a report

1. Choose the latest published **Report version** and review its evidence.
2. Select the model profile in **Historical investigation**.
3. Enter the disagreement or correction under **Challenge version …**.
4. Choose **Challenge and run**. This starts a new AI invocation using the current
   selected context, active constraints and the complete targeted report.
5. Review the new version and its **Triggered by this challenge** text.

The model is asked to explain what changed and why. It may retain the earlier
conclusion when the evidence supports it. An insufficient-evidence conclusion is
also valid. Evidence locators must pass the same checks as an initial investigation.

A new version replaces the active report only after successful publication. Failure
or cancellation preserves the previous pair. A failed attempt remains in
**Intervention history**, with **Inspect attempt** for diagnostics and the recorded
model/constraint snapshot. A retry is an explicit new challenge and StageRun.

A report can be both active and stale after a context change. Review the updated
context before challenging it. A superseded version is viewable but cannot be the
target of a new challenge. Input changes are blocked while a task has an active run;
cancel first or wait for it to finish. Switching report/context resets draft forms.

If a submission appears to fail after a connection problem, refresh the task and
history before trying again. The server rejects repeated submission IDs and obsolete
context, so a lost response cannot silently spend another run. ASK, ADD_CONTEXT and
OVERRIDE are reserved actions and are not yet available.

## Protected API

Paths are relative to `/api/workspaces/:workspaceId/tasks/:taskId`. Every route
requires the local session. POST also requires exact Origin, CSRF and JSON.

| Method and path | Behavior |
| --- | --- |
| `GET /interventions` | Latest 100 interventions with linked run/result status, plus stored constraints. |
| `POST /interventions` | Save a constraint (201) or create a challenge and StageRun (202); returns `{ intervention, run }`, with `run: null` for constraints. |
| `POST /constraints/:constraintId/deactivate` | Deactivate a rule and record its intervention (201); no AI run. |

Constraint request:

```json
{
  "type": "constraint",
  "text": "Inspect both repository histories before identifying a cause.",
  "requestId": "c0b64009-6364-4b9a-908e-98518b83e80b",
  "expectedContextRevision": 4
}
```

Challenge request:

```json
{
  "type": "challenge",
  "text": "The cited change predates the regression. Reconsider the configuration history.",
  "targetReportId": "665112de-43fc-4726-a47a-6f9339050059",
  "modelProfileId": null,
  "requestId": "f9d9dc91-33b1-4aad-8a56-0f181a4deab9",
  "expectedContextRevision": 5
}
```

Generate a new UUID for each deliberate submission. Reuse it when the outcome of
the same request is uncertain; a duplicate returns 409 and should prompt a history
refresh. Deactivation accepts only `requestId` and `expectedContextRevision`.
Constraint interventions record the observed revision before incrementing it;
reload the task for its new revision. Superseded targets, stale editors and active
runs return 409. Unsupported reserved action types return 400 with
`UNSUPPORTED_ACTION`. Cancellation and SSE use the existing runtime-run endpoints.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm check
AEW_SMOKE_INTERVENTIONS=1 node scripts/workspace-smoke.mjs
```

The browser scenario requires Linux, Chrome and a free port 4242. It uses isolated
application/browser data and a synthetic CLI through the production adapter. It
checks constraint saving without AI, failed/cancelled challenges, a successful
revision, exact previous-report snapshots, carried constraints, deactivation,
earlier versions and restart persistence. No real model request is made.

See [ADR 0014](decisions/0014-human-interventions-and-invalidation.md),
[the investigation guide](investigation.md) and [development status](development-status.md).
