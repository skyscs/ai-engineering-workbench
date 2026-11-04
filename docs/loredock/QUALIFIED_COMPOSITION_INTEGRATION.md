# Integrating the qualified connected-path composition

Status: Task 098 source review, 2026-11-04. This document authorizes bounded
implementation planning, not a production switch or a new receipt consumer.

## Evidence and the actual difference

[Task 097](../fixtures/loredock-canonical-qualification/README.md) passes all sixteen
operation resource/content/support/scope/work gates and seven exact cross-process
comparisons. It tests the complete composed candidate on twenty owned sources and
9,960 files, with peak operation RSS 363.961 MiB. Task 073 previously exercises the
literal-topic rule's positive, ambiguous, dynamic and unsupported cases. Independent
regressions exercise the later representation and read-scope changes. None of these
results establishes private-project semantics or ten thousand dense code files.

The qualified reader is **not a drop-in implementation of production v1**. In
addition to memory ownership, it contains a different event-topic rule, shared
capture accounting, projection schema/adapter identities, topic witnesses and an
offline receipt writer. Substituting its factory in `index.ts` would cross several
contracts at once and bypass current TypeScript wire types. Split representation
integration from derivation/receipt integration, and verify each final composition.

| Component | Qualified implementation | Production destination and invariant |
| --- | --- | --- |
| Snapshot headers | Task 081 `createStreamingAnalysis().snapshot` | Stream the same ordered bounded query inside `CodeAnalysis.snapshot`; incrementally hash the exact JSON manifest and retain only parsed file IDs. Reuse existing authorization/checkpoint helpers. Keep late-row checks, complete counts/bytes/limits and summary behavior. |
| Prepared reads | Task 090 `createPreparedReads` | A typed per-store read owner used only by `one`/`all` inside explicit asynchronous scopes. Every call executes current bindings; no row/result cache. Keep 64 statements / 64 KiB SQL, busy/error/bound fallback and prompt scope expiry. |
| Worker ownership | Task 093 emitted `run` override | Put the scope at the actual typed worker invocation in `CodeAnalysis.schedule`; retain one original shared service guard, scheduler, catch/finally, pause/resume/stop and short transactions. Never override a private emitted method in production. |
| Path payloads | Task 088 compact entries + Task 096 canonical pair | Narrow internal `PathFactEntry.payload` to facts/ranges/evidence. Validate the full original payload first and retain exact consumed hashes. Share only one copied/frozen exact eligible pair, at most 4 KiB serialized, per request. |
| Literal topics | Task 073 predicate and Task 075 resolver/admission fork | Separately version a typed producer; preserve full binding domains, ambiguity and topic witness support. Do not issue new semantics under `connected-paths-v1`. |
| Shared budget | Task 075 `CaptureBudget` / shared `PathWork` | Typed internal operation capability, one deadline and total with path/receipt subtotals. Standalone paths own a budget; capture supplies the same instance. No HTTP/configuration limit fields. |
| Receipt capture/history | Task 075/079 offline `receipt.mjs` | Remain offline until a separate durable-owner design covers atomic publication, recovery, full-scope purge dependencies and retained-byte admission. No arbitrary import or new API follows from this review. |

The experimental services also include diagnostic callbacks and subclasses/factories
that wire emitted methods. Keep those in retained experiments. Application code
must import typed local modules, never `scripts/`, built output or test fixtures.

## Current callers and lifetime

`src/index.ts` creates one store/catalog/analysis/follower/path owner. Shutdown stops
the follower, then paths, analysis, optional answers and catalog before closing the
store. Preserve that order so no read scope survives its database. `createApp`
accepts injected services and creates a fallback `CodePaths` when only analysis is
provided. Both paths must receive the same implementation; changing the launcher
alone would leave protected-route tests and other callers on a different reader.

The two protected GET routes call the same owner with the request AbortSignal;
query parsing accepts only build/inventory/generation/root/page identities. Existing
Host/Origin/session controls, `CatalogError` responses and unavailable states remain.
`lookupCodeSymbols` also calls `snapshot` twice, so snapshot equivalence must cover
exact-symbol search, not just path capture. File pages/details and automatic/manual
analysis controls share the same analysis service. Its synchronous start/resume
admission remains outside the worker read scope.

Catalog indexing, orientation, legacy `codeFlows`, answer interfaces, candidate
links, corrections/reapplication, maintenance and history reads are not implicitly
scoped or redirected. A store helper is not a service-wide cache. Unrelated or
overlapping calls use fresh preparations. Nested calls must not borrow the active
scope; expired asynchronous descendants also execute fresh. Writes and explicit
SQLite iterators are unchanged. No transaction may span a cooperative yield.

The browser serializes path reads and fences late responses by selected index,
inventory/generation, request sequence and component lifetime. Preserve collapsed
startup, four-root pages, selected/default paths, source evidence clearing, explicit
retry, coverage gaps and static-candidate language. A later v2 producer requires
matching wire types and explicit generation invalidation; it cannot reuse a v1 ID
or transfer a correction based only on node labels.

## Required invariants and checks

