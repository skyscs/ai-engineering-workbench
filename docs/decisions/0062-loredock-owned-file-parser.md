# ADR 0062 — Owned asynchronous file parsing

Status: accepted design for Task 136; no production integration or resource acceptance.

## Decision

Build one explicitly owned worker-thread adapter for the complete text-to-`CodeFacts`
step, including Java and TypeScript/JavaScript/Vue. Keep source reads, original range
verification, graph composition, authority checks and SQLite writes in the daemon.
The next task tests this adapter without connecting it to production callers.

This is a candidate architecture, not a demonstrated startup or memory fix. Adoption
requires asynchronous migration of **both** durable analysis and legacy projections,
whole-resource observation and unchanged successful parser/answer meaning. The
[source audit and migration gates](../loredock/COMPILER_ISOLATION.md) are part of this
decision. No worker pool, result cache, new database, source execution or model call.

## Alternatives

| Boundary | Benefit | Cost and decision |
| --- | --- | --- |
| Move only compiler loading | Small apparent change | Calls still need the compiler on the main thread, or transfer compiler ASTs. Reject. |
| Move only TypeScript extraction | Removes the measured compiler work from its callers | Leaves two execution paths and Java parsing on the main thread. Prefer the existing common text-only fact boundary for both languages. |
| Move complete catalog analysis | Makes the main loop responsive | Moves database/source authority, opens another writer and duplicates cancellation/fencing. Reject. |
| Complete file parser in one thread | One process, explicit isolate, transferable bounded text/facts | Requires async consumers, isolate heap accounting and observed termination. Selected for the first adapter. |
| Complete file parser in one child process | Separately attributable process and termination | Adds another Node process, pipes and lifecycle ownership; whole-process RSS and both heaps still count. Retain as an alternative only if thread controls fail. |

