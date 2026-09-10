# Runtime feasibility and compatibility

## Status

Task 000 is verified on Linux with Codex CLI 0.153.4, 2026-09-10. A completed
investigation, denied filesystem writes, cancellation, timeout and distinguishable
negative outcomes establish feasibility for the restricted configuration below.
The original missing-profile CLI behavior is mitigated by preflight. This is not
a production runtime adapter or verification of arbitrary user configurations.

Selected by the user: existing default Codex CLI configuration, model
`gpt-5.6-terra`, reasoning effort `medium`. Authentication files were not read or
copied. Keep this selection on resumption; do not silently choose another account.

## Initial observations

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

## Resumed probes

The [captured results](fixtures/runtime/resumed-probes.json) contain four observed
probe outcomes. Temporary fixture paths were replaced by <fixture>; source SHAs
and synthetic report content were retained. These records were produced before
the later failure-classification refactor; their null failureKind values on stopped
runs are preserved as historical output, not current classification semantics.

| Probe | Observed result | Acceptance |
| --- | --- | --- |
| investigate | Exit 0, turn.completed, complete structured report with both repo SHAs and artifact evidence | Passed; manually confirmed the seconds-to-milliseconds mismatch |
| cancel | Explicit stop after command_execution started; exit 0; no owned group left | Passed; cancellation must override exit code |
| timeout | Stopped at the short deadline; exit 0; no owned group left | Passed; timeout must override exit code |
| missing-profile | Nonexistent name was accepted and a turn completed with exit 0 | Failed; explicit profile preflight is required |

All four source/Git snapshots were unchanged. The completed investigation included
recoverable 503 reconnect errors before turn.completed, so an error event alone
must not determine terminal failure. The outcome helper now tests that behavior,
alongside the captured usage failure and synthetic authentication/policy failures.

The final report matches the known fixture: service changed timeout 5000ms to 5s,
while client assigned the number directly to timeoutMs. Both Git histories and
the incident artifact were cited. The cancellation check observed no remaining
owned process group; stronger descendant-process handling remains a production
adapter concern, not a general sandbox guarantee from this probe.

## Final verification

The [final probes](fixtures/runtime/final-probes.json) record a fresh successful
investigation after adding preflight and disabling external notification commands.
It again identified the timeout-unit mismatch, with the exact source revisions and
incident artifact. The source/Git snapshot was unchanged and no owned group remained.
Unsupported-option exited 2 with `unsupported_option`. Missing-profile is now
rejected by preflight, without an exec/model invocation; the earlier unsafe raw
CLI result remains in the historical fixture for comparison.

The [local negative probes](fixtures/runtime/negative-probes.json) used a fresh
temporary CLI configuration directory, file-only credential storage and an
allowlisted child environment. No user credentials were read, copied or changed.
`codex login status` exited 1 and was classified `authentication_required`.
This verifies missing-login detection, not expired-token behavior during exec;
remote authentication failures remain covered by synthetic events until Task 008.

A disabled synthetic MCP entry appeared only when its named profile was selected,
proving that the CLI loaded the separate profile file. Missing and malformed
profiles were rejected before exec. An enabled MCP entry was rejected without
starting its marker command. These diagnostics made no model requests.

Validation: `pnpm check` passed on Node 22.23.2 / pnpm 10.15.0, including strict
typechecking, seven HTTP tests, seven runtime tests and the production build.

## Supported investigation configuration

- Linux, the exact verified CLI version and the user's explicitly selected default
  connection; the real model probe used `gpt-5.6-terra` with medium reasoning.
- Trusted local configuration and synthetic repositories without project config.
  The probe is not certification of hostile repository/configuration isolation.
- Read-only sandbox and approval policy never. The three fixture roots are
  readable; writable-directory flags are not used. This is not an exclusive
  filesystem read allowlist or an exact outbound-payload audit.
- Per-invocation disabling of apps, plugins, hooks, browser/computer/image tools,
  multi-agent execution, web search and external notification commands. Provider
  routing and authentication are retained for real investigations.
- CLI diagnostics must confirm the seven disabled feature flags and zero enabled
  configured MCP servers. Unsupported versions, failed diagnostics, enabled MCP
  servers and invalid profile files fail before an investigation is started.

`scripts/runtime-preflight.mjs` inspects profile file metadata/readability without
parsing its contents. Symlinks, special files and invalid selector characters are
rejected. The CLI owns TOML parsing. A named profile can be validated by the local
spike diagnostics, but has not been used for a real authenticated investigation.
The verified default selection is separate and never a missing-profile fallback.

CLI 0.153.4 rejects --profile on `features list`; that command checks the base
configuration with explicit feature overrides. Profile-aware `mcp list --json`
validates the selected layer without connecting to its servers. Its raw output
is not persisted because entries may contain environment/header secrets. These
checks do not prove every possible remote tool behavior. Task 008 must recheck
the actual working directory/configuration, enforce the same launch restrictions,
and reject configurations whose read-only boundary cannot be established.

Profiles and configuration precedence are described in the
[official configuration documentation](https://learn.chatgpt.com/docs/config-file/config-advanced).
The installed CLI help and canary probe confirm the separate profile-file format.
File existence/loading does not verify corporate account identity or prevent
configuration changes between preflight and launch. Production handling belongs
to Task 008, together with credential-safe diagnostics and cancellation races.

## Reproduce

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

The successful real investigation does not need to be repeated unless launch
behavior or the selected CLI/configuration changes. Local negative checks require
the installed CLI but no model request:

```bash
node scripts/runtime-negative-probes.mjs
```

The harness also supports the following probes:

```bash
node scripts/runtime-spike.mjs cancel <fixture-root>
node scripts/runtime-spike.mjs timeout <fixture-root>
node scripts/runtime-spike.mjs missing-profile <fixture-root>
node scripts/runtime-spike.mjs unsupported-option <fixture-root>
```

Cancel and timeout passed before the preflight-only changes; cancellation logic
was not changed. Missing-profile now tests the guard rather than deliberately
repeating the unsafe raw CLI invocation. Unsupported-option also passed. Never
delete or replace user credentials to test missing authentication.

The next development task is Task 002. Task 008 consumes these compatibility
notes and must implement the production checks before executing real user tasks.

## Script limitations

The scripts are a Linux-first feasibility harness, not the Task 008 production
adapter. They use POSIX process groups and `/dev/null`, a two-minute investigation
deadline and synthetic inputs. Event framing, cancellation races, profile failure
classification and process-tree handling need further verification. JSON shape and
nonempty evidence checks do not prove the semantic correctness of a conclusion.
One successful real investigation was made after the preflight launch changes.

Raw temporary transcripts must be reviewed/redacted before any publication; tracked
evidence contains only the selected synthetic records. The schema is for this spike
and does not establish the product's final investigation schema.

Reference: [official non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).
Installed CLI help and observed behavior take precedence for compatibility testing.
