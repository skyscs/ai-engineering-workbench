# LoreDock source catalog and answer guide

LoreDock currently connects local Git repositories, indexes committed text and lets
you open exact source citations. The default catalog needs no Codex setup and makes
no model calls. An opt-in pilot adds cited answers; system relationships and automatic
Workbench repository selection belong to later iterations.

## Start LoreDock

Use the repository's Node 22.23.2 and pnpm 10.15.0 toolchain. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm loredock
```

Open **http://127.0.0.1:4244** and keep the terminal running. Stop with Ctrl+C.
Workbench remains independently available through `pnpm start` on port 4242.
LoreDock reports an error if its own port or data directory is already in use.

For development, run `pnpm loredock:dev` and open **http://127.0.0.1:5174**.
The development command starts only the two LoreDock apps and uses the same storage
rules. Stop a production LoreDock process before starting development with the same
directory. Linux is the verified platform.

## Index and explore your repositories

1. Enter an absolute **Repository path**, for example `/home/you/projects/order-api`,
   and click **Add repository**. Add up to three repositories for this first pilot.
   The application shows canonical paths; selecting a subdirectory registers its Git
   repository root. Linked checkouts of the same repository share one registration.
2. Click **Index sources**. LoreDock pins each source's current committed HEAD and
   inventories its tree. It neither fetches remote branches nor changes your checkout.
3. Read the indexed/excluded/failed/pending counts. **Coverage and revisions** shows
   exact commits, unavailable sources, dirty-worktree notices, omitted path counts and
   reasons for exclusions. **Show excluded and failed files** lists up to 100 examples
   with file errors; aggregate counts cover the entire considered inventory.
4. Enter a concrete term under **Explore the sources**, such as `orders.placed.v2`,
   `/api/orders`, `OrderConsumer` or a MongoDB collection name. Click **Search**.
5. Click a matching passage to open **Source evidence**. It shows the source, file,
   immutable revision and numbered line range. **Integrity and extracted metadata**
   exposes content hashes and bounded JSON/Maven metadata when useful.

Search uses literal lexical terms combined with AND. It returns at most 30 passages;
it does not translate natural-language questions or infer architecture. A result is
source text, not an AI conclusion. No matches means no matches in the admitted index,
not proof that behavior is absent from the whole system.

Only committed content is indexed. Working-file checks conservatively detect stat,
staged and untracked differences; they do not run clean filters or include those
changes. Every index records independent revisions, not proof of a coherent deployment.
Production environment values and external systems remain unknown unless included in
explicitly registered sources.

## Ask a question (opt-in pilot)

Stop the existing LoreDock process and start the answer pilot with the same data
directory. Back up the stopped directory before upgrading: schema 3 migrates earlier
catalog data and adds question search, answer attempts and connection settings.

```sh
LOREDOCK_ANSWERS=1 pnpm loredock
```

1. Add and index sources as above. Under **Ask about your system**, open **Codex setup**.
2. Set **Configuration directory** to the existing Codex configuration signed into
   the account allowed to process these sources, for example `/home/you/.codex-personal`.
   This is **not** the artifact directory. LoreDock data stays in `LOREDOCK_DATA_DIR`.
   LoreDock does not log in, copy credentials or determine whether an account is personal
   or corporate. `codex` versus `codex-plus` naming alone does not establish identity.
3. Set **Codex executable** to an absolute existing launcher path. A named CLI profile
   is optional. Click **Save Codex setup** once; the connection is saved locally.
4. Enter a concrete question in English, such as “How does an order reach the database?”
   Click **Find context**. This step makes no model call. Review **Context, coverage
   and gaps** and open source passages if necessary. Questions use lexical retrieval
   with identifier expansion; cross-language semantic search is not implemented.
5. Click **Generate answer** to send the selected question and evidence through the
   saved connection. The pilot uses **Codex 0.159.2 / gpt-5.6-terra / medium** on Linux.
   There is one active attempt, at most two minutes, 30 passages / 64 KiB source text,
   and 20 claims. Complete prompt and CLI overhead are additional to source text;
   displayed byte counts are not token or monetary estimates.
6. Read source-backed statements, explicitly marked inferences/conflicts and **What
   remains unknown**. Click a citation to open its original saved lines. Check whether
   the text actually supports the statement: resolving a citation is not proof of truth.

**Cancel answer** prevents late publication and stops the owned process. Failed or
cancelled attempts keep the previous authorized successful answer. **Answer history**
shows the latest 20 attempts and their saved inputs; **Attempt details** shows runtime
and reported tokens or an explicit unknown. Closing the browser does not cancel work.
After a daemon restart, incomplete attempts become **interrupted**. To retry, review
context and click **Generate answer** again; this is a new attempt and may consume usage.
There is no automatic application retry. Provider completion may remain unknown after
interruption, and the CLI can perform internal transport requests within the time limit.

Answers identify their saved index; newer indexes/registry changes are marked. Changing
source policy fences old answers. Removing a source fences and purges dependent context
and answer text, including answers that consumed it but did not cite it.

If setup fails, the history preserves the reason before any answer is published:

- **UNQUALIFIED_CLI**: this pilot verifies exactly 0.159.2; another version requires
  qualification. It never silently selects another executable or account.
- **GLOBAL_INSTRUCTIONS** or **MCP_CONFIGURATION**: the selected configuration contains
  global AGENTS instructions or enabled MCP servers. Use an appropriate explicitly
  configured connection; do not delete corporate configuration merely to bypass a check.
- **PROJECT_CONFIGURATION**: the owned temporary working directory has an ancestor
  `.codex`. Use a clean temporary-directory location before restarting the daemon.
- **AMBIENT_AUTH_OVERRIDE**: inherited provider credentials/routing overrides conflict
  with explicit connection selection. Start LoreDock without those overrides.
- **Invalid answer/citation**: the generated result was rejected and the previous
  answer retained. Failure does not imply that the provider consumed no usage.

The feature remains a pilot pending human semantic review. See the
[recorded evaluation](../fixtures/loredock-answers/README.md); the missing frontend
conventions retrieval case is retained as a known limitation.

## Updates, history and interruptions

After committing source changes, click **Index sources** again to capture a new
revision vector. The latest published index becomes the search default. During a new
run, the previous published index remains available. Complete source/read failure
retains that previous index; partial results clearly show their coverage gaps.

Use **Index version** to select one of the 20 most recent published versions shown by
the UI. Older records are retained in storage and addressable by their API IDs. There
is no automatic background Git synchronization or HEAD-freshness guarantee. Citations
refer to their saved revision even if the source checkout changes or is later removed.

- **Pause** finishes the current file or inventory unit and preserves its checkpoint.
- **Resume** explicitly continues paused/interrupted work using validated completed
  files. Pending files still require the captured Git objects to be available.
- **Cancel index** stops the owned Git subprocess, fences late publication and preserves
  audit state. Start a new index to retry; cancelled work is not resumed silently.
- After a daemon restart, unfinished work is **Interrupted** until you resume or cancel.
  Closing the browser alone does not stop indexing.

Only one unfinished index is allowed. Resume or cancel it before starting another.
A five-minute wall limit pauses at a checkpoint. Path/file/total-size limits appear as
coverage exclusions; narrow the source policy and create a new index if necessary.

## Policy and removal

Open **Source policy and limits** only when you need additional exclusions. Enter one
relative file or directory prefix per line; these apply to every repository. For example:

```text
private
config/credentials.json
```

Wildcards, absolute paths and traversal are rejected. Saving changed policy fences
all older indexes and cancels unfinished work. Index again before searching under the
new policy. There is no fallback to the old policy when the new index is empty or fails.

The default exclusions cover `.env` variants, selected key extensions, `secrets`,
`.codex`, `.git`, `node_modules`, `vendor`, `dist` and `build` path components. They do
not detect every secret or sensitive document. Review the source set and policy before
indexing; admitted text is stored in LoreDock's local data directory.

**Remove source** asks you to confirm revocation. It immediately removes that source
from search/evidence access, cancels affected unfinished indexing, then purges its live
indexed bytes, spans and metadata. Re-registering the path creates a new source identity;
old citations stay unavailable. Purge resumes after interruption. Identity, hashes and
coverage records remain for audit; external copies/backups are not recalled or erased.

## Supported content and limits

The pilot supports three active repositories, 10,000 candidate paths per build,
1 MiB per file and 50 MiB of admitted text. Each Git command has a 15-second deadline
and bounded output; exceptionally large trees can fail inventory explicitly before
the path cap is applied. Search excerpts are capped at 400 characters per result;
evidence reopens a stored span of up to 120 lines.

Markdown, text/logs, Java, JS/TS, Vue and selected other source/config text extensions
are searchable. JSON is parsed for basic metadata. Maven extraction supports a
conservative subset of direct project coordinates and compiler-release properties;
it does not resolve parents, dependencies, plugins or variables. Unsupported Maven
constructs and XML entity/DTD declarations are excluded explicitly.

Symlinks, submodules, LFS pointers, binary/invalid UTF-8, empty files, unsupported
formats and malformed JSON are excluded with reasons. No source commands, hooks,
filters, Maven/npm builds, broker connections or database queries are executed.
Source instruction files remain untrusted text. Git repository metadata itself must
be a trusted local input; this is not a sandbox for running hostile Git installations.

## Local storage and backup

On Linux, the default directory is `${XDG_DATA_HOME:-~/.local/share}/loredock`.
It contains `loredock.db`, SQLite sidecars and `.owner.db`. This directory stores
LoreDock source snapshots and metadata; it is separate from Workbench and Codex data.
To choose an explicit absolute directory:

```sh
LOREDOCK_DATA_DIR=/absolute/path/to/loredock-data pnpm loredock
```

Stop LoreDock before copying the complete directory for backup/restore. Never delete
`.owner.db` to bypass an ownership error; first stop the process using it. Saved
citations use stored bytes, while future indexing needs the external registered Git
repositories at their recorded canonical locations. Source removal is logical purge,
not a promise of forensic erasure from SQLite pages or backup copies.

Each build stores its admitted bytes independently. There is no cross-build
deduplication or automatic history-retention limit yet; the 50 MiB cap is per build,
not a total data-directory cap. Monitor local storage during repeated large indexes.

## Try the synthetic system

```sh
node scripts/loredock-fixture.mjs
```

The command prints a temporary root. Add its `sources/portal`, `sources/order-api`
and `sources/order-worker` directories to LoreDock. After indexing, expect 18 admitted
files and nine exclusions. Search `orders.placed.v2`: the two local configuration
files and worker README should match. Search `orders.created.v1` to find the deliberately
outdated API README. The source files are illustrative; Kafka, MongoDB and their
drivers do not run. Remove the generated directories after the demo if no longer needed.

For repeatable acceptance, run `node scripts/loredock-smoke.mjs` after building with
Chrome installed and port 4244 free. It creates its own database and fixture, tests
desktop/mobile usage, revocation, policy changes and restart, then cleans up its
processes and source inputs. See [browser evidence](../fixtures/loredock-catalog/README.md).

## Local API

Use the browser for normal operation. Integration clients must create a session with
the exact allowed Host/Origin and `x-loredock-client: web`, then retain its HttpOnly
cookie and send the returned token as `x-loredock-csrf` on mutations. API reads also
require the session. No tokens belong in URLs or logs.

| Route | Purpose |
| --- | --- |
| `POST /api/session` | Create/reuse a bounded local browser session. |
| `GET /api/project` | Sources, current policy, recent builds and coverage. |
| `POST /api/sources` | Register `{path}`. |
| `POST /api/sources/:id/revoke` | Fence and purge a source. |
| `PUT /api/policy` | Save `{excludedPaths}`. |
| `POST /api/builds` | Start/replay `{requestId, sourceSetVersion, policyVersion}`. |
| `GET /api/builds/:id` | Exact build status, revisions and coverage. |
| `POST /api/builds/:id/:action` | `pause`, `resume` or `cancel`. |
| `GET /api/builds/:id/files` | First 100 excluded/failed authorized file records. |
| `GET /api/search?q=...&buildId=...` | Search the current or a selected published index. |
| `GET /api/evidence/:id` | Reopen a validated, authorized stored citation. |
| `GET /api/answers` | Saved connection, recent attempt metadata and latest authorized answer ID (pilot only). |
| `PUT /api/answers/configuration` | Save `{executable, configHome, profile}`; use `null` for no named profile. |
| `POST /api/answers/preview` | Retrieve `{question, buildId?}` without invoking a model. |
| `POST /api/answers` | Start/replay `{requestId, question, buildId, inputHash}` from a reviewed preview. |
| `GET /api/answers/:id` | Authorized saved context, result, identity and usage. |
| `POST /api/answers/:id/cancel` | Cancel one attempt and fence late completion. |

Answer routes exist only when the pilot is enabled. The server reconstructs and verifies
context; clients cannot submit their own evidence set. Reusing a request ID with changed
inputs or a changed connection is a conflict, not a retry.
