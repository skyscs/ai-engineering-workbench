# Prospective prepared-flow qualification

Task 127 freezes inputs and criteria after PR #130 passed both exact-head CI events
at `480764db70d21ba86011bd5f55ac307a662e1b2e` and merged with an identical tree at
`0985f2cdde4ddd6221330c8bbb02e389e8cc65fe`. No candidate has indexed, parsed, queried
or answered the new corpus. No resource or semantic result is implied by this design.
The normative [protocol](../../fixtures/loredock-prepared-flow/protocol.json),
[source oracle](../../fixtures/loredock-prepared-flow/oracle.json) and
[input seal](../../fixtures/loredock-prepared-flow/freeze.json) accompany this document.

## Decision and user benefit

Qualify the implemented question → Find context → review → Generate flow as a whole
before considering it as the ordinary opt-in answer input. The user still chooses no
repository, root, generation, budget or model pipeline. The qualification must show
useful original-backed context, honest uncertainty and usable response times at twenty
repositories, including ordinary history polling. It must not reward fast refusal in
a case that requires a useful result.

This is an evaluation task, not a new application layer. No parser, retrieval ranking,
schema, account selector, daemon budget or default switch changes. Workbench routing,
broader language/framework coverage and independent project acceptance remain separate.

## Actual composition and amplification audit

The accepted daemon starts CatalogStore/Catalog, CodeAnalysis/CodeAnalysisFollow,
CodePathsV2, NativeCaptures, optional QuestionPreparations/Answers, Hono's protected
app and the built React UI. The accepted audit binds 82 workspace ESM modules, resolved
external entries, lockfile and browser assets. The 41-module native and 64-module
prepared-service subsets do not qualify that complete public composition.

| Boundary | What must be included |
| --- | --- |
| Registration and cold start | Owned Git roots, source registration, exclusive storage lock, schema initialization, actual listener, initial browser state and failures. |
| Index and automatic analysis | Saved revisions, exact admitted/excluded files, real follow service, all eligible code files, parser identity, inventory publication and conservative busy behavior. |
| Preparation | One real 5-second/1,000,000-unit budget starting before lexical retrieval; original SQL/text work, complete native resolution, selection, compact/prompt construction, final handoff and retained bytes. |
| Ready and review | Actual one-second scalar browser polling, metadata rechecks, one-time bounded review serialization, immutable reviewed hash, ten-minute monotonic expiry and browser-held copies. |
| Admission | Exact scalar request, synchronous immutable witness/attempt/dependency transaction, quota checks, response serialization and ownership of the actual worker. |
| Worker | Three separate actual load/validation budgets before preflight, dispatch and publication; exact prompt/schema, usage before publication fencing, original-only cited validation and runtime cleanup. |
| List and history | Every witness load/decode and context parse, source authorization, response serialization, repeated polls and full saved-answer rendering. |
| Cancellation and restart | Owned work drains, late usage survives, transient previews disappear, unfinished attempts become interrupted, and durable request replay never redispatches. |
| Eviction and purge | Native inventory can disappear without rewriting issued input; new source builds fence new generation; source revocation purges all dependent answer text including uncited source dependencies. |

In particular, `Answers.state()` lists twenty rows and calls `get(id, false)` for
each. An authorized prepared row still loads/decodes its witness and parses context
before omitting content from the response. Each load owns a separate budget. There is
no shared list-request budget. A small JSON response therefore does **not** establish
low CPU, memory, aggregate work or event-loop delay. The real browser polls this route
every second. The contract sets a prospective **500 ms / 1,000,000 aggregate-unit**
list gate, separate from the unchanged per-load enforcement. This can fail even when
every individual budget succeeds; do not alter the gate after observing it.

Other distinct lifetimes are one transient snapshot (1 MiB, ten minutes), one answer
worker (three validators plus separate provider wall limit), 64 durable witnesses
(768 KiB each, 48 MiB total, purged rows still count), two native inventories and 64
separately owned saved native receipts. HTTP admission/history reads and the browser
retain additional copies. No multiplication of a per-phase allowance is a memory claim.

## Fresh inputs and independent expectations

The new kiln workshop has twenty named repositories and three different client routes:
Vue batch scheduling, a Dojo safety request and a TypeScript status read. Java examples
publish/subscribe through Kafka-shaped interfaces and write through Mongo-shaped ones.
A distinct alarm topic, dynamic endpoint, documentation-only dependencies, incompatible
header names, absent deployment facts and a human clarification prevent a generic
end-to-end story from earning credit.

