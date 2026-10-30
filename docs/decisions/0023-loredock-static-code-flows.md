# ADR 0023 — Bounded code links and candidate flow outlines

Date: 2026-10-30. Status: implemented in Task 018, the second bounded L3 slice.

## Decision

Preserve declaration-map v1 and add a separately versioned `pilot-code-v1` read
projection through protected `GET /api/code-flows?buildId=...`. Derive everything
from the selected published index and authorized original source bytes. Do not
execute source, load project configuration, resolve packages from disk/network,
connect to a broker/database, invoke a model or introduce durable graph storage.
The SQLite schema remains version 3; Workbench and answer retrieval are unchanged.

Promote the already locked TypeScript compiler (5.9.3) from a development dependency
to a declared LoreDock runtime dependency. Its in-memory AST handles top-level named
functions, relative named imports and literal `fetch` requests. A deliberately narrow
Vue script-setup/button envelope and single-dependency Dojo AMD `dojo/request` profile
provide the two pilot entry points. Compiler syntax errors, shadowed/reassigned
bindings, computed URLs/options and ambiguous import targets remain gaps. No compiler
plugins, project `tsconfig`, emission or host filesystem resolution are used.

Java uses a conservative lexer and balanced declaration parser, not a type checker.
Supported top-level classes, records, simple fields/method parameters and explicit
same-file interface receivers identify calls through the synthetic `EventPublisher`,
`KafkaSubscriber` and `MongoCollection` profiles. Unsupported inheritance, generics,
Unicode escapes, text blocks and nested executable constructs are not analyzed.
This does not qualify Spring, a production Kafka driver or a MongoDB driver adapter.

## Link semantics

All identities retain build/source/file/position scope. Same-source unique route
handler references can locate a Java class/method; ambiguous names remain unresolved.
Relative imported calls and supported method invocations are **static syntax links**.
They do not establish execution, order, reachability or production service ownership.

HTTP method/path matches produce **candidate hops**: client base URL/proxy to server
binding is absent from this corpus. An event-delivery candidate additionally requires
equal complete supported Java record shapes, matching JSON contract declarations,
matching record/contract field names, one matching scoped `orderTopic` configuration
pair and one supported receiving method/document write. Different explicit
environments, different contracts/records, ambiguous scope and contradictory literal
topics suppress this candidate. Neither record names nor equal topic strings suffice.

The candidate retains both contract/configuration citations and explains its gaps:
runtime parameters are not bound to those configuration files, JSON contracts are not
referenced by record code, and shared broker/encoding/deployment are unknown. Subscription
to `this` and an `onMessage` method accepting the same record produce a separate
**dispatch candidate**; an interface signature does not prove callback dispatch.
`replaceOne` is a code-level document write; a concrete database/collection is unresolved.
The active environment stays unknown even when comparison clues are explicitly local.

At most two outlines navigate these links. Every outline is partial, every candidate
hop is visible, and unresolved wiring is listed. Missing links can shorten an outline;
absence of a supported path never becomes absence of runtime behavior. No candidate
is promoted into answer context, repository routing or a Workbench fact automatically.

## Evidence, bounds and lifecycle

Reuse the declaration map's complete-document evidence validator. Read metadata before
BLOBs, validate hashes and all issued spans, and reject missing/corrupted evidence.
Code nodes retain all admitted file spans because record/interface/receiver/import
declarations can be far from the displayed operation range. Original spans are reused,
not newly invented citations. Declared route identities remain compatible with map v1.

Code admission is round-robin by source, capped at 100 files, 32 KiB each, 256 KiB
total and eight original spans per file, in addition to the declaration-map budget.
AST/token/depth limits and per-file symbol caps bound parser work. The resulting
projection is limited to 160 nodes, 240 links, 2,000 comparisons, two outlines of at
most 20 steps, 1,000 traversal expansions and 512 KiB serialized output. Omissions
are counted. Nodes/links/outlines only reference retained endpoints and original evidence.
Projection hashes are repeatable for unchanged inputs; they are not semantic scores.

No derived text is persisted. Source removal fences the next read and removes all
dependent hops; policy changes fence historical reads. Historical selection retains
original revisions and visible staleness. The browser tags data by selected/latest
index, registry and policy and rejects late responses across those boundaries.
All labels, reasons and source text use escaped React text rendering.
Evidence navigation uses independent reads and a latest-selection sequence guard;
it does not enter the shared mutation busy handler or refresh project state per click.
Boundary changes and new searches invalidate pending selections. A delayed older
response cannot overwrite the user's newer selection.

## Follow-up

Durable engineer corrections and derivative invalidation remain a separate L3 task.
Real-framework adapters require observed conventions and their own fixtures. Broader
Overview/Guide Me, 20-repository scale acceptance and the Workbench bridge remain later
milestones. Two synthetic outlines do not constitute full L3 or production acceptance.
