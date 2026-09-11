# v0.1 release acceptance

Status: accepted through the user's merge of PR #12 into main (9e39d3c). Local verification and user acceptance are recorded
separately in [development status](development-status.md).

The clean installation passed typecheck, 130 tests and production build. Chrome
passed the complete release scenario. Three real cases completed in four invocations
using CLI 0.154.0 and the explicit personal configuration with Terra medium. Review
against known history passed; all 25 evidence locators reopened, source state stayed
unchanged, and restart/database-integrity checks passed. See the
[reviewed evidence](fixtures/release/README.md).

## Required cases and review rubric

The fixtures in `scripts/release-fixtures.mjs` generate isolated, non-proprietary
repositories with deliberate historical defects and realistic incident observations.
Each case includes unrelated later changes to distinguish chronology from causality.
The deterministic fixture tests execute current and historical functions to prove
the defect and expected behavior. They do not invoke a model or judge prose quality.

| Case | Known defect and required evidence | Quality gate |
| --- | --- | --- |
| `single` | Price rounding moves before discount multiplication; 1999 cents at 15% becomes 1700 instead of 1699. | Identify the rounding refactor, compare old/new expressions, cite the incident and exclude the later audit documentation as causal. |
| `interaction` | Settings switches retry intervals from milliseconds to seconds; the unchanged client passes the value directly to a millisecond scheduler. | Explain both sides of the contract, cite the producer transition and consumer, and connect them to the incident's 2000ms → 2ms behavior. |
| `revision` | A tenant-scoped cache key becomes SKU-only; a recent display refactor is initially suspected. | Initially distinguish a code defect from an unverified incident cause. After adding the incident log, constraint and challenge, connect cross-tenant reuse to the cache change, rule out the disabled display flag and explain how observations resolve earlier uncertainty. |

Acceptance requires supported explanations and valid references, not exact wording
or confidence scores. Honest insufficient evidence is valid. A model may identify a
candidate defect before the challenge; it must not claim an unobserved incident
cause as established. The revision case deliberately supplies missing observations
only after v1 instead of forcing a model to publish an incorrect initial answer.

## Run deterministic checks

```bash
pnpm install --frozen-lockfile
pnpm check
AEW_SMOKE_RELEASE=1 node scripts/workspace-smoke.mjs
```

The browser check requires Linux Chrome and a free port 4242. It covers the complete
workspace/repository/task/investigation/revision flow, failure/cancel/retry, immutable
history, restart, narrow layout and actual Markdown downloads for chosen versions.
It uses a synthetic CLI through the production adapter; ordinary CI spends no AI.

The existing behavioral suite remains the release regression gate for unavailable
Git/CLI, configuration/profile rejection, malformed output, evidence validation,
redacted diagnostics, process cancellation, interrupted restart, duplicate requests,
partial import/worktree failures, database publication rollback, dirty worktrees,
missing artifacts, stale context and ownership boundaries. HTTP tests cover static
assets/SPA fallback, session/CSRF/Host/Origin checks and safe top-level navigation.

## Run real acceptance separately

Build first. Explicitly select the intended Codex configuration directory; do not
rely on the shell's inherited `CODEX_HOME`. Run each case separately so intermediate
results survive a stopped session:

```bash
AEW_REAL_RUNTIME=1 AEW_CODEX_HOME=/absolute/selected/config node scripts/release-acceptance.mjs single
AEW_REAL_RUNTIME=1 AEW_CODEX_HOME=/absolute/selected/config node scripts/release-acceptance.mjs interaction
AEW_REAL_RUNTIME=1 AEW_CODEX_HOME=/absolute/selected/config node scripts/release-acceptance.mjs revision
```

Use `AEW_CODEX_EXECUTABLE` for an explicit executable. The runner selects Terra medium,
uses the production storage/Git/worktree/runtime/export services, makes one real
invocation per ordinary case and two for revision, and does not retry automatically.
Each attempt has a five-minute deadline. A failed case leaves its database, manifest
and attempt record in the printed temporary directory; inspect it before explicitly
restarting a case, which creates new data and can spend another invocation.

The runner records source hashes/Git status, reopens every published evidence
locator, exports each version, compares reports after restart and checks SQLite
integrity/foreign keys. A successful script is a mechanical result; review report
content against the rubric separately. Runtime/profile selection does not certify
account identity.
Only reviewed report Markdown and a limited evidence summary belong in the
repository. Local configuration paths, complete databases, raw snapshots and runtime
fingerprints remain in local temporary data. The Linux demo is documented in
[linux-demo.md](linux-demo.md); export contracts are in [report-export.md](report-export.md).