Five source variants are frozen: 240-file representative, 10,000-file near-limit,
ambiguous Vue entry, unrecognized consumer method and computed publisher topic.
All twenty sources have equal 12- or 500-file vectors. Additional TypeScript constants
apply indexing/inventory pressure but deliberately add no behavioral chain. This tests
the file-count boundary on a sparse graph, **not** dense 10,000-fact traversal, 50 MiB
source text, monorepo realism or arbitrary production frameworks. These limitations
remain even if every case passes. Exact bytes, file counts, quote ranges and all source
vector hashes are recorded without running the application against them.

The oracle is written from these original files before any candidate observation.
It supplies no parser-derived IDs, generated answers or retrieval internals. A future
assessor resolves required source/path/line/text tuples against the actual saved build
and original passages; same text in another repository/build is insufficient. Source
code alone enters the product, not oracle prose or expected answers. The author also
performs the first review, so this is independent of candidate outputs but not blind,
external or independently accepted L5 evaluation.

All ten semantic cases first have a mechanical prerequisite. S01 requires the useful
three-source native chain and exact support. S02 requires explicit ambiguity; S03/S04
require the supported partial path and specific consumer/topic gap. Other cases require
the original source context and truthful omissions/review. A missing required original
fails the prerequisite; it cannot be repaired by inserting oracle evidence or by giving
an incomplete answer full abstention credit. Native optional cases may legitimately
omit a whole item but must preserve originals and explain the omission.

Exact symbol/route/topic anchors are the current selection policy. The frozen questions
intentionally expose those anchors. No natural-language paraphrase or incident-routing
generalization follows. Matching declarations, unknown environments, duplicate native/
legacy clues and engineer assertions retain their distinct provenance. Every extra
factual clause, not merely the required checklist, is assessed for support.

## Prospective measurements and thresholds

The protocol enumerates fifteen required resource/lifecycle cases with a fixed order,
three warmed repetitions per size, full-capacity history and explicit failure cases.
It fixes all thresholds before observation. Daemon RSS **384 MiB**, heap-used **64 MiB**,
maximum 10 ms timer interval delay **100 ms**, and actual operation **5 seconds /
1,000,000 units** preserve the existing resource goals; previous passes do not transfer.
Index and analysis each have a separate five-minute ceiling. Cold listening has ten
seconds, prepared review six seconds including HTTP overhead, and a controlled complete
Find-to-history lifetime twenty seconds. Deliberately held fault/runtime durations must
be reported and excluded only from their explicitly named drain measurements.

Browser-process RSS sums the owned Chrome process tree (shared pages can be counted
more than once); its explicit 1 GiB ceiling is separate from daemon RSS. Record each PID,
sampling cadence, process peak RSS and sampled heap. Sample the daemon timer every
10 ms, process RSS at most every 10 ms, and browser tree at most every 100 ms. The
100 ms daemon interval threshold is the raw monotonic gap between consecutive timer
callbacks, including the nominal 10 ms; do not subtract the nominal period. Preserve
all samples and start/end gaps. Report sampled maxima as sampled, never a mathematical
continuous bound; include OS process high-water RSS so synchronous spikes are not hidden
by a stalled JavaScript sampler. No forced GC, heap-size override, profiler or application
method replacement in the resource lane. A sealed passive startup monitor may read
process.memoryUsage and record timer samples without patching application methods;
its code and overhead belong to the measured process. A missing sample/exit record
fails measurement.

Measure cold process startup separately from a reopened catalog and a warmed worker.
Retain first and all subsequent samples. Ordinary user-visible polls remain enabled
during browser cases; include their cost rather than subtracting it from worker totals.
The 40-minute complete suite watchdog includes ten-minute real expiry and all fixed
preparation/capacity cases. Storage thresholds cover live SQLite/WAL/SHM/native files
and the whole owned run directory separately. Reaching a ceiling stops new work; it
does not authorize deleting failed evidence.

Production currently has no public cross-request work telemetry. The separate accounting
lane may forward actual OperationBudget charge/check/close methods to record all budget
identities and accepted/rejected units. It must preserve semantics and compare raw useful
outputs after only predeclared UUID/time/root normalization. It cannot wrap retrieval,
replace validators, reduce facts, inject budgets or provide a resource pass from its
instrumented timings. If complete accounting cannot be measured, record an incomplete
gate; do not call unmetered work zero. CPU, wall time and event-loop measurements cover
serialization and other work outside the existing unit accounting.

