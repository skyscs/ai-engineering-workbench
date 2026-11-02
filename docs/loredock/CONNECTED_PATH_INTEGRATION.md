# Connected paths: application integration contract

Status: Phase A qualified by Task 067; Phase B implemented by Task 068, 2026-11-02.
[Task 064](../../tasks/064-loredock-connected-integration-contract.md) established this
sequence after review against `9f9f080`. The typed backend/endpoints are now available;
the browser interface below remains the next phase. See the implemented
[API contract](CODE_PATHS_API.md) and [ADR 0049](../decisions/0049-loredock-connected-path-reads.md).

## Decision and evidence

Add a small, optional source-path browser after a separate scale qualification. Reuse the
existing saved code inventory and original-evidence reader. Keep the current graph consumers
on their existing adapter during the first integration. No new model, configuration form,
database schema, stored graph or background analysis owner is needed for this slice.

[Task 063](../fixtures/loredock-connected-admission/README.md) passes 306 checks on fresh
synthetic inputs. Resolving supported bindings before display admission preserves seven
required nodes through 221 files and separate dense files. Missing or truncated alternatives
block positive uniqueness. Two displayed roots, a twenty-node path bound, traversal limits
and unsupported syntax still leave substantial context unknown. Its 600-file prototype
limit and cooperative five-second deadline do not qualify production inventories of up to
10,000 files. This contract adds no semantic, runtime, routing or independent-pilot acceptance.

## Current integration seams

| Existing component | Observed behavior | Integration consequence |
| --- | --- | --- |
| [CodeAnalysis](../../apps/loredock/src/code-analysis.ts), [limits/types](../../apps/loredock/src/code-analysis-types.ts) | One owner per catalog; at most 10,000 units, 50 MiB examined source and 16 MiB payload. Snapshot validates manifest/checkpoints; file reads validate facts against originals. New attempts retain the newest published inventory plus the new attempt. | Inject the existing service. A complete original index can outlive its disposable facts. Original validation is real work, even with saved parser output. |
| [CodeAnalysisFollow](../../apps/loredock/src/code-analysis-follow.ts) | Follows new index publications; existing/manual/interrupted attempts are not automatically retried. | A path GET must never start analysis, resume it, or create another follower. |
| [Protected API](../../apps/loredock/src/app.ts) | Loopback Host/Origin, browser session, no-store reads and CSRF on mutations. | Add reads inside the existing boundary. Accept catalog identities, never arbitrary filesystem paths; expose no raw fact-payload endpoint. |
| [CodeInventory](../../apps/loredock-web/src/CodeInventory.tsx) | Shows the latest attempt for the selected build, including an unpublished attempt; polls progress and fences file/detail responses. | Path availability uses the latest compatible **published** inventory. A newer pending attempt does not invalidate an older usable inventory by itself. Explain this distinction in the expanded view. |
| [CodeFlowsView](../../apps/loredock-web/src/CodeFlows.tsx), [SystemMap](../../apps/loredock-web/src/SystemMap.tsx) | Static outlines, candidate header comparisons outside those outlines, link corrections and earlier notes share projection identities. | Preserve these cards and their review controls. Mount a separate collapsed path browser alongside them. |
| [Corrections](../../apps/loredock/src/corrections.ts), [reconciliation](../../apps/loredock/src/reconciliation.ts) | Writes recompute `inputHash`; immutable snapshots and adapter checks govern reapplication. | New root/edge IDs cannot inherit old corrections. No review controls on the first connected-path preview. |
| [Candidate links](../../apps/loredock/src/candidate-links.ts), [answer interfaces](../../apps/loredock/src/answer-interfaces.ts), [answer validation](../../apps/loredock/src/answer-context.ts) | Use the current `codeFlows` derivation; answer publication verifies it again. | Replacing that function could change an in-flight answer when a new inventory appears. Leave these consumers on their existing contract. |
| [App evidence state](../../apps/loredock-web/src/main.tsx) | Policy/registry/index changes and request generations fence original responses. Inventory, root and root-page identities are absent from that boundary. | Thread `clearEvidence` into the new view, and invalidate pending originals on each new path context. |

