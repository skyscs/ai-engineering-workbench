# LoreDock draft review and Workbench reuse audit

Reviewed on 2026-09-28 for the owner's change of priority. This is a planning artifact;
no LoreDock capabilities are claimed as implemented.

## Inputs and authority

- Owner request: preserve the current Workbench implementation, prioritize system
  understanding across approximately 20 repositories, then return to investigations
  that select their own relevant repositories.
- Owner clarification: documentation is mainly README files; the stack includes
  Java, JavaScript, TypeScript, Vue, Dojo, Kafka and MongoDB. Specific frameworks,
  versions, build tools, deployment topology and contract formats remain unknown.
- Supplied `LoreDock_TZ_v0.1_draft.md`, version 0.1 discovery draft, dated 2026-09-10,
  including appendices A–E. SHA-256:
  `ffc3225a3a4f9ef39cf96ff8cd0c8030f800b1237aac190d987fd982bdaa5a8d`.
  The original user-supplied file stays unchanged outside this repository. The ZIP
  and separately named files referenced inside it were not supplied as review inputs;
  this review uses the inline appendices, not presumed extra contents.
- Local Workbench baseline: commit `f758026`, including the completed primary-flow
  implementation and configuration fix. This audit does not assume PR #16 is merged.
  Historical verification is recorded in [development status](../development-status.md).

The supplied text is a discovery draft. Its embedded future-agent prompt and earlier
“return after Workbench” status do not override the owner's current planning request.
The direction has changed; product code has not.

## Assessment and changes

The draft already provides a strong foundation: immutable source revisions, evidence,
system-level entities, explicit gaps, scoped conflicts, updates, retained history and
separation of local storage from remote inference. Keep these properties.

| Draft area | Decision for the new objective |
| --- | --- |
| Main §§1–4: Guide Me and Ask Project | Keep both, but make the persistent system model the first product asset. A minimal guided overview is enough initially; advanced learning personalization follows the context/investigation bridge. |
| Main §§5–7: text MVP and pipeline | Keep text-first ingestion. Prioritize README plus code/config/contracts for the confirmed Java/JS/TS, Vue/Dojo, Kafka and MongoDB stack. Avoid spending the first iterations on wiki connectors or slides. |
| Main §8, appendix A: snapshots | Add an explicit cross-repository revision vector and deployment-coherence status. Independently captured HEADs are not a proven deployed system. |
| Appendix A §§2,5: entities and relations | Separate repository, service, module, topic, collection and external dependency. Include producer/consumer and data-access links; preserve ambiguous aliases and environment-specific identities. |
| Main §10; appendix C AC-12/13: long builds | Deliver work-unit checkpoints, deduplicated publication, budget stops and honest pause/cancel/restart behavior alongside the first AI build. Do not wait for final hardening. |
| Appendix A §7; appendix C AC-08 | Invalidate additions and negative-query assumptions as well as old citations. A newly discovered consumer or config can change a flow without editing a cited producer file. |
| Appendix B §§3,5,6: source/runtime restrictions | Retain as a feasibility gate. Current Workbench read-only execution is not evidence of an OS-enforced read allowlist for LoreDock. A prepared directory alone does not create that boundary. |
| Appendix B §§7,8; appendix C AC-09 | Implement immediate access fencing with first source persistence. Define purge and export limitations early; retained answer history must not bypass revocation. |
| Main §12; appendix D P-06: bridge | Keep independent data ownership. Design a versioned Context Pack early; implement it after useful knowledge. Markdown can trial the idea but cannot satisfy production provenance, freshness or automatic repository routing. |
| Appendix C L0–L7 | Reorder around context quality: scope → sources → small cited answer → system relations → updates → 20-repository acceptance → Workbench bridge. Keep simple review in the first system-map milestone. |
| Appendix C quality rubric | Retain 20 known questions, add 10 incident-routing cases and heterogeneous scale tests. Measure missing relevant repositories as well as concise candidate sets. No fabricated confidence percentages. |
| Main §3.2: language preference | Generated artifacts, UI, comments and explanations remain English under the owner's standing requirement. Non-English questions should still retrieve English evidence correctly. |

## What actually exists in Workbench

