# Compiler isolation: source audit and adoption gates

This document records the historical prerequisite. Current production adoption is
described in [Owned production parser](OWNED_PRODUCTION_PARSER.md). The original
observations and acceptance limits below are unchanged.

Task 135 audits accepted source `8dfa00f` after Task 134. This is a design record;
no application execution, worker implementation or resource retest occurred here.
[ADR 0062](../decisions/0062-loredock-owned-file-parser.md) selects an owned file-parser
thread for an initially unwired adapter. [Task 136](../../tasks/136-loredock-file-parser-adapter.md)
is the next bounded implementation.

## Actual import and execution paths

| Source | Current contract | Required change before production isolation |
| --- | --- | --- |
| [index.ts](../../apps/loredock/src/index.ts), [app.ts](../../apps/loredock/src/app.ts) | Static imports reach both parser callers before listen, even when answers are disabled. Constructors precede HTTP serving. | Remove every main-thread compiler import path; explicitly own async initialization and shutdown. |
| [code-typescript.ts](../../apps/loredock/src/code-typescript.ts) | Eager CommonJS `require('typescript')`; synchronous text-only parse, with explicit subset/syntax gaps. | Load and run unchanged extraction in the worker; do not load source configs or execute modules. |
| [code-analysis.ts](../../apps/loredock/src/code-analysis.ts) | The field called `worker` is a Promise, not a thread. Reads one file, parses synchronously, writes checkpoint, then yields. | Await parser outside SQL transactions; fence ownership/status after every wait. |
| [code-analysis-facts.ts](../../apps/loredock/src/code-analysis-facts.ts) | Synchronous installed-byte fingerprint including compiler; text-only facts and original range validation. | Move expensive identity work off the main loop; preserve deterministic identity and parent verification. |
| [code-flows.ts](../../apps/loredock/src/code-flows.ts) | Second eager parser import. Synchronous bounded legacy projection, 100 documents/256 KiB, source-balanced order, `pilot-code-v3` IDs. | Preserve selection/order/IDs while splitting bounded reads, async parse and deterministic composition. |
| [answer-interfaces.ts](../../apps/loredock/src/answer-interfaces.ts), [answer-context.ts](../../apps/loredock/src/answer-context.ts) | Retrieval and full answer validation reconstruct legacy comparisons. | Async graph derivation must reach both creation and revalidation, including old saved inputs. |
| [candidate-links.ts](../../apps/loredock/src/candidate-links.ts), [source-candidates.ts](../../apps/loredock/src/source-candidates.ts) | Repository suggestions also derive legacy code links. | Await the same projection with current authority; do not replace it with a differently selected inventory. |
| [corrections.ts](../../apps/loredock/src/corrections.ts), [reconciliation.ts](../../apps/loredock/src/reconciliation.ts) | Save/preview/reapply reconstruct projections. Reconciliation keeps a bounded operation-local graph map. | Recheck source/build/policy/review version after waits and inside final mutation; revalidate idempotency races. |
| [question-preparation.ts](../../apps/loredock/src/question-preparation.ts), [question-witness.ts](../../apps/loredock/src/question-witness.ts) | Retrieval and witness comparison verification run in synchronous lexical accounts. | Preserve one total operation budget and strict late-read fences across explicit async phases. |
| [answers.ts](../../apps/loredock/src/answers.ts), [prepared-answer.ts](../../apps/loredock/src/prepared-answer.ts), [answer-witness-store.ts](../../apps/loredock/src/answer-witness-store.ts) | Full validation reaches the legacy parser; some validation occurs inside synchronous transactions. | Separate asynchronous preparation from final synchronous authority/hash checks; no promise-valued transaction callback. |

Moving only `CodeAnalysis` leaves the second eager import and startup pause. Lazily
requiring the compiler in the first request merely relocates blocking work after listen.
Replacing `codeFlows` with a published native inventory changes availability, selection,
coverage and immutable comparison hashes. Blocking IPC or `Atomics.wait` would preserve
the synchronous signatures at the cost of blocking the event loop again.

## Authority, accounting and retained memory

[CatalogStore.transaction](../../apps/loredock/src/store.ts) commits when its callback
returns; it does not await promises. Do not widen that API as a shortcut. A read/parse
phase may await, but a mutation must reacquire current authority and commit without
yielding. Duplicate requests, correction revision changes, cancellation, source revocation,
policy updates and daemon stop can all occur during newly introduced waits.

`CodeAnalysis.authorize` checks source/build/policy/parser identity, but does not itself
require `running`. Its current post-parse transaction therefore needs an explicit status
and generation guard after isolation. Current extraction exceptions become failed file
units; a dead worker must instead end the owner/run, without a per-file respawn loop.
Pause/resume currently relies on the between-file yield. An async parser makes mid-file
pause real, requiring invalidation and joined cleanup before resume.

[Prepared reads](../../apps/loredock/src/prepared-read-scope.ts) and
[prepared analysis writes](../../apps/loredock/src/prepared-analysis-writes.ts) support
async lifetimes with bounded statement retention and concurrent fallback. They are
optimizations, not transactions or authorization. They must stay in the parent and
close only after owned work has settled; clearing JS references does not prove that
SQLite has released its last native bindings.