Node 22.23.2 supports observing worker heap statistics and thread CPU from the parent.
Worker termination is asynchronous. Worker engine limits do not bound external buffers
or prevent process-wide out-of-memory failure. Child processes have separate V8 instances.
These properties support the choice; they do not establish that it meets our ceilings.
See the pinned [worker](https://nodejs.org/download/release/v22.23.2/docs/api/worker_threads.html)
and [child-process](https://nodejs.org/download/release/v22.23.2/docs/api/child_process.html)
references. Diagnostic APIs added after Node 22.13 must not silently raise the product's
minimum version; initially only the pinned observation harness uses them.

## Ownership and protocol

One service owner creates at most one live parser thread. An owner has one active
request and **zero queued requests**. A concurrent submission fails with a typed busy
error before retaining its text. Higher-level scheduling is a separate integration
decision; no hidden backlog of complete documents is permitted.

Use a fixed installed module URL, never a source-selected entrypoint, `eval`, project
configuration, plugin, compiler host, module resolver or arbitrary worker options.
The worker imports the current pure parser modules. It receives no catalog, repository
root, SQLite path, evidence, connection, credentials or authorization capability.
Threads share process privileges: this is an execution/ownership boundary, not a
security sandbox for hostile executable code. Repository text remains inert input.

Use a versioned JSON envelope carried in a dedicated transferred `ArrayBuffer`:

- Request: protocol version, owner generation, increasing request ID, parser identity,
  exact relative file path and exact source text. Content is at most 32,768 UTF-8 bytes;
  the complete encoded request is at most 256 KiB, including escaped text and path.
- Result: the same correlation fields, input digest, parser identity, and either exact
  `CodeFacts` or a small enumerated error. Complete encoded result is at most 512 KiB.
  These are transport bounds, not increases to the existing 128-KiB durable file payload,
  16-MiB inventory, graph, prompt, receipt or shared operation limits.
- Sender checks serialized bytes before transfer. Receiver checks type and byte length
  before decoding with strict UTF-8 and parsing JSON, then exact envelope keys, versions,
  correlation, hashes, fact fields and original UTF-16 ranges. Reject unknown keys,
  invalid dictionaries, duplicate symbol keys, unsupported types and invalid owners.
  Preserve serialized ordering and legitimate dictionary keys without prototype merging.

Only plain text facts cross the boundary, never ASTs, `Program`, filesystem handles or
class instances. Existing `factRanges` supplies semantic range checks but is not a
complete strict wire validator: add the latter rather than assuming the former checks
every field and byte. The parent derives original line/hash evidence from its own text.
Hashing and validation are charged to the same caller work/deadline, not a new budget.

Transfer only dedicated exact-size buffers, not pooled backing stores. One request and
one response bound the wire data; decoded objects, parser ASTs, compiler allocations,
retained graph documents, SQLite bindings and both copies of source text still count
toward heap/RSS. The sender-side bound is not a hard memory sandbox against a faulty
worker allocating arbitrary messages. Unexpected messages terminate that generation.

Do not truncate facts to fit transport. A result exceeding the bound is an explicit
adapter failure. Before legacy integration, test whether any otherwise successful old
projection exceeds these proposed bounds. If it does, stop adoption and review the
transport contract; do not silently lose legacy facts or relabel failure as partial data.

## Lifecycle and failure

Construction performs no compiler import or worker start. Explicit asynchronous start
owns `starting -> ready`; start time, identity checks and any waiting count toward the
caller's existing deadline. A ready handshake follows parser initialization and identity
verification; Node's `online` event alone is insufficient. No production readiness claim
may hide deferred initialization after listen.

`parse` uses `ready -> busy -> ready`. Each owner generation has a unique token; every
reply is matched to its only active request. Unsolicited, duplicate, malformed, oversized,
wrong-generation or wrong-input replies fail the generation, including replies received
after a successful result. Release document/result references and listeners on terminal
paths. Compiler code may remain loaded only while this explicit owner remains alive.

Abort, deadline expiry, parser crash, message error or unexpected exit makes the active
request unusable and closes that generation. Terminate the thread and await its actual
exit. Reject new work during cleanup. A stop operation is idempotent and also joins exit.
Do not clear ownership merely because a termination promise was requested or a timeout
fired; report incomplete cleanup and retain ownership until exit is known. The existing
outer daemon supervisor remains the final process cleanup authority.

There is no automatic respawn/retry or fallback to synchronous parsing. A new explicit
owner may be admitted only after the previous owner has exited. Future user resume can
create a new generation and resume already verified checkpoints. Cancelled work is never
reused. Failure metadata records bounded error code, phase and exit information without
logging source text. Syntax/profile gaps returned by the current parsers stay ordinary
facts; infrastructure failure is not an `unsupported-syntax` gap and must not trigger a
restart for every subsequent file.

## Publication and compatibility

The integration must snapshot run/generation, pending unit, build identity, parser
fingerprint, policy, source registry and active dependencies before each asynchronous
step. Recheck these and cancellation/stopping after the reply and immediately before
the existing synchronous write transaction. The run must still be `running`, the unit
still `pending`, and the generation still owned. `authorize()` alone is insufficient.
No `await` belongs inside `CatalogStore.transaction` or a Ready promotion callback.

Pause stops new work, invalidates in-flight completion and joins the worker before a
resume can create another generation. Cancel, source/policy changes, replacement and
shutdown win over late completion. A published older inventory stays available subject
to its current authority checks; an incomplete new run cannot overwrite it. Define
replacement ownership explicitly without forbidding legitimate reads of historical
published builds. No new status/schema or silent automatic restart is required.

The existing implementation fingerprint hashes source/emitted parser and orchestration
bytes plus the installed compiler. Preserve that integrity contract and add the new
entry/protocol/adapter bytes when integration changes execution. Perform installed-byte
hashing asynchronously or inside the owned initialization, without importing the compiler
on the parent. Parent and worker must agree on identity before accepting facts. Do not
reuse an old fingerprint merely because a sample parses identically.

Existing incompatible inventories require explicit honest reanalysis. The current follow
service watches **new build publication**, so a same-build parser upgrade is not already
handled at startup. Design that transition before wiring, without rewriting saved answers
or automatically resuming interrupted work. Legacy graph ordering, `pilot-code-v3` IDs,
omissions and comparison hashes remain exact; durable inventory is not a replacement
for that differently bounded projection. Old v1/v2 answers retain their original bytes.

## Whole-resource accounting and acceptance

Preserve daemon RSS **402,653,184 bytes**, aggregate observed JS heap **67,108,864 bytes**,
and main-loop raw interval gap **100 ms** on the existing 10-ms sampling schedule,
including startup. Existing listen/index/analysis/operation/cancel/shutdown deadlines,
work/byte limits and browser limits remain unchanged. Parser startup, queue admission,
transfers, decoding, validation and termination are included in operation time; waiting
does not reset a deadline. CPU is recorded for the whole process and separately for the
worker, without adding thread CPU to process CPU a second time or inventing a CPU gate.

Process RSS includes the worker once. Main-thread `memoryUsage().heapUsed` does **not**
include the worker's heap; Node documents this
[measurement scope](https://nodejs.org/download/release/v22.23.2/docs/api/process.html#processmemoryusage).
The frozen observer therefore cannot certify the proposed architecture's heap bound.
Do not edit it or report its parent-only heap as a successful whole-daemon measurement.

A fresh prospective observer must record parent samples and every worker generation,
creation/start/ready/busy/exit times, external heap requests and completions, CPU, failure
and cleanup. On the pinned runtime, evaluate `worker.getHeapStatistics()` sampling from
the parent. Its asynchronous completion is not a simultaneous sample: preserve latency,
missing intervals and exit rejections. Retain per-isolate maxima and a conservative sum
of sampled maxima, clearly distinct from a continuous peak. Missing startup/busy coverage
prevents heap qualification; terminal samples or worker limits cannot fill that gap.
Validate observer coverage before a new resource acceptance contract is frozen.

Keep raw main-loop intervals unfiltered. A worker doing CPU work has a different role
from the HTTP event loop, but its full startup/parse duration, work and CPU must remain
visible and bounded by the caller's deadline. A responsive parent plus an unobserved
worker is not acceptance. No prewarming outside measurement, forced GC, heap overrides,
diagnostic heap snapshots or subtraction of instrumentation to manufacture a pass.

The first adapter task establishes ownership, exact parser parity and measurement
feasibility only. Follow with legacy async/accounting migration, production adoption
and then declared ordinary startup/useful/near-limit controls. Each stage must satisfy
its own acceptance criteria before the next. Browser memory remains a separate unresolved
constraint. Complete qualification requires a fresh family; consumed families stay closed.
