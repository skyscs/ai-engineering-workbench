# Runtime feasibility checkpoint

## Status

Task 000 is incomplete. Work was paused at the user's request after the first real
investigation reached the account usage limit. This checkpoint preserves evidence
and resumption instructions; it does not certify a production runtime adapter.

Selected by the user: existing default Codex CLI configuration, model
`gpt-5.6-terra`, reasoning effort `medium`. Authentication files were not read or
copied. Keep this selection on resumption; do not silently choose another account.

## Observations

- Installed CLI: 0.153.4. Local help exposes `codex sandbox [COMMAND]...`;
  `codex sandbox linux` incorrectly attempts to execute a program named linux.
- The direct sandbox probe read both repository source files and the incident
  artifact. Attempts to create a file in each directory failed with EROFS.
- The real exec invocation used read-only sandbox, approval policy never, JSONL,
  JSON Schema output, and the selected model/effort.
- Per-invocation settings disabled apps, plugins, hooks, browser/computer/image
  tools, multi-agent execution and web search. Provider/auth routing was retained.
  No explicit MCP server table names were found in the default user config check;
  that check alone does not establish the full effective tool configuration.
- One shell command listed both source files, read both Git histories and read
  the incident log. It completed with exit code 0.
- The CLI then emitted error and turn.failed events reporting an account usage
  limit, and exited with code 1. No successful final root-cause report was produced.
- Source hashes, HEAD revisions and Git statuses were unchanged. The runner
  reported no remaining owned process group after exit.

The tracked [event excerpt](fixtures/runtime/usage-limit.events.jsonl) contains
selected observed events with temporary root paths replaced by `<fixture>` and
provider billing URLs omitted. It is not a complete raw transcript. The preliminary
agent message was omitted because it was not a completed result. The separate
[sandbox result](fixtures/runtime/read-only-probe.json) records the actual probe.

## Resume

Use Node 22.23.2 (repository pin), system Git and the existing Codex executable.
The temporary Node installation and original fixture may not survive a reboot;
fixture generation is reproducible and does not need the old temporary directory.

```bash
node scripts/runtime-fixture.mjs
```

This creates a fresh `aew-runtime-*` directory under the OS temporary directory and
prints its manifest. Use that root in the following commands, replacing `<fixture-root>`:

```bash
codex -s read-only -a never sandbox -- node /absolute/path/to/project/scripts/read-only-probe.mjs <fixture-root>
node scripts/runtime-spike.mjs investigate <fixture-root>
```

The next step, once the account limit allows another run, is to retry the synthetic
investigation and verify a completed structured report with meaningful evidence
from both repositories and the artifact. Do not treat the earlier introductory
JSON message as success. The spike runner now requires successful process/turn
completion and populated evidence fields before reporting a passed investigation.

Then validate the remaining modes, one at a time:

```bash
node scripts/runtime-spike.mjs cancel <fixture-root>
node scripts/runtime-spike.mjs timeout <fixture-root>
node scripts/runtime-spike.mjs missing-profile <fixture-root>
```

These modes have been prepared but not executed. Missing-auth behavior still needs
a separately designed credential-safe check; never delete or replace user credentials.
Review the effective tool boundary and unsupported flag behavior before marking
Task 000 verified. Only then continue the agreed sequence with Task 002.

## Script limitations

The scripts are a Linux-first feasibility harness, not the Task 008 production
adapter. They use POSIX process groups and `/dev/null`, a two-minute investigation
deadline and synthetic inputs. Event framing, cancellation races, profile failure
classification and process-tree handling need further verification. JSON shape and
nonempty evidence checks do not prove the semantic correctness of a conclusion.
No real invocation was repeated after the checkpoint's success-classification fix.

Raw temporary transcripts must be reviewed/redacted before any publication; tracked
evidence contains only the selected synthetic records. The schema is for this spike
and does not establish the product's final investigation schema.

Reference: [official non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).
Installed CLI help and observed behavior take precedence for compatibility testing.