## Smallest user flow

Inside System map, add a collapsed **Browse connected paths** section. Opening it reads the
selected index's compatible published facts. Its first response shows up to two default paths,
four supported entry points and a compact coverage line. The default root order remains the
qualified role/source/path/symbol order; it is a deterministic reading order, not importance
or incident relevance. Opening the section never sends source text to a model.

Each entry-point button names its source, file and symbol. **Next entry points** and
**Previous entry points** move through four-root pages. Choosing one root displays one
complete supported path from that root, replacing the default pair; **Show default paths**
restores the pair. Page changes clear the selected path and pending original evidence. No
user-entered root IDs, graph budgets or repository selection are required.

Use **Partial source paths** and **Static connection candidate** as visible qualifications.
Show examined/retained files, supported entry points, roots outside this page and path/branch
omissions. Expandable details contain parser gaps and budget reasons. Distinguish roots
outside the page from roots outside the selected paths. A page enumerates supported roots
in this resolution, not all possible system entry points. A missing path is never proof
that no execution or dependency exists. Preserve isolated roots as inspectable entries.

Original-span buttons use the existing evidence panel. The first view does not accept
engineer corrections on the new graph; explain that existing reviewable links remain in
the current static-flow section. Do not label an unreviewed preview as approved, or count it
as answer context. Keep header-comparison cards outside the chosen paths visible where they
are today. This avoids losing useful clues merely because two outlines omit them.

If facts are missing or incompatible, link to the existing **Code coverage** controls. The
existing explicit analysis action remains responsible for historical indexes. While an
attempt is running, explain whether paths use an earlier completed inventory or are waiting
for the first one. Do not add an automatic retry loop for failed, cancelled or interrupted work.

## Identity and lifetime

The production types must have a version distinct from `loredock-code-flows-v1` and the
offline `task063-connected-v1` probe. A generation identity binds, in canonical order:

- selected build ID, saved source-set version and current registry/policy versions;
- inventory ID, parser fingerprint, manifest hash and analysis limits;
- resolver/selection versions and all effective read, resolution, display and work limits;
- declaration adapter/input identity used for cross-repository comparisons.

Define `generationId` as the hash of that identity. Root IDs derive from the generation plus
the original source/file/symbol identity. Define `projectionId` from the generation, request
selection and complete bounded result, excluding timings. Page and explicit-root requests
pin a generation; results cannot silently substitute a newer run. Repeated reads of unchanged
facts must preserve IDs, path order, evidence and omission counts. Timings are diagnostic,
not content identity. IDs and hashes are provenance, never authorization tokens.

The original source blob and issued span remain citation authority. Revalidate every consumed
file through `CodeAnalysis.file`; validate all output support against the selected index.
Recheck snapshot identity, authorization and current registry/policy after asynchronous work
and immediately before publication. Missing or corrupt source/fact bytes discard the result.
A registry addition, removal, policy edit or inventory eviction during work also discards it.
No partial graph, old source names, pending payloads or consumed evidence IDs survive that
failure response. Authorized requests may echo their requested build/generation IDs only.

Existing historical-index rules still apply. A retained compatible inventory can serve its
authorized historical build with an explicit older-index label. An evicted inventory returns
unavailable even if originals remain readable; never run analysis or fall back to a different
build as part of a read. Previously saved answers, review snapshots and original evidence
remain governed by their existing contracts. The first integration stores no connected graph
history whose readability would depend on disposable facts.

## Proposed bounded read contract

Use one injected read service for both endpoints; perform complete authorization and bounded
resolution for each request. Initially allow one active connected projection per catalog,
reject concurrent work as busy, and keep no persistent or unbounded cross-request cache.
Other catalog reads and analysis controls must remain responsive. A browser serializes its
own requests, ignores stale results and offers an explicit retry after busy/failure.