## Execution seals and model separation

Task 127 binds the accepted application source and existing built runtime/browser bytes.
Task 128 first develops the driver on ordinary permit sources, then commits an immutable
executable seal before opening this family with any candidate. The seal covers driver,
assessor, launcher and input hashes; full transitive workspace imports; external package
entries and lock/install identity; browser files and actual Chrome binary; Node/V8, OS,
CPU and memory; environment allowlist; connection double and process ownership; exact
commands and output destination. Verify imports against the actual accepted bootstrap,
not merely the modules a helper happened to import. This task's base seal is not a claim
that an as-yet-unwritten evaluation driver or unknown browser binary is qualified.

The unmodified `index.js` entry covers real cold startup, indexing/follow, preparation
and reopening history with no provider execution. To measure answer execution without
model calls, a separate launcher must instantiate the identical actual services and
shutdown order, changing only the injected TextRuntime through its existing constructor.
It serves the real app and built assets. Audit the bootstrap diff and every emitted
dependency. The double returns bounded cited JSON and known usage, and exposes explicit
holds for cancellation tests. It may cite an ID already issued in the actual schema,
but must never rewrite prompts, add oracle evidence or bypass validation. Provider CPU/network/token behavior is not qualified by that double.

Only an all-pass resource/lifecycle report permits the separately sealed semantic stage.
The same sources have then had declared model-free observations; this is one prospective
two-stage family, not fresh blind semantic data or a new resource run. Freeze the actual
personal connection, executable/binary, runtime-reported identity and safe configuration
fingerprint before attempt one. The requested qualified CLI is 0.166.0 and model is
gpt-5.6-terra with medium effort, matching the current product policy. If compatibility
or account configuration is unavailable, stop without silently switching identity or
reusing credentials. No authentication files, tokens or full secret-bearing configuration
enter artifacts. A selected personal path remains a user declaration, not account proof.

Semantic execution uses the actual production entry and CodexTextRuntime. The budget is
ten sequential attempts, one per question, no retries, at most 120 seconds each, with
the unchanged prompt/output limits. Stop before another attempt if known aggregate usage
reaches 150,000 tokens or usage is unknown. The threshold is not a hard provider-side
token/cost limit: the last call can cross it. Preserve reported usage and uncertainty.
Transport/model/semantic failures remain failed cases; scope, integrity, tool-policy or
measurement violations stop immediately. No prompt editing, output repair or replay to
improve a score. Mechanical validity and author semantic scores are reported separately.

## Retention, exhaustion and go/no-go

Create an append-only journal and fsync `started` before the first candidate read. That
consumes the family for its declared sequence, even if setup or the harness fails. Keep
every original Git repository, commit/tree vector, stopped full catalog, native files,
HTTP request/response, reviewed input, durable witness, exact prompt/schema, controlled
or real output, usage, process stderr/exit, metric sample, browser trace and screenshot.
Stop services before catalog snapshots; include WAL/SHM where present and hash the archive
plus unpacked inventory. Redact only session/CSRF/credential material from HTTP journals,
with an explicit field-removal record; these values are not oracle evidence. The source
trees are synthetic, so preserve them instead of using helpers that delete on failure.

Record the observer, original-by-original prerequisite checks and clause-level semantic
judgment. If a mandatory positive or resource threshold fails, the gate fails and the
semantic continuation is exhausted without running. Independently safe remaining resource
cases may run once for diagnosis; they cannot erase the first failure. A repaired runtime,
oracle or threshold requires a different prospectively frozen family and a separate task.
Never rename or recycle library/campsite/ferry/earlier families.

Go requires **all** useful resource cases, limits, lifecycle/fence/replay checks, input
prerequisites and ten semantic cases to pass with zero unsupported extra claims, complete
retained evidence and both final-head CI events. That permits a separately reviewed
proposal to use prepared input in the ordinary opt-in pilot. It does not switch a flag,
establish broad system understanding, authorize autonomous fixes or satisfy independent
L5/private-pilot acceptance. Any missing record, unresolved failure, author-only claim
of independence or model/account ambiguity is no-go. Preserve the current ordinary pilot
and experimental switch until the separately scoped adoption decision.
