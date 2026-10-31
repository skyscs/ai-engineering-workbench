# LoreDock source catalog and answer guide

LoreDock currently connects local Git repositories, indexes committed text and lets
you open exact source citations. The default catalog needs no Codex setup and makes
no model calls. Source suggestions, a declaration map and partial static flows help you
explore the system. An opt-in pilot adds cited answers; automatic Workbench repository
selection belongs to later iterations.

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

1. Paste absolute **Repository paths**, one per line, for example:

   ```text
   /home/you/projects/order-api
   /home/you/projects/portal
   /home/you/projects/order-worker
   ```

   Click **Preview repositories**, inspect canonical roots and the ready/existing/
   duplicate/invalid entries, then **Add N repositories** once. Only ready entries
   are added; invalid paths and aliases are skipped visibly. Preview accepts up to
   40 entries / 8 KiB, with up to twenty active repositories in the catalog. If the
   valid set exceeds available slots, edit and preview again; nothing is added.
   A subdirectory resolves to its Git root; linked worktrees share one Git identity.
   No parent-directory scan, remote clone or model setup is involved. Registration
   does not read source content or start indexing. **Connected repositories** expands
   the saved source list; large lists start collapsed to keep indexing within reach.
   Changed paths or another tab's registration require a fresh preview. Retrying a
   lost confirmation response uses the same persisted receipt and never restores
   revoked sources.
2. Click **Index sources**. LoreDock pins each source's current committed HEAD and
   inventories its tree. It neither fetches remote branches nor changes your checkout.
3. Read the indexed/excluded/failed/pending counts. **Coverage and revisions** shows
   exact commits, unavailable sources, dirty-worktree notices, omitted path counts and
   reasons for exclusions. **Show excluded and failed files** lists up to 100 examples
   with file errors; aggregate counts cover the entire considered inventory.
4. To find a starting repository, describe the problem under **Where should I look?**
   and click **Find candidate repositories**. Review original evidence and **Other matches**.
5. Enter a concrete term under **Explore the sources**, such as `orders.placed.v2`,
   `/api/orders`, `OrderConsumer` or a MongoDB collection name. Click **Search**.
6. Click a matching passage to open **Source evidence**. It shows the source, file,
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

## Find candidate repositories

**Where should I look?** is available after indexing, without Codex setup. Enter a problem
description or a concrete symbol, endpoint, event or source phrase, then click **Find
candidate repositories**. The view suggests up to six repositories and shows matching
terms beside original file/line links. Open those links to check the actual source.

Expand **Other matches** before narrowing an investigation. Relevant repositories can
fall below the lexical threshold or beyond the suggestion limit. Equal matches crossing
the cap have a separate notice. A negative statement such as “no implementation is
supplied” can match your question; the match does not establish that implementation.
The broader context used by Ask Project remains unchanged.

**No distinctive source match** asks for a more specific clue. It does not establish
absence from the system. This local preview uses words from the indexed sources;
it does not translate questions or verify runtime connections. Missing implementations,
external repositories and deployment evidence can still change the investigation scope.

**Scope and missing context** shows coverage and retrieval omissions. Historical index
selection keeps evidence pinned to that snapshot; update knowledge for newer sources.
Matching engineer notes, when present, appear separately as unverified human statements.
Editing the question or changing sources, policy, index or review invalidates the
preview and pending citation responses. Generate a fresh preview when ready.

Suggestions are a reading aid requiring review. Workbench integration remains planned;
this action does not run an investigation or modify source repositories.

## Update knowledge and review changes

After the first published index, the main action becomes **Update knowledge**. Commit
the changes you want included, then click it. LoreDock snapshots and inventories every
current repository, including new sources and paths. Working files remain untouched;
uncommitted changes are still excluded. No repository is fetched and no model is called.

The previous published index stays available while the update runs. Use the existing
**Pause**, **Resume** and **Cancel index** controls as needed. Resume retains the original
revision vector and update baseline, even if repository HEAD moves while paused. A wholly
failed update keeps the previous published index; partial results display their gaps.