| Proposed GET | Inputs | Successful result |
| --- | --- | --- |
| `/api/code-paths` | Required `buildId`; optional paired `inventoryId` and `generationId`; optional `rootId` only with that pair. | Default pair when no root is chosen, or one explicitly chosen root path; first four entry points; identity, coverage, limits, original support and omissions. An unpinned request selects the latest compatible published inventory. |
| `/api/code-paths/roots` | Required `buildId`, `inventoryId`, `generationId`, and nonnegative four-aligned `offset`. | At most four root cards, total supported roots, preceding/following page information, identity and bounded coverage. No graph or full retained-fact vectors. |

Reject unknown, duplicate, malformed, oversized or incompatible parameters before scanning.
Root IDs must occur in the requested generation; foreign/stale roots are invalid. Reject an
out-of-range page instead of silently resetting it. Pin the root catalog to the same complete
resolution universe used for path selection, including all competing alternatives outside
the display/page. Root pages do not change matching semantics.

Every successful wire envelope, including evidence, root cards, coverage, gaps, IDs and
limits, fits **512 KiB**. Keep display caps at 160 nodes, 240 edges, two default paths or one
chosen path, and twenty nodes per path. Admit an entire path with all node/edge/flow support
or omit it with a reason. Root-page support is admitted atomically too. An entry that cannot
fit must remain counted with an explicit unavailable entry; never silently shorten citations.
The offline probe's full `resolution`, `payloads` and `units` vectors are diagnostics and
must not become HTTP response fields. Bound gap summaries by source/reason with omission
counts; do not accumulate unbounded per-file path lists in responses.

Keep availability distinct from coverage:

| State | Required behavior |
| --- | --- |
| Available, complete retained-fact scan | Publish bounded paths/root cards with `partial: true`; retain unsupported syntax, candidate-hop and display omissions. Zero roots does not establish absence. |
| Missing/unpublished/incompatible/evicted inventory | Return a structured unavailable reason with no graph; direct the UI to existing coverage information. |
| Source parser gaps or excluded/unattempted files | Mark the affected source incomplete. Preserve the qualified conservative rule: no positive same-source uniqueness depending on unseen alternatives. Show the resulting shorter/unresolved path. |
| Fact/resolution universe, time or memory/work bound exceeded before complete resolution | No claimed unique bindings from a truncated universe; return unavailable with the limiting stage/counter. |
| Candidate-comparison cap reached | Retain partial candidates and counted omissions only under the qualified comparison semantics; an unexamined pair is never confirmed absent. |
| Traversal/depth/display bound reached after complete resolution | Publish only atomic supported paths, with exact counted omissions and a bounded-work limitation. Do not call the selected branch globally best when traversal was cut short. |
| Integrity or authorization/scope failure | Use existing protected error semantics; discard pending results and source-derived details. |
| Busy or client-abandoned request | Do not queue unbounded work. Release owned resources; a stale request never publishes into the current view. |

Error responses also fit a small bounded envelope. Do not include raw exception payloads,
source content or SQL. Server work limits are fixed/reducible internal options, not public
query parameters. The five-second prototype deadline is cooperative, not a hard process
isolation guarantee; the production qualification must measure maximum uninterrupted work.

## Browser request fences

The request key includes the existing policy/registry/selected-index/published-index boundary
plus inventory ID, generation ID, root/page selection and a monotonically increasing request
number. Reset graph, root page and evidence before changing selection. Pass `clearEvidence`
through `SystemMap`; this invalidates an original response already in flight even when the
source/index boundary did not change. Collapsing/unmounting the view invalidates its requests
and any original opened from it. Abort owned fetches where useful, but correctness must not
depend on browser cancellation succeeding.

