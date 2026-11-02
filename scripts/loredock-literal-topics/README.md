# Offline literal-topic candidate

Task 073 only. The production service, API, browser, persisted history and all legacy
consumers retain their existing adapters. The [design](../../docs/loredock/EVENT_TOPIC_EVIDENCE.md)
defines the accepted literal syntax, evidence and unknown runtime scope.

`paths.mjs`, `resolve.mjs` and `admit.mjs` are explicit offline forks of the typed service
at `c3bb8ff`, with source hashes in `baseline.json`. They inject the existing saved-tree,
binding-domain, work/fencing and declaration services, so normal tests use source modules
without a prebuilt application. No runtime source rewriting or monkey-patching is used.
The changed resolver compares exact supported literals and carries complete endpoint
evidence in `topicCheck`; generation identity binds the rule and its byte limit. Admission
retains the full witness in its complete-output budget. The fork uses distinct resolution,
wire/display, adapter and receipt namespaces.

`receipt.mjs` forks Task 071's trusted-local capture/history prototype with strict support
for the new identities and topic witness. A witness must match each endpoint expression,
kind and full original-support list. Non-event edges cannot carry one. The original reader
and artifacts stay unchanged. Hashes establish local integrity, not external authenticity;
there is no external receipt-import endpoint or production persistence migration.

`probe.mjs` is an opt-in **one-run** qualification, not a CI test or a general command.
The [frozen protocol](../../fixtures/loredock-literal-topics/README.md) governs execution
and stop conditions. Its observer saves exact raw returns, errors and receipt bytes before
oracle, mutation or resource assertions. Expected refusals must originate from the operation
and be normalized domain errors; an observer assertion cannot count as a successful refusal.
Typed expected identities distinguish same-label references and symbols.

Independent small regressions live in `apps/loredock/tests/literal-topics.test.ts` and
`scripts/tests/loredock-literal-topic.test.mjs`. They never load the frozen corpus/probe.
Ordinary checks do not run a model or this qualification. A passing small experiment would
still require a separate scale/integration review before production adoption.
