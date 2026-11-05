# Independent browser replay and question-edit cases

The [browser case functions](../../../scripts/loredock-prepared-flow/network-cases.mjs)
accept a complete stopped catalog checkpoint and question. Each verifies and copies that
checkpoint, then starts the actual compiled UI with the controlled runtime. Chrome CDP
holds or drops actual server responses at the network boundary. Application methods,
fetch and clocks are unchanged. Both cases explicitly retain fault provenance and
exclude their timing from resource qualification.

The [ordinary entry](../../../scripts/loredock-prepared-flow/network-cases-development.mjs)
runs cold setup, lost admission response, then question edit on separate copies of the
same four-source, twelve-file catalog. It does not interleave later review mutations or
source revocation. The earlier five-scenario network entry remains historical evidence;
these two functions are the reusable R08 subset for later ordered integration.

## Observed behavior

The lost-response case lets the server accept an actual prepared answer, retains that
202 response, then aborts delivery to Chrome. Retry request sends exactly the same JSON
request, including the original request ID, preparation ID and reviewed hash. The browser
opens the saved successful answer; the catalog has one attempt and one witness, and the
controlled runtime reports exactly one prepare/run/close. The retained successful
history checkpoint is created only after Chrome and the daemon stop, for later separate
review/scope cases. Its inherited fault provenance is explicit.

The question-edit case holds the completed review response, edits the textarea, then
releases the original bytes. It waits for that exact network request to finish and two
animation frames before inspecting the DOM. A passive MutationObserver records zero
obsolete-context insertions. The changed question remains visible; neither old context
nor Generate answer appears. The server preparation is cancelled, the answer table is
empty, and all runtime counters remain zero. No extra preparation rescues the result.

The unchanged [replayed answer screenshot](replayed-answer.png) shows the one successful
history entry and saved prepared-context label. The [changed-question screenshot](obsolete-context-hidden.png)
shows Find context with no obsolete context or generation action. Both screenshots were
visually inspected; no image or application modification was used.

## Evidence and limitations

All three functional stages complete without errors and the external owner leaves no
survivors. The run stays **exit 1** because cold startup records a 324.10599 ms raw timer
gap against 100 ms. Browser sampled RSS is 1,364,152,320 and 1,355,345,920 bytes, both above
1 GiB; each browser also retains one incomplete sample. These declared fault cases do
not establish a normal resource pass, regardless of their functional outcome.

[records.json](records.json) retains raw process/browser journals, complete source Git
trees, stopped catalogs, intercepted response bytes, screenshots and verification logs.
Temporary Chrome profiles remain local and are explicitly excluded from portable
archives. Independent inspection checks four source identities, unchanged input trees,
five complete catalog copies with valid integrity/foreign keys, expected answer counts
and exact context/witness/prompt/schema relationships.

The protected client retains 26 response bodies: 23 exact recorded byte sizes and three
redacted sessions. Chrome retains 35 completed API response objects, 19 in replay and
16 in question edit. These are parsed/redacted browser objects, not original byte-size
measurements. The deliberately aborted admission is recorded separately as
`net::ERR_ABORTED`; its complete real response is retained by the fault interceptor.
There is one browser preparation in each case, two identical admission POSTs in replay,
and none in question edit. The held obsolete review demonstrably completes delivery.

Production builds, script syntax, independent retention and the unchanged application/
input seal pass locally. Actual Chrome controls validate the extracted behavior. Both complete final-head CI
events remain required before merging. No application, parser, oracle, limit, model
access or user-demo checkout changes occur.

The preceding cancellation/reopen checkpoint is accepted through
[PR #144](https://github.com/skyscs/ai-engineering-workbench/pull/144): push 42029717937 and
pull_request 42029762843 pass 982 tests at exact head
`d6094de147f306c30340714b820f3322eb8c8a8c`. Merge
`1c6772069fd267b1be8358f1e4b032ee06f41000` has the identical tree. Both complete CI logs
are retained here; its cold timer failure remains failed.

This is an ordinary reusable subset. Later review/history/revocation extraction, full
R01-R15 integration, resource assessment and the final executable/environment/output
seal remain pending. The reserved family has zero candidate reads and model eligibility
remains closed.