Use the existing lightweight analysis state while the section is open to detect a newly
published compatible inventory or loss of the pinned one; do not repeatedly recompute the
graph on each progress poll. On a new published generation clear the old view and selection,
then load the default paths once. A newer unpublished attempt leaves the old published view
identified as such. A failed pinned-page/root request displays its reason; it does not retry
against another generation under the old selection. Source/policy/index changes always win
over pending graph, root-page and original-response completion.

## Qualification before production integration

The current experiment scans at most 600 files, counts at most 10,000 symbol/operation/call/
record facts, and bounds resolution nodes, edges, binding records and alternative references
at 12,000 each. Its simple repeated scans and synchronous resolution are not a production
scale argument. Raising the file constant alone could exhaust fact, ambiguity, time or event
loop budgets before the critical path is examined.

The next task must freeze a **fresh** owned corpus, oracle, resource thresholds and one-run
measurement protocol before implementation/observation. Do not rerun Tasks 044, 048, 062 or
063 or adjust their retained outcomes. The prospective scale matrix should cover:

- Twenty sources with fresh small-code shapes at 600, approximately 3,600 and 10,000 files,
  plus a low-volume control; keep source/payload sizes within existing analysis limits.
- Admitted fact universes below internal caps, and separate deliberate fact/node/edge/
  alternative/payload-limit cases whose expected outcome is explicit unavailability.
  A 10,000-file inventory does not imply that every fact-rich input can be resolved.
- Critical files late in inventory order, alternate same-name targets outside page/display
  slots, parser truncation, missing target analysis and changes in source registration order.
- Wide branches, cycles, more than four roots, later-page isolated roots, equal-score paths
  and the traversal/pending-path bounds. Preserve complete original support and deterministic
  tie-breaking; count roots/branches that cannot be shown.
- Per-stage wall time, total wall time, maximum event-loop delay, peak RSS/heap with a stated
  sampling method, serialized envelope size and deterministic work counters. Report process
  baseline and hardware; cooperative time and sampled RSS must not be overstated.
- Original reopening, zero Git calls and zero store writes outside separately instrumented
  lifecycle hooks; source addition/removal, policy change, inventory eviction and cancellation
  at read, resolve and admission yields. Corruption at original and derivative boundaries.

Build lookup indexes by source/path/exported name, Java qualified/simple handler identity,
operation owner and record/consumer identity. Retain **all** alternatives or a complete
count plus supported ambiguity explanation; no first-match or display-limited uniqueness.
Measure and cap total indexed references/work as well as nodes. Yield and recheck cancellation,
scope and deadline inside resolution and path enumeration, not just between file reads.
Keep the selected path/ambiguity semantics fixed while changing the lookup mechanism.

Freeze concrete pass/fail time, memory, responsiveness and supported-input thresholds in
that next task before running it. They must allow useful successful paths on a declared
large-input family; an implementation that merely rejects every large case is not qualified
for broader use. Inputs outside that family must stop explicitly and promptly. A failed
threshold remains recorded; a successor needs new prospective scope, not repeated tuning
on the same frozen measurement. No performance target in this design is a measured promise.

## Implementation sequence and acceptance

| Phase | Bounded delivery | Required acceptance |
| --- | --- | --- |
| A — prospective scale and work qualification | Freeze fresh scale/branch/lifecycle cases; implement a separate indexed, yielding resolver; retain the first observation and repeats exactly. | Correct complete-universe ambiguity, original support and root/path selection; useful success on the declared large family; measured resource/responsiveness thresholds and explicit boundary failures. Reject promotion on failure. |
| B — typed backend and protected reads | Port only the qualified reader/resolver/admission contract, generation/root identity and bounded endpoint envelopes. Reuse the existing analysis owner; no schema change or old-consumer switch. | Integration checks for protected reads/invalid parameters, missing facts, foreign roots/pages, complete envelope limits, scope/corruption/eviction races, busy/cancellation and zero read-side mutations. Verify unchanged answer/correction/candidate behavior. |
| C — simple path browsing | Collapsed section, default paths, four-root navigation, chosen-root inspection, original buttons and explicit coverage/unavailability. Update the user guide and architecture/security decision records with implemented behavior. | Isolated synthetic desktop and narrow-screen browser checks; keyboard/focus and empty/error states; delayed root/page/inventory/index/source/policy/original responses never restore stale content. Preserve the owner's running demo and data. |
| D — broader consumers, separately scoped later | Decide whether and how answers, candidate routing and engineer review should use the new projection. Design saved provenance/reapplication compatibility first. | New independent semantic/review qualification and applicable private-pilot gates. No automatic migration of old targets or reinterpretation of saved answers. |