| Existing implementation and evidence | Reuse decision and missing work |
| --- | --- |
| [`packages/git`](../../packages/git/src/index.ts): source inspection, clone/fetch, common-git-dir locking; worktree lifecycle and pinning | Reuse audited primitives. Add bounded object enumeration/extraction and independent LoreDock snapshot ownership. Existing in-process locks do not coordinate two separately running applications. |
| [`packages/ai`](../../packages/ai/src/types.ts): CLI subprocess adapter, structured output, cancellation, selected connection/profile, preflight | Reuse execution behavior after a focused extraction/adapter. `AIRunRequest` currently imports `RunInputSnapshot` and uses task/run IDs; it is not a provider-neutral knowledge-job contract yet. |
| [`RuntimeService`](../../apps/daemon/src/runtime-service.ts): task-owned invocation, evidence validation and report publication | Leave investigation-specific orchestration in Workbench. LoreDock needs multi-unit builds, source-span evidence and its own publication model. |
| [`packages/storage`](../../packages/storage/src/index.ts): SQLite owner lock/migrations, artifacts, task runs, immutable reports and invalidation | Reuse design and small utilities where justified. Do not call Workbench `openStorage` on LoreDock data or copy its task schema wholesale. Source revocation and knowledge retention are new semantics. |
| [`LaunchService`](../../apps/daemon/src/launch-service.ts) and [`drafts`](../../packages/storage/src/drafts.ts): persistent preparation, request replay protection, explicit retry | Reuse lifecycle lessons. One investigation launch is not a resumable scheduler for processing an entire corpus. |
| [`app.ts`](../../apps/daemon/src/app.ts): exact local Host/Origin, session and CSRF protection | Preserve this baseline in the new daemon. Application-to-application context exchange needs its own scoped, explicit pairing contract. |
| Reports, original evidence, human challenges/constraints, export and `/advanced` | Preserve as the eventual consumer. This is a useful investigation engine, not wasted work. |

Code limits that matter: the primary draft accepts at most 16 selected repository IDs
([parser](../../packages/core/src/drafts.ts)); the underlying task API allows 32
([task types](../../packages/core/src/tasks.ts)). Composer text shares a 1 MiB-or-lower
budget. These are not a 20-repository ingestion strategy. LoreDock should inventory
all project sources, then give each bounded question/investigation a relevant subset.
Do not begin this pivot by simply raising those limits or sending the entire corpus.

No persistent system knowledge model, source extraction/search index, cross-service
identity map, knowledge builds, general Ask Project, automatic routing or structured
Context Pack import exists in the reviewed implementation. Workbench's domain task
constraints are not project-wide knowledge corrections. Its existing report dependency
tracking does not automatically implement source-level knowledge invalidation.

## Missing nuances that now become requirements

- README-only documentation rarely establishes production topology or architectural
  intent completely. Source/config evidence and short engineer clarifications are
  necessary; undocumented rationale remains unknown.
- Java framework/build conventions and Kafka client wrappers must be detected before
  choosing adapters. Do not assume Spring, Maven, Gradle, a schema registry or OpenAPI.
- Vue routes/components and legacy Dojo modules may reach the same backend through
  wrappers and configuration. HTTP call discovery must retain unresolved endpoints.
- Kafka topic names can come from expressions/configuration. Producer, consumer group,
  key/partition assumptions, message shape and environment belong in the model when
  supported. A similar string is insufficient to prove a connection.
- MongoDB query/model/index/migration evidence describes intended accesses and shapes;
  it does not establish live data contents, observed runtime schemas or an executed
  migration. No database credentials or cluster connection is needed for the text MVP.
- Shared libraries, infrastructure repositories and missing external systems can be
  the relevant boundary for a defect. Routing must search beyond familiar service names.
- Initial-build cost, repository size, framework coverage and source access are unknown.
  Benchmark before committing to budgets, background scheduling or embedding providers.

## Remaining decisions

L0 records the actual framework/module variants, first document formats, source policy,
allowed model connection, measured budget and runtime feasibility. Default recommendation:
Linux, local application, separately owned data in the existing repository, synthetic
fixtures first, one AI worker, no automatic installation/execution and no real corporate
sources in public tests. Repository creation, licensing and product naming are not
silently decided by this planning change.

The actionable sequence and acceptance gates are in [PLAN.md](PLAN.md); the first
bounded implementation assignment is [Task 014](../../tasks/014-loredock-scope-and-fixtures.md).