**Changes in the selected index** shows added, changed and removed committed paths,
coverage changes, or entries that cannot be compared. A rename appears as an added and
removed path. If an inventory failed or was truncated, missing entries in that scope
are not reported as confirmed additions/removals. **Index version** selects the pinned
comparison as well as the map/search views. Earlier indexes that predate refresh tracking
show comparison/metrics as unavailable.

Open **Update details** for source revision changes, a bounded file list and original
or selected-index evidence buttons. Counts describe the bounded inventories; the preview
shows at most 100 safe paths, balanced across sources, with a 512 KiB output limit.
Omissions are explicit. This is a file-inventory comparison, not proof of complete
analysis or a coherent deployment. Revoked source scopes are excluded from both sides;
old-policy comparisons are fenced.

Unchanged admitted text is reused only after checking its source/path/Git object,
policy/extractor, bytes, complete spans and metadata fingerprint. New citations have
new IDs and retain the new index's revision, while older citations stay unchanged.
The current file/project budgets apply before reuse. Cache validation failures fall
back to reading the pinned Git object and are counted in details. They do not themselves
prove a successful repair. The frozen demo reuses 18 text files on an unchanged update;
its three binary canaries still need byte reads, reducing Git file reads from 21 to 3.
Read-attempt counters include interrupted retries and are not elapsed-time or billing
measurements. Unsupported byte-dependent input may be checked again.

Maps/flows are reconstructed from the new inventory, including added consumers. Older
answers keep their original input/build and staleness labels; they are not regenerated.
Engineer corrections remain on their original index. Use **Earlier engineer corrections**
in the system map to review eligible notes for the newer index explicitly. Reusing a
file does not transfer an old conclusion or human review.
See [refresh evidence](../fixtures/loredock-refresh/README.md).

## Read the project overview

After indexing, **Project overview** appears before the system map. Each repository
has its saved revision and either a short original root README excerpt or a clear
**README context unavailable** explanation. **Open README evidence** opens the exact
committed lines, including their original revision and integrity metadata. Under
**More source reading**, open the original README spans and available root package/Maven
manifests. All reading is local and makes no model calls.

These excerpts are documented intent, not verified roles or a generated architecture
summary. They can be outdated or contradict code/configuration: the demo API README's
`orders.created.v1` remains visible even though its local configuration says
`orders.placed.v2`. Compare the evidence before drawing a conclusion. HTML, links,
commands and source instructions are displayed literally; no setup snippet is executed.

Open **Guide me** for a short reading route:

1. **Read repository context** focuses the first repository card. Read its quote and
   open the original evidence, then continue through the other repository cards.
2. **Explore system map** focuses the declared interface/contract/configuration view.
   Candidate matches retain their uncertainty; matching names do not prove ownership.
3. **Follow first flow** opens/focuses the first available partial source outline.
   Read original citations, unresolved wiring and engineer review labels. If it is
   loading or unsupported, the guide explains that state; try again after loading or
   inspect the sources instead.
4. **Review sources and gaps** opens the overview's selected-index coverage: missing
   documentation, exclusions, failed files and omitted inventory. This follows the
   index you selected, including a historical index.

One unambiguous root `README`, `README.md` or `README.txt` is supported, ignoring case.
Several recorded root READMEs produce a gap; the application does not choose one by
content. Nested documentation is not substituted for a missing root introduction.
Code-only or oversized introductions remain gaps, with original reading links when
available. Failed/truncated inventories cannot establish that documentation is absent.

Overview coverage is not a percentage of system understanding. Diagnostics under
**Overview coverage and gaps** disclose the bounds: sixty root documents, 32 KiB/file,
640 KiB source input, eight spans/file, 16 complete lines / 2,000 UTF-8 bytes per excerpt
and 512 KiB output. Every saved authorized repository gets context or a visible gap.
The text selector skips headings/code blocks; it is not a full Markdown or semantic
analyzer. Other markup stays literal.