Keep each phase reviewable as its own task/PR, commit scope and prospective inputs before
implementation, and merge only after both push and pull-request CI succeed for the exact
head. The owner's authorization permits continuing this sequence without waiting for a
new command. It does not convert synthetic or agent verification into product acceptance.
The existing failed semantic evaluations and exhausted model budgets remain unchanged.

## Task 065 result: Phase A remains unqualified

The [fresh scale run](../fixtures/loredock-connected-scale/README.md) reads 9,975 code files
within its prospective resource bounds, but 23/628 checks fail. Literal descriptor files
produce TypeScript profile gaps, and the conservative whole-source rule suppresses otherwise
supported import and Java bindings. Useful paths, root counts and branch exercises fail.
All first observations and the original oracle remain retained; no replacement run occurs.

Before Phase B, specify a new completeness boundary for each binding search and qualify it
on fresh positive/negative inputs. Known import target paths and Java-only candidate domains
may permit narrower uncertainty, but unknown index paths, missing/excluded targets and parser
truncation must remain blockers. Resource success alone does not qualify Phase A or authorize
production adoption. Existing graph/answer/review/candidate consumers remain unchanged.

[Task 066's completeness contract](BINDING_COMPLETENESS.md) specifies exact supported import
paths and conservative Java candidate domains, with separate cardinality and incompleteness.
The saved code manifest alone cannot establish absent paths when source shares omit entries.
Bounded source/file metadata, recorded-tree verification and opaque-boundary handling must
therefore join the fresh qualification before Phase B. Parser facts and existing consumers
remain unchanged; this contract is not a qualified implementation.

## Task 067 result: offline Phase A gate passed

The [fresh binding-coverage qualification](../fixtures/loredock-binding-coverage/README.md)
passes all 1,031 checks, preserving useful paths and all relevant uncertainty through
9,975 code files within the prospective resource bounds. It verifies complete saved paths
against recorded trees, with exact import-path and conservative Java candidate domains.
Task 066's domain rules supersede the earlier whole-source incompleteness rule for the
qualified successor. Task 065's failure remains retained.

Phase B may now be scoped separately. Port the qualified interpretation into strict types,
then qualify the proposed protected envelopes, root pages, cancellation/busy behavior and
generation lifetime against the actual analysis owner. The offline prototype rejects any
database write during a read; explicitly assess newer unpublished analysis activity and
conservative retries during integration. Existing graph/answer/review/candidate consumers
remain on their current adapter. No HTTP or browser feature is delivered by this gate.

## Task 068 result: Phase B backend available

The typed service and protected path/root-page endpoints now implement the qualified
binding-domain interpretation, original support and generation/projection identities.
Four-entry-point pages preserve isolated roots and explicit unavailable entries when
complete support cannot fit. No fact/resolution vector is exposed by HTTP.

One read per catalog, request cancellation and shutdown release are explicit. The
conservative write fence rejects a pending read during concurrent database changes;
it does not unpublish an older usable inventory. Small parity, integrity, lifecycle,
HTTP and real TCP cancellation checks cover the port. No frozen volume run is repeated.

Phase C browser integration is next. Existing graph/answer/candidate/review consumers,
history and schema remain unchanged; the new paths are not approved investigation scope.
