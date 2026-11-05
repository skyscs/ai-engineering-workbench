# First reserved prepared-flow result

**Gate: failed. The `kiln-prepared-flow-127` family is consumed and exhausted for
semantic continuation. No model was called. Do not repeat or repair this sequence.**

The single run began after [PR #160](https://github.com/skyscs/ai-engineering-workbench/pull/160)
passed both exact-head CI events with 1,029 tests at `aff6b76` and merged with an identical
tree at `6374e9e`. Both complete logs/counts were checked before merge. The committed
[execution seal](../loredock-prepared-flow-execution-seal/README.md) was revalidated
before the shared claim and fsynced `started` record. There were no earlier candidate
observations in the retained author-local provenance audit.

The original [contract](../../loredock/PREPARED_FLOW_QUALIFICATION.md), oracle, source
vectors, application bytes, limits and execution manifest were unchanged. The actual
first owner output is `/home/toshiba/aew/task128-kiln-first`; the consumption marker is
`/home/toshiba/aew/task128-kiln-first.claim.json`. Their archive and exact inventories,
stopped catalog copies, raw observations and review are bound by [records](records.json).

## Case decisions

All fifteen ordered groups received a final decision: **five failed, ten not-run**.
No group passed the complete resource gate. Verified failed fresh setup permits only
the declared independent continuation; it supplies no successful checkpoint.

| Group | Result | First evidence / unavailable dependency |
| --- | --- | --- |
| R01 representative cold | Failed | 205/205 code files parsed; 195 coverage gaps, published `partial`; raw timer gap 313.619207 ms > 100 ms. No preparation. |
| R02 near-limit cold | Failed | 9,965/9,965 code files parsed; 9,955 gaps, published `partial`; heap 84,732,968 > 67,108,864 bytes; raw timer gap 326.222614 ms. No preparation. |
| R03 fixed warm repetitions | Not-run | Neither required successful cold checkpoint exists. |
| R04 64-row history | Failed | Independent representative setup remains `partial`; zero admissions/witnesses; raw timer gap 329.235652 ms. |
| R05 browser polling | Not-run | No 20/64-row history checkpoints. |
| R06 real expiry | Failed | Independent setup remains `partial`; no preparation or browser/TTL observation; raw timer gap 327.538149 ms. |
| R07 cancellation | Not-run | No successful representative cold checkpoint. |
| R08 network replay | Not-run | No successful representative cold checkpoint. |
| R09 restart | Not-run | No history or held-worker shutdown checkpoints. |
| R10 inventory eviction | Not-run | No successful representative cold checkpoint. |
| R11 authority fences | Not-run | No successful cold or replay/history checkpoint. |
| R12 revocation | Not-run | No 64-row history or replay/history checkpoint. |
| R13 original integrity | Not-run | No successful representative cold checkpoint. |
| R14 oracle prerequisites | Failed | Nine partial-analysis failures; S07 alone prepares useful source context. All ten daemon timer gaps exceed 100 ms. |
| R15 accounting | Not-run | No cold/warm or 20/64-row history prerequisites. |

S01–S06 and S08–S10 each stop at the completed-analysis prerequisite with zero preparation
requests. Their positives, ambiguities, gaps, engineer note and instruction-boundary
behavior are **not assessed as successful**. S07 uses its exact prescribed real Catalog
without follow/analysis, stops it, then reopens through the actual production entry.
Its single preparation includes the required `readCycle` original among 30 issued
originals from 20 sources and reports `INVENTORY_UNAVAILABLE`, with no native item.
That source prerequisite passes; its 281.894636 ms timer gap still fails the resource
limit. There is no generated answer or clause-level semantic review.

All fourteen daemon observations exceed the raw 100 ms timer limit, ranging from
281.894636 to 336.114535 ms, including startup. The near-limit process alone exceeds
the heap limit. Its observed and OS high-water RSS is 255,614,976 bytes, below the
402,653,184-byte bound; that isolated bound does not override other failures. No browser
was launched, so this run supplies no browser RSS, polling, paint or screenshot result.
Earlier ordinary browser/list/native-positive failures remain unresolved and do not
transfer as reserved measurements.

## Retention and independent review

The external owner finishes with the expected failing driver exit (1), no owner errors
and no surviving descendants. Total wall time is 333,231.735625 ms; cleanup takes
0.122392 ms. Peak sampled owned storage is 69,496,655 bytes. All configured numeric
owner/storage bounds are met, but 48 of the 63 prospectively declared catalog roots
were never created after prerequisite failure. The global storage assessor therefore
remains incomplete and retains the unsuccessful driver outcome.

Independent checks verify:

- 15 complete stopped catalog copies, SQLite integrity/foreign keys and zero durable
  answer attempts/witnesses; all 13 failed-fresh proofs preserve their original result
  hashes and zero preparation/admission work.
- 240 clean synthetic Git identities and all 12,640 original files across 12 input
  vectors, matching the original frozen vector hashes.
- 631 HTTP response bodies, with 14 explicitly redacted session responses; original
  non-session bytes remain exact. There are zero controlled runtime calls and zero
  real model calls.
- All 33 required original references exist at exact source/path/quote ranges. Presence
  in the inputs alone earns no candidate-selection or semantic credit.
- All 28,599 raw run entries remain unchanged after copying, inspection and review.

The stopped-copy coverage review distinguishes processing from coverage. R01 contains
194 constant-padding `unsupported-typescript-profile` gaps plus one
`dynamic-or-unsupported-http-request` gap. R02 contains 9,954 such padding gaps plus the
same category of HTTP gap. Every code file has terminal `parsed` status; overall
inventory status is nevertheless `partial`. The frozen driver correctly refuses that
status under its completed-analysis prerequisite. This does **not** establish that the
product's public Find context API itself refuses every published partial inventory:
these cases never sent that preparation request.

The source/original assessment is independent of candidate selection and was specified
before observation. The author performs this review; it is not blind, external or
independent L5 acceptance. Sparse synthetic inputs do not establish production coverage,
deployment truth or incident routing. Missing transient content, work and lifecycle
measurements remain incomplete; no missing work is reported as zero.

## Follow-up

[Task 129](../../../tasks/129-loredock-partial-inventory-diagnosis.md) isolates the first
decision boundary on ordinary development inputs: terminal processing, published coverage
and public preparation behavior. It must distinguish an overly strong evaluation
prerequisite from an application defect before proposing a change. The raw startup-gap,
near-limit heap and earlier ordinary browser/list/native-positive failures remain a
separate unresolved backlog. No parser/schema/default change, model call, Workbench
adoption or new qualification is granted by this report. Any repaired qualification
requires a separately frozen new family.