**Index version** changes the overview with the other source views. Historical text
stays pinned after updates/restart. New active repositories outside that snapshot are
listed separately until **Update knowledge** includes them. Source removal hides its
context and fences citations, including late responses; a policy change requires a new
index. No separate model configuration, learning state or extra source form is needed.
See [orientation evidence](../fixtures/loredock-orientation/README.md) and
[ADR 0027](../decisions/0027-loredock-project-orientation.md).

## Explore the declaration map

After indexing, **System map** appears automatically and makes no model calls. Open a
repository card to inspect its package identities, HTTP route declarations, unresolved
handler references, event contracts and configuration values. Click a source button to
open the original committed lines. Repository and package identities are not services.

**Cross-repository clues** compares declared contracts and scoped configuration values.
A **Candidate match** keeps the declarations separate; matching names/shapes/values do
not prove producer/consumer roles, a shared broker or a runtime connection. **Different
declarations** invites comparison of both sources; it is not an automatic incompatibility
or production-conflict verdict. Different explicit environments are not compared.

The first adapter supports JSON route arrays with literal `method`, `path`, `handler`,
flat event-contract objects (`name`, `version`, `fields`, `transport`, optional `key` and
`encoding`), direct package/Maven identities, and scalar values in JSON files under
`config/`. Environment comes from an explicit `environment` string; a `local.json`
filename alone does not assign local scope. Contract extensions, dynamic/nested values,
code implementations and README prose stay outside this map's adapter coverage.
Unsupported material remains available through source search.

Open **Map coverage and gaps** for document/byte counts and omission reasons. The map is
always partial. Limits are 100 documents, 32 KiB per document, 256 KiB total source text,
eight original spans per document, 100 collection members, 150 entities, 250 links,
2,000 eligible comparisons and 512 KiB output. Oversized/unsupported declarations are
omitted whole, with explicit counts. No source command, broker or database is queried.

The existing **Index version** selector also selects the map's pinned index. Older
indexes/registry versions are labeled; new registrations require another index. Source
removal hides that repository and dependent comparisons immediately on refreshed reads;
policy changes fence old maps. Restart recomputes the projection from saved original
bytes, without resuming AI work or storing a second graph database.

The declaration projection remains separate from the bounded code links below.
See [map evidence](../fixtures/loredock-declaration-map/README.md).

## Follow a static flow outline

After indexing, **Static flow outlines** appears inside **System map**, without any
additional setup or model calls. On the synthetic demo it offers **Vue action ·
Checkout.vue** and **Dojo action · orders.js**. The first outline opens automatically;
open the other card to follow the alternate client through the shared Java handler.

1. Read the numbered steps from the client action to the document write. A step's
   source button opens its original committed file. **Source link** explains a
   supported local syntax relationship.
2. Review each **Candidate hop**. HTTP method/path matching does not bind the client
   URL/proxy to a deployed server. Matching record/contract shapes and scoped topic
   settings are delivery clues; they do not prove shared broker or serialization.
3. Open **Compare hop evidence** to inspect both sides, including configuration and
   contract files. Open **Unresolved wiring** for missing runtime topic binding,
   subscriber-to-onMessage dispatch and concrete MongoDB collection selection.
   A comparison scoped to `local` leaves the active environment unknown.
4. Use **Index version** to inspect an older pinned outline, or index again after
   source changes. Removal hides dependent steps and hops on refreshed reads;
   policy changes fence old projections. Switching citations quickly opens the last
   selected citation; old responses cannot replace it.

These outlines are always **Partial**. They describe supported source syntax, not
observed execution or execution order. A shorter outline or no outline means the
adapter lacks a supported path; search raw source and inspect **Code coverage and
gaps** before concluding that behavior is absent.

