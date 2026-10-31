# Task 018 — Source-backed code links and static flow outlines

Status: accepted through the owner's merge of PR #22 (`25032fd`), 2026-10-30.
Task 017 was accepted through merged PR #21
(`a551f3c`); the owner explicitly requested continuation.

## Objective

Follow the synthetic Vue/TypeScript and Dojo order paths through declared HTTP
routes, Java handler/publisher code, a candidate subscriber and its document write.
Open original evidence for every step and distinguish syntax-supported local links
from unresolved cross-repository wiring. This is a bounded second L3 slice.

## Implementation boundary

- Keep the declaration-map v1 contract and original source catalog unchanged.
  Add a separately versioned read-only code/flow projection and protected endpoint.
- Parse the installed TypeScript compiler's AST without loading project configuration,
  resolving packages, emitting/running source, or reading outside stored indexed files.
  Support top-level named functions, relative named imports, literal fetch requests,
  the fixture's narrow Vue script-setup/button envelope and Dojo AMD request module.
- Use a conservative bounded Java lexical/structural adapter for top-level classes,
  records, declared interface receivers and direct method calls. Recognize the
  synthetic EventPublisher, KafkaSubscriber and MongoCollection interface profiles;
  do not advertise framework-wide Kafka/MongoDB or reflection analysis.
- Resolve same-source unique route-handler references. Compare HTTP method/path and
  complete supported record/contract shapes for candidate cross-source hops. Names
  alone, equal settings and unknown environments cannot prove runtime connections.
  Parameter/config binding, subscriber dispatch, brokers, concrete collections and
  deployment coherence stay explicit gaps unless the code establishes them.
- Produce at most two bounded flow outlines for the pilot; disclose any truncated
  work. No model calls, schema migration, source mutation or new external package.
  Promote the already locked compiler to a declared runtime dependency.
- Reuse immutable evidence, policy/revocation fencing, selected-index freshness,
  escaped text rendering and late-response guards. No durable graph edits or routing.

## Acceptance

- Both client paths reach the shared Java handler and publisher. The subscriber and
  replaceOne steps appear only through visibly candidate, cited hops with wiring gaps.
  Every node/link/flow references retained original issued evidence and stable IDs.
- Comments/string lookalikes, shadowed functions, dynamic URLs, ambiguous imports or
  handlers, different record shapes and distinct explicit environments cannot create
  asserted links. Unsupported syntax remains a visible gap and searchable raw text.
- Tests exercise resource limits, partial/empty graphs, corruption/missing spans,
  revocation, policy, pinned history, restart and protected HTTP transport.
- Browser acceptance opens a flow citation, checks candidate/gap labels, historical
  selection, removal/policy/reindex/restart, escaped source content and 390px layout.
  Record the frozen fixture's original revision vector and unchanged checkouts.
- Full checks and the existing cited-answer browser regression pass without real
  model calls. Commit English documentation and reproducible acceptance artifacts.

## Verification record

`pnpm check` passes strict typechecks, production builds and 216 tests, including
65 LoreDock tests. Production evaluation of the original frozen corpus yields two
outlines (10/nine steps), four candidate code links and ten resolving evidence records.
Browser acceptance covers the new flows and existing source lifecycle at 390px;
the answer-browser regression uses four fake invocations and zero real model calls.
An initial browser failure exposed citation clicks dropped during the old shared busy
handler. Reads now have independent latest-selection/boundary guards, verified by a
deliberately delayed older response. See [review evidence](../docs/fixtures/loredock-static-flows/README.md).

## Follow-up

Durable relationship corrections and derivative invalidation follow in
[Task 019](019-loredock-engineer-corrections.md). Real-framework adapters,
broader Overview/Guide Me, scale acceptance,
automatic repository routing and the Workbench bridge retain separate milestones.
