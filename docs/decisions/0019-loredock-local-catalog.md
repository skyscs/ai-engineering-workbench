# ADR 0019 — LoreDock committed-text catalog

Date: 2026-09-28
Status: implemented in Task 015.

## Decision

Ship a separate `@loredock/daemon` on loopback port 4244 and `@loredock/web` on
development port 5174. Use the existing pinned Node, TypeScript, Hono, React and Vite
versions without new third-party libraries or a shared application framework.
Workbench keeps its entry points, database, schema and runtime behavior.

The initial UI has one project and three active local Git repositories. A source is
identified by canonical checkout and common Git directory; linked checkouts of the
same repository deduplicate. Removal revokes the source permanently and permits a
new registration. There is no clone/fetch or AI connection configuration in this slice.

LoreDock owns `loredock.db` and a dedicated `.owner.db` SQLite exclusive ownership
lock in its own data directory. Schema 1 contains project policy, source registry,
builds, pinned build-source records, file work units, source bytes, spans and FTS5.
Do not open or migrate `workbench.db`; reject a data directory containing it. The
browser only imports transport types from LoreDock; it has no storage/Git dependency.

## Read-only sources and snapshots

Read committed blobs with system Git using argument arrays, exact object IDs,
disabled replacement objects/hooks/fsmonitor/automatic maintenance/lazy fetching,
no permitted network protocols and an environment excluding ambient Git selectors.
Never checkout, fetch, execute project commands, load source instructions as commands,
initialize submodules or apply smudge/clean filters.

Do not reuse Workbench's task evidence reader: it depends on task/worktree pins and
its Git transport decodes text before validation and caps output at 256 KiB. LoreDock
uses a small byte-preserving reader with an abort signal and explicit byte/time caps.
No shared Git or runtime package is changed. `git status` is deliberately avoided:
working-content refresh can invoke repository filters. Instead, `ls-files` detects
conservative stat/untracked differences and `diff-index --cached` detects staged
changes with external diff/text conversion disabled. No index refresh/write occurs.

Resolve each source's HEAD and tree before extracting files. The vector can span
different capture times and has unknown deployment coherence. Persist each pin before
inventory so pause/restart cannot silently move a captured source to a later HEAD.
Missing revisions and unavailable sources remain explicit failed source records.

Store admitted original bytes in LoreDock's SQLite database, verifying the Git blob
hash before ingestion and a SHA-256 hash on evidence reads. This is the L1 owned
snapshot store; no bare clone or original-repository pin ref is needed. A citation
remains readable if its original checkout is removed after indexing. If an unread
object disappears before a resumed unit can read it, record a failure; do not silently
substitute another revision. History traversal and object-store deduplication are later work.

Spans cover at most 120 lines, use application-issued IDs, and record inclusive
1-based ranges and text hashes. CRLF is normalized to LF for display/search; original
bytes keep their own hash. Evidence validates both hashes and the source range.
Completed-file reuse on resume revalidates bytes, span ranges and extractor version.

## Extraction, limits and publication

`text-v1` indexes supported UTF-8 text, source samples and README files as text; JSON
metadata is parsed with `JSON.parse`. Maven metadata uses a conservative tokenized
subset with direct project coordinates/compiler release. It rejects entities/DTDs and
unsupported constructs instead of resolving anything. Other XML is searchable text
after rejecting entity declarations. This is not a general XML validator, Java parser,
dependency resolver or architecture extractor.

Symlinks, submodules, LFS pointers, binary/invalid UTF-8, unsupported formats, policy
paths and limits are visible exclusions. Project-specific exclusions are literal paths
or directory prefixes applied to every source. Default path exclusions are a bounded
rule set, not a secret scanner. Extraction reports per-source counts and reasons.

Use one unfinished build per project and one file per durable work unit. Request IDs
bind the explicit source-set/policy versions; identical retries return the same build,
different payloads conflict. Each completed file and its spans/FTS rows commit together.
Only a complete traversal publishes the build in one transaction. Partial coverage
is explicit; complete source/read failure preserves the previous published index.
Search cannot see unpublished units. A new build scans its full requested source set,
so additions/removals cannot reuse stale negative-query results.

Pause finishes the current unit; cancel aborts the owned Git process and fences late
publication. Startup converts active work to interrupted; resume is explicit. A
five-minute wall budget pauses at a checkpoint. File/path/total-byte caps produce
partial coverage; changing source exclusions and creating a new build is the recovery
path. This refines L0's provisional blanket "resumable budget" wording: repeating an
unchanged byte cap would not make progress. There are no model calls or paid retries.

## Revocation and local transport

Revocation commits an immediate source fence plus pending purge state before deleting
content. Search/evidence checks live source authorization, including before purge;
startup resumes pending purge. Delete the source's live bytes, extracted metadata,
spans and FTS rows, retaining source identity/hashes/coverage for audit. This is logical
application purge, not forensic erasure of SQLite pages, backups or browser copies.
Policy changes fence all older indexes immediately and cancel unfinished work.

Carry over the verified local HTTP pattern without extracting a generic server:
exact Host/Origin, protected reads, bounded session creation, HttpOnly SameSite cookies,
CSRF checks, bounded JSON bodies, escaped React text, no-store API responses and a
production content security policy. Use a separate cookie name from Workbench.

## Consequences

L1 is independently useful for searchable source evidence. Search is lexical; no
semantic, translated, relationship or model-quality claim is made. The 20-question
and ten-incident L0 sets remain future acceptance sets. Runtime qualification still
gates L2; this implementation neither starts Codex nor changes its allowlist.