| Boundary | Evidence required for integration |
| --- | --- |
| Original validation | Full `CodeAnalysis.file` hash, original Git blob, ranges, evidence, input identity and payload checks, including corruption in an undisplayed fact-free file. No selected-path early scan exit. |
| Complete resolution | Same saved-tree metadata, every file/domain/gap, all ambiguous alternatives, full source scope, work charges and consumed digest. Distinct per-file evidence survives canonical sharing. |
| Request lifetime | One path owner per catalog; busy refusal, cancellation, repeated stop, failure cleanup, nested/overlapping read scopes in both directions and fresh authorization after writes. |
| Worker lifetime | Fresh execution/parameters and exact SQL write behavior on identical stopped copies; pause/resume/cancel/restart, ownership guard, cleanup/resume race, parser/policy/source fences and partial publication. Normalize only elapsed timings in comparisons. |
| Snapshot | Exact manifest bytes for empty/mixed/escaped inputs; late corruption/count/byte/ordinal failure; iterator release; symbol lookup and both initial/final path snapshots. |
| Publication/history | Complete originals and dependencies, concurrent external writer, final synchronous guard, idempotency and cleanup, then exact recorded bytes after inventory eviction. History must not derive replacement paths or read fact payloads. |
| HTTP/browser | Actual protected routes and built browser: missing facts, default/selected/page/isolated paths, originals, historical index, busy/retry, ignored-cancellation late responses, source/policy changes, desktop and 390 px. Use owned fixtures, not the prepared user demo. |
| Compatibility | No schema migration, parser fingerprint or stored inventory payload change for representation-only work. Reopen a pre-change stopped catalog; preserve legacy projection IDs/bytes, search, answers and review history. |

## Preserving meaningful historical tests

Current ordinary tests are intentionally coupled to the old source. In particular,
`worker-reads.test.ts` and `canonical-pair.test.ts` compare manifests with production
file hashes. The worker comparison expects an unscoped baseline; after production
scoping, layering the old wrapper would create nested scopes and test a different
composition. `streaming-snapshot.test.ts` calls the old prototype as its reference;
changing that prototype silently would remove the independent control.

Do not update old frozen hashes to bless changed production, delete those assertions
or pretend a production-vs-production comparison retains the original evidence.
Before modifying those production dependencies, preserve the exact required baseline
source in a bounded **test-only reference fixture**, with original revision/path/hash
and explicit import relocation mapping. Validate the archived bytes and deterministic
relocation. Pin the minimal runtime dependency closure; unchanged dependencies still
have hash checks. The reference must run in a shallow CI checkout without network,
Git history, generated `dist` or access to local old worktrees. No giant source-tree
snapshot, dynamic source rewriting in production or historical family replay.

Adapt ordinary comparison tests explicitly to that reference, with a recorded migration
map from each old test to its preserved assertion/new production counterpart. Cover
original SQL execution and unscoped preparations, streaming manifest equivalence,
complete receipt identity and refusal behavior. Keep all measured scripts, original
manifests and archived reports byte-identical. Build changes are new identities, so
old probes correctly refuse execution against changed dependencies.

## Bounded delivery sequence

1. **Task 099: typed internal resource primitives.** Implement the read-scope owner,
   one immutable canonical pair and shared operation budget as local TypeScript
   modules, with direct independent behavioral comparisons to the frozen helpers.
   Keep them unconnected to current services. This proves typed behavior and error/
   ownership boundaries without changing frozen production dependencies or wire IDs.
2. **Representation integration.** First establish the minimal test reference above;
   then stream snapshots and integrate read scopes/compact canonical entries into
   the existing production v1 services. Preserve exact v1 output and every caller.
   Full strict checks and actual protected HTTP/browser checks are mandatory. This
   change does not import the literal-topic resolver or publish offline receipts.
3. **Final-composition qualification and release.** Freeze fresh source-authored
   inputs and explicit v1/composed expectations before application observation.
   Exercise the actual compiled production services in both required processes,
   keeping all operation/resource/support gates and first artifacts. A test-only
   adapter may compose the unchanged offline receipt format only when its exact
   identity translation is declared and checked; it cannot be reported as a native
   production receipt. Passing Task 097 alone does not satisfy this boundary.
4. **Versioned literal-topic/receipt integration.** Separately port the typed rule,
   witness, resolver/admission and capture boundary under new identities, preserving
   all conservative losses. Requalify that final composition before switching the
   browser. Decide durable storage/purge/recovery before any receipt endpoint or
   answer/review consumer. Follow the existing consumer order and independent gates.

Each implementation step needs its own bounded task/acceptance contract before
edits. Do not broaden Task 099 into service wiring merely because the helpers pass.
No new input fields or manual cache controls are needed for the user.

## Rollback and limits

Representation changes alter transient ownership only. Rollback uses the preceding
application build against the same stopped catalog; keep the existing backup/startup
procedure. No automatic history rewrite, inventory reparse, receipt conversion or
background cleanup is required. Verify backward reopen on owned copies before
release. A new derivation adapter instead needs explicit versioned history support;
unsupported saved formats fail closed without recasting their content as v1.

Keep fixed 5,000 ms / 1,000,000 work / 150 ms sampled interval / 384 MiB RSS / 64 MiB
heap growth and output/source bounds. Sampling and cooperative checks are not hard
interrupts for synchronous SQLite/parser calls. The successful marker-heavy run does
not cover arbitrary dense facts, every OS/runtime or long-term process growth.
Independent/private-pilot acceptance, question relevance, semantic model evaluation
and L5/Workbench routing remain separate. Preserve all earlier rejected gates.