Open **HTTP header bindings** to compare the literal names on each supported HTTP
candidate, including candidates outside the two outlines. It opens automatically when
a mapping is missing from the declarations. Each row includes both source citations and
**Correct this link**, so you can inspect or dispute the comparison directly.

- **Names match**: the client declares the names used by this handler's bindings,
  ignoring ASCII case. For example, `x-receipt` matches `X-Receipt`.
- **Mapping not shown**: a declared binding has no matching literal client name.
  `X-Receipt-Key` does not match `X-Receipt`. Check both source files and look for
  middleware or proxy rewriting before treating this as a defect.
- **Not resolved**: a supported complete comparison is unavailable. Headers may be
  dynamic, computed, spread, malformed or too large; the route may lack supported bindings.

This comparison reads object-literal `headers` in the supported fetch/Dojo syntax and
same-document JSON `headerBindings` such as `{"Ledger.accept.key":"X-Receipt"}` for a
route whose `handler` is `Ledger.accept`. It does not resolve real framework configuration,
aliases, wrappers or `Headers` objects. An omitted/empty literal header object records no
literal names; it does not prove that runtime headers are absent. Names do not prove
values, parameter conversion, live delivery, authentication or tenant membership.
The comparison allows at most 16 entries, 128 ASCII characters per name and 512 characters
per serialized names/bindings property, within the existing graph and output limits.
Partial coverage remains visible in **Code coverage and gaps**.

The header-aware adapters are `pilot-code-v2` and `json-declarations-v2`. Saved version-1
corrections retain their original history and citations but do not attach to new link
identities. After **Update knowledge**, use **Earlier corrections** to read their
original support; incompatible adapter records cannot be reapplied. Review the current
link and save a new correction when appropriate. Saved answer inputs/results remain
unchanged. New answer contexts may include fully supported comparisons as separately
labeled derived clues; the originals remain the only valid source citations.

Current support is deliberately limited to top-level named TS/JS functions, relative
named imports, literal fetch method/path forms (including one `import.meta.env` base),
the demo's simple Vue script-setup/button envelope, one Dojo AMD `dojo/request`
dependency and Java records/classes calling the synthetic EventPublisher,
KafkaSubscriber and MongoCollection interfaces. This is not general Spring/Kafka/MongoDB
driver analysis. Computed values, custom wrappers, inheritance/generics, unsupported
Vue templates and ambiguous references remain gaps. Matching names alone never
establishes a connection; distinct declared environments or differing contract/record
shapes suppress delivery candidates.

The code budget adds at most 100 files, 32 KiB per file, 256 KiB total and eight
original spans per file to the declaration budget. Output is bounded at 160 nodes,
240 links, 2,000 comparisons, two outlines of 20 steps, 1,000 traversal expansions and
512 KiB. Original file spans include distant interface/import/type declarations needed
to check a step, while the projection also records its operation's own line range.
No compiler plugin, source command, broker or database is executed. See
[static-flow evidence](../fixtures/loredock-static-flows/README.md).

## Correct a relationship or its scope

Use **Correct this link** beside a map comparison or a step's incoming code link.
Choose **Dispute this link** when it may be wrong, or **Clarify this link** to add
missing context. Write the correction in English. **Environment scope (optional)**
lets you name a scope such as `local`; leaving it blank does not mean all environments.
Click **Save correction**. Saving makes no model call and does not start another index.

The original source claim stays visible next to an **Engineer correction**. Its
provenance is human and unverified. A human-supplied environment does not establish
the active deployment, shared broker or production behavior. Outlines depending on
the corrected link are marked **Needs review**. Declaration comparisons also mark
flows sharing their supporting passages, conservatively requesting broader review.
The original path remains available for inspection.

Use **Edit correction** for another version, **Correction history** for earlier text,
scope and original evidence, or **Withdraw correction** to remove its active effect.
Withdrawal is another history version. Any other active correction still keeps its
dependent outline in review. Restart preserves the notes and history.

