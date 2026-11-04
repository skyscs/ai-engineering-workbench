# Native capture API evidence

Task 116 exposes the existing authorized native capture/history service through local
HTTP. See the [contract and review](../../loredock/NATIVE_CAPTURE_API.md) and
[hash manifest](validation.json). This is functional API/startup evidence, not another
resource qualification or independent product acceptance.

Reviewed executable/test head: `ebd11a28c57deba05ca84212b34e47f4e29b085a`.
Parent PR #119 head `2ee112f8077d340a914889a2b8335790b11d0ca7` passed push
41902894817 and pull-request 41902934334 CI and merged as identical-tree `9427c38`.
Node 22.23.2, pnpm 10.15.0. All 38 previously qualified actual core modules are unchanged.

| Retained command | Exit | Result |
| --- | ---: | --- |
| Frozen-lockfile install | 0 | Dependencies installed in the isolated worktree. |
| Full typecheck | 0 | Strict workspace types passed. |
| First focused HTTP/native tests | 1 | 63/65; missing no-store on an early Origin refusal and incorrect equality of elapsed history time. |
| Second focused HTTP/native tests | 1 | 63/65; fixture analysis had already read eight originals, and validating two additional stored receipts correctly added two work units. |
| Third focused HTTP/native tests | 0 | 65/65, including real TCP body rejection and capture/history disconnects. |
| Workspace build | 0 | Actual daemon/browser output compiled. |
| Normal compiled daemon smoke | 0 | Five scenarios, three clean process exits, retained exact saved content and authority outcomes. |
| Full `pnpm check` | 0 | 842 tests (17 + 18 + 43 + 635 + 57 + 72), strict types and builds. |

Eight gzip logs preserve those commands. Twenty-nine gzip startup artifacts retain raw
HTTP responses, the actual stored native receipt before purge, process stdout/stderr,
exit records and [result](startup/result.json.gz). The manifest records original paths,
raw byte lengths and SHA-256 hashes for raw and compressed files. It also binds the
eight reviewed source/emitted modules and unchanged qualified runtime closure.

The compiled smoke output remains at `/home/toshiba/aew/task116-startup-first`, with
its owned source repositories and catalog. Catalog identity:
`c1cd6443-e85d-4ef1-b5d2-d1f947e6ddbd`. Daemon PIDs 1656834, 1657169 and 1657265 all
exited zero without forced termination; the listener was released. The test deliberately
revokes the undisplayed source and purges its dependent receipt, while retaining the
earlier raw receipt and history artifacts here. No session or CSRF tokens were logged.

Ordinary focused fixtures used their existing cleanup and are no longer present;
their first failures are retained as logs, not falsely claimed as complete database
archives. Work/timing observations are not immutable saved-content bytes. Tests still
require exact projection/original/dependency content, stable byte/count metrics, bounded
actual work, zero history derivation/publication locks and every original revalidation.
No prior frozen family, user demo, corporate repository or model request was used.