[LexicalReadAccount](../../apps/loredock/src/lexical-read-account.ts) is deliberately
single-use and synchronous: returning a promise throws, closes the account and fences
inherited late reads. Do not remove that guard. The migration should use separate short
synchronous accounts for explicit read phases, all charging the **same**
[OperationBudget](../../apps/loredock/src/operation-budget.ts), and aggregate their
observations. No phase may reset time/work, reuse a closed account or read outside its
account. Parser input/output validation and transfer work need explicit charges in that
same budget, with a recorded accounting-version change if the unit definition changes.

The legacy graph retains bounded text/facts while constructing cross-file links; moving
parsing does not remove that parent retention. The worker should retain only compiler
code plus one active document/AST, with no result memoization. Durable analysis retains
one active file plus existing bounded database/statement state. Neither ownership graph
proves the existing 64-MiB whole-heap ceiling is achievable.

## Adoption sequence

1. **Task 136: unwired owned adapter.** Implement wire validation, one explicit owner,
   one request, cancellation/deadline/exit joining and exact parser comparisons. Exercise
   actual built workers and source-development loading. No imports from production
   entry, routes, analysis, graph, answers or witnesses; no fingerprint rewrite yet.
2. **Legacy asynchronous seam.** Scope a separate task after adapter review. Migrate
   graph composition and all transitive consumers, synchronous transaction boundaries
   and lexical accounting together. Keep a direct parser adapter temporarily for parity
   controls; this intermediate stage does not solve startup. Freeze ordinary successful
   old graph/correction/context/prompt/saved-response expectations before editing.
3. **Production adoption.** Scope owner admission and contention before wiring both
   parser callers. The lower adapter stays single-flight with no queue; caller scheduling
   must state how indexing and foreground reads interleave without starving either or
   silently returning empty/source-only context on busy. Preserve existing HTTP response
   meaning, final mutation fences and same-build upgrade recovery. Remove all parent
   compiler imports and synchronous compiler-file hashing only in this complete stage.
4. **Ordinary production controls and fresh qualification design.** Observe the complete
   new import closure, observer coverage, startup, actual useful work and near-limit
   memory. Retain failures and only then decide the next repair or qualification family.

Do not call step 1 production isolation or turn on an experimental default. Each later
task must declare concrete acceptance and contention behavior before implementation;
this sequence does not authorize hiding semantic changes inside an adapter switch.

## Prospective controls

Before each first observation, commit its exact input identities, runtime, entrypoint,
owner bounds, expected useful outputs and observer definition. Use synthetic ordinary
inputs only, never the consumed reserved Task 127/128 family or a replay of its seal.
Contract tests may repeat after code changes; retained first resource observations
must remain separate, immutable records, including failures and missing samples.

| Control | Required evidence |
| --- | --- |
| Empty startup | Complete production-entry interval/RSS samples from before imports; parser initialization timing and both heaps. Verify all optional answer settings. No prewarming or unobserved first request. |
| Parser parity | Byte-identical serialized facts/ranges for TS, JS, Vue, Java, Unicode offsets, headers, literal event topics, malformed syntax and subset limits. Keep exact input paths/text; no AST transfer. |
| Useful work | Fresh ordinary multi-repository index, expected originals, complete Ready native context and one controlled saved answer; exact legacy projection/context/prompt semantics and v1/v2 saved validation. |
| Pause/cancel/resume | Cancel while starting and while parsing; block publication, join actual exit, resume only with a new owner after cleanup. Verify completed checkpoints and late/duplicate replies. |
| Source/policy/build/review changes | Changes during each async phase cannot publish stale code, corrections or answers. Historical authorized reads remain possible. |
| Shutdown and process exit | Stop idle/starting/busy, repeated stop, worker crash and parent exit. Retain generation lifetimes, exit/error metadata and absence of survivors; existing two-second cancellation/ten-second shutdown bounds apply. |
| Malformed protocol | Wrong types/keys/version/correlation/hash, invalid UTF-8/ranges, oversize request/result, unexpected second response, error before ready and exit after result. Failure is explicit; no source logs, fallback or respawn. |
| Contention | Foreground read during indexing and reverse order; bounded admission, no retained queue, no starvation, no hidden retry or missing derived context. Required before production adoption. |
| Near limit | Existing ordinary 240/10,000-document shapes, cold and restart, one owned parser generation at a time; whole RSS and both observed heaps, SQL/graph retention, useful results and cleanup. No GC/heap tuning or limit increase. |

Worker heap sampling APIs are asynchronous. First establish their coverage during
initialization and busy parsing, recording each request/completion and missing interval.
An incomplete observer cannot grant memory acceptance. Main-loop latency and whole
operation time are separate measurements, both mandatory. Retain CPU for attribution;
the current contract does not define a numerical CPU acceptance threshold.

## Unresolved gates

No startup, heap, browser or complete-flow gate is passed by this design. The ordinary
167–173-ms startup gaps and earlier near-limit 84,732,968-byte heap remain failures.
Task 134's blank browser already exceeds the unchanged 1-GiB raw RSS gate, independently
of LoreDock. That environment/metric decision remains separate. New protocol ownership,
async integration and observer coverage must be demonstrated before resource claims.