If another tab changes the correction, your draft remains open. Review the newer note
and choose **Use latest review** before saving again. Failed requests can be retried
without silently creating another copy. Pending/failed review loading is labeled and
editing is disabled until current review state is available.

Corrections apply to **this index only**. A new index does not inherit them, even if
its source revisions happen to match. Select the older **Index version** to inspect
its review, or follow the reapplication steps below. **Ask Project** previews matching
notes separately from original source evidence; see the answer review steps below.

Removing any source in the recorded index fences its corrections and all history,
then logically purges their text, human environment and original relationship snapshot,
including withdrawn versions. This conservative dependency scope includes sources not
directly named by the link. Reindex the remaining sources before adding new corrections.
Policy changes fence earlier notes. Backups and external copies are outside local purge.

Limits are 100 corrected targets per index, 20 versions per target (the final slot is
reserved for withdrawal), 2,000 UTF-8 bytes per statement and 80 per optional environment.
History/output budgets are explicit and reject a write atomically instead of omitting
existing notes. See [correction evidence](../fixtures/loredock-corrections/README.md)
and [ADR 0024](../decisions/0024-loredock-engineer-corrections.md).

## Review earlier corrections after an update

After **Update knowledge**, open **Earlier engineer corrections** in the system map.
The panel compares active notes from the previous index with the selected index. It
does not apply them, change flow review status or call a model just by loading.

1. Open a proposed relationship. Read the earlier note, its engineer scope and the
   relationship claims on both sides. Source buttons open the original committed
   evidence for their respective indexes.
2. **Supporting evidence unchanged** means the same unique source/file relationship,
   semantics, properties and complete supporting file/span hashes/ranges match. This
   includes supporting contract/configuration clues. Review the wider current scope
   under **Review scope and limits**; matching files cannot establish that the human
   statement still applies to a changed system or deployment.
3. If you still agree with the note, click **Apply to this index**. This creates a new
   human/unverified correction for this index, marks its dependent flows for review
   and records the exact original version. **Read earlier correction** opens that
   version and its evidence. The earlier history remains unchanged.
4. **Supporting evidence changed**, **Link not found**, **Several possible links** or
   **Comparison unavailable** requires a new review. No apply control is offered.
   When a unique current link exists, **Open current link** navigates to its normal
   correction controls. A link outside the displayed bounded outlines is explained;
   its source evidence can still be opened.
5. **Already reviewed in this index** protects every current decision, including a
   withdrawal. Edit that index's correction directly when appropriate. The earlier
   note will not replace it.

If you skipped a review, open **Choose an older review index** and select an ancestor
with active notes. The default never searches backwards to resurrect an older note
after a nearer withdrawal. Discovery is limited to 20 recorded authorized refresh
ancestors; each preview includes at most 20 latest active corrections from one chosen
index and 512 KiB of details. Omitted corrections and missing history are visible gaps.
No rename inference or matching by a name alone is attempted.

Another review, source/policy change or new publication can invalidate a pending
comparison. Use **Refresh comparison** and review it again. A failed request can be
retried with its existing request ID; replay never reactivates a subsequently withdrawn
note. A successful reapplication is an independent decision even if the original note
is later edited/withdrawn. Source revocation still fences and purges both dependency
scopes, including all later versions. Selecting a historical **Index version** applies
only to that explicitly labeled historical index. Nothing is carried to a later index
automatically. Reapplied notes can enter that index's answer context when their evidence
overlaps the retrieved passages, retaining their exact reapplication origin.

See [reapplication evidence](../fixtures/loredock-reconciliation/README.md) and
[ADR 0026](../decisions/0026-loredock-correction-reconciliation.md).

## Ask a question (opt-in pilot)

