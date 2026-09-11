# Task 010 browser acceptance evidence

`browser-result.json` records the opt-in intervention scenario on a clean production
build with Node 22.23.2 and Linux Chrome, verified on 2026-09-11. It includes the
existing workspace/task/investigation path and the challenge/constraint revision
loop, restart persistence and narrow layout.

All nine runtime attempts use a synthetic executable through the production
adapter. No model request or account-identity verification is represented here.
Local configuration paths, browser profiles, database files and raw diagnostics
are intentionally excluded. Reproduce with the commands in
[the intervention guide](../../interventions.md#verification).
