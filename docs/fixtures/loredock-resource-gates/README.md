# Retained resource-gate feasibility evidence

[ADR 0067](../../decisions/0067-loredock-resource-gate-feasibility.md) compares existing
observations only. No new browser, daemon, model or resource experiment is executed.

- `retained-archives.json` binds the verified archive/inventory hashes for Task 134's
  browser cases, Task 143's standalone browser, Task 141's parser observation and
  Task 147's container browser. Existing archives remain in their original fixture folders.
- `retained-facts.json` records the original browser measurements and daemon assessment;
  it does not rescore failures or infer causal effects between independent lifetimes.
- `sources.json` records primary kernel documentation and the existing Node source audit.
- `logs/` retains both complete accepted Task 147 CI logs for head `6e36976`; each passes
  1,169 tests, ten typechecks and ten final builds without failures or cancellations.
- `records.json` binds every local artifact/log hash and the accepted merge `e673d43`.

The v1 RSS, heap, timing, completeness, storage and operation requirements remain unchanged.
New accounting proposals require their own explicit review and prospective contract.
No host browser profile, machine policy or corporate code is read or modified.