Stop the existing LoreDock process and start the answer pilot with the same data
directory. Back up the stopped directory before upgrading. Current startup migrates
older LoreDock data to schema 7, retaining evidence, answers and engineer correction
history. Schema 3 introduced answer attempts/settings, schema 4 correction history,
schema 5 refresh lineage/counters, schema 6 immutable review-reapplication provenance
and schema 7 bulk-registration receipts with saved source allocations.

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
   with identifier expansion. A full repository name in your question can also select
   a small source sample: up to six first passages per named repository and twelve
   overall. Matching a name does not establish ownership or relevance; other sources
   remain eligible. If several repositories have the same name, none is chosen silently.
   Longer identifiers such as `inventory-api-extra` do not match `inventory-api`.
   If no lexical matches are found, LoreDock samples root README/manifests and source
   languages in rounds across all indexed repositories, with up to six candidates per
   source. Final context still has at most thirty passages / 64 KiB text. Missing or
   oversized files can leave sources unrepresented; no partial passage is sent.
   **Passages from X of Y authorized indexed repositories** shows the actual scope.
   Gaps name sources supplying no passage; this does not prove absence or irrelevance.
   A sample is orientation, not a complete inventory or a measure of understanding.
   Cross-language semantic search is not implemented.
5. Open **Engineer review in this context** to see any disputes or clarifications
   whose original evidence overlaps the found passages. Notes are human and unverified;
   engineer scope stays separate from the original relationship scope. Up to ten notes
   and 16 KiB of note JSON are included. Omitted and unmatched notes are disclosed;
   overlap does not guarantee relevance or complete review coverage.
6. Open **Interface comparisons in this context** to review static HTTP header checks.
   A comparison is included only when all original supporting passages are already in
   the context. Matching names, missing mappings and unresolved inputs retain the same
   limitations as the map. They are derived clues, not source facts or proof of a live
   connection. Use both citation buttons before relying on a relationship. The block
   opens automatically for a missing mapping and reports omitted/incomplete comparisons.
7. Click **Generate answer** to send the selected question, evidence, notes and comparisons through the
   saved connection. The pilot uses **Codex 0.166.0 / gpt-5.6-terra / medium** on Linux.
   There is one active attempt, at most two minutes, 30 passages / 64 KiB source text,
   and 20 claims. Complete prompt and CLI overhead are additional to source text;
   displayed byte counts are not token or monetary estimates.
8. Read source-backed statements, explicitly marked inferences/conflicts and unanswered
   questions under **What remains unknown**. Known explanations belong in cited statements;
   choosing a local setting does not resolve a README/configuration disagreement. Click
   a citation to open its original saved lines. Check whether the text actually supports
   the statement: resolving a citation is not proof of truth.

The saved answer's **Engineer review in this context** preserves the exact supplied
versions, even after later edits or withdrawal. Its source buttons open the overlapping
original passages; those passages need not substantiate the engineer's statement.
**Engineer review changed** means review has advanced since the input was prepared.
This is conservative: an unrelated note can trigger it too. Use **Find context**, then
explicitly **Generate answer** to include current review. A note edit during preparation
or generation prevents stale publication and keeps the previous successful answer;
model usage may already have occurred. No automatic regeneration is performed.
Older answers without review snapshots say so and remain unchanged.

Saved **Interface comparisons in this context** also retains the exact supplied block;
refreshing the index does not recompute it. Older answers without comparisons say so.
The block uses stable graph order, at most six comparisons and 8 KiB of comparison JSON.
If the complete prompt would exceed 96 KiB, whole comparisons are omitted until it fits;
source passages and engineer notes are never removed to make room. If the base context
is still too large, **Find context** asks you to narrow the question or source scope
before any runtime preparation. Missing comparisons do not establish absent interfaces.
New answers use prompt v9, with unchanged retrieval v7 and answer schema v3. Real-model
quality qualification for v9 is pending; the prior failed evaluations remain failures.

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

- **UNQUALIFIED_CLI**: this pilot verifies exactly 0.166.0; another version requires
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

The bounded answer slice was owner-accepted after PR #20; see the
[acceptance record](L2_ACCEPTANCE.md). Future answers still require source review. See the
[latest evaluation](../fixtures/loredock-answer-quality/README.md). The original
[evaluation failures](../fixtures/loredock-answers/README.md) remain available for comparison.
New attempts constrain citation choices to issued evidence IDs. Older saved answers
retain their original prose and prompt/schema versions; opening history does not rewrite them.
The newer engineer-review prompt is verified with fake-runtime and browser checks in
[Task 023](../../tasks/023-loredock-answer-review-context.md); its real-model handling of
disputes has not yet received a new semantic acceptance run.

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

The catalog supports twenty active repositories, 10,000 candidate paths per build,
1 MiB per file and 50 MiB of admitted text. New indexes reserve equal path and byte
shares for each source (500 paths and 2.5 MiB per source at twenty repositories).
Root README candidates, then root `package.json` / `pom.xml`, precede other paths.
Unused shares are not borrowed: total indexed bytes may be below 50 MiB while a
large source reports `source-byte-limit`. Omitted inventory remains a visible gap,
not proof that files are absent. These fixed shares survive pause/restart/resume;
older saved builds keep their legacy admission behavior. The UI shows total limits;
source coverage records the actual exclusions and omissions.

The overview attempts all twenty root READMEs before optional manifests. A README
over 32 KiB or eight spans has an explicit overview gap even when source search can
open its text. A full set of twenty cards is not a complete system analysis: deeper
maps, flows and question context retain their separate, smaller budgets. Model input
is not expanded by adding repositories. Each Git command has a 15-second deadline
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
| `GET /api/builds/:id/changes` | Bounded authorized inventory comparison, source revisions, reuse/read diagnostics and original/selected evidence IDs. |
| `GET /api/search?q=...&buildId=...` | Search the current or a selected published index. |
| `GET /api/evidence/:id` | Reopen a validated, authorized stored citation. |
| `GET /api/system-map?buildId=...` | Bounded declaration projection for the current or a selected authorized published index. |
| `GET /api/code-flows?buildId=...` | Versioned code links, partial flow outlines, candidate hops and original evidence from the same authorized index. |
| `GET /api/orientation?buildId=...` | Original README context/gaps, optional manifest reading, selected revisions/coverage and separate unindexed-source gaps; no model calls. |
| `POST /api/candidates/preview` | Model-free source suggestions from `{question, buildId?}`, original support, other matches and scope/uncertainty. Requires session/CSRF; no saved investigation scope. |
| `GET /api/corrections?buildId=...` | Current human correction overlay/revision and flow-review dependencies for the selected index. |
| `GET /api/corrections/:id/history` | Authorized immutable versions and original relationship/evidence provenance. |
| `POST /api/corrections` | Save/replay a dispute, clarification or withdrawal with issued target ID, projection hash and expected review versions. |
| `GET /api/correction-reconciliation?buildId=...&fromBuildId=...` | Bounded earlier-review preview; default previous index, optional authorized recorded ancestor. |
| `POST /api/corrections/reapply` | Explicitly apply an eligible original version with preview hash and current review revision; exact replay preserves provenance. |
| `GET /api/answers` | Saved connection, recent attempt metadata and latest authorized answer ID (pilot only). |
| `PUT /api/answers/configuration` | Save `{executable, configHome, profile}`; use `null` for no named profile. |
| `POST /api/answers/preview` | Retrieve `{question, buildId?}` without invoking a model. |
| `POST /api/answers` | Start/replay `{requestId, question, buildId, inputHash}` from a reviewed preview. |
| `GET /api/answers/:id` | Authorized saved context, result, identity and usage. |
| `POST /api/answers/:id/cancel` | Cancel one attempt and fence late completion. |

Answer routes exist only when the pilot is enabled. The server reconstructs and verifies
context; clients cannot submit their own evidence set. Reusing a request ID with changed
inputs or a changed connection is a conflict, not a retry.
