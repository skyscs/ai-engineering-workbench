# Task 086 — Bounded terminal heap observation helpers

Status: implemented and locally verified; exact-head CI pending, 2026-11-04.

## Baseline and scope

Implement the Task 085 terminal ownership decision on independent tiny inputs.
Start from reviewed head `3b67fae`; verify PR #89's exact-head push/pull-request CI
and identical merge tree before completing this task. No fresh resource corpus,
large diagnostic execution or optimization is authorized here.

Add opt-in offline helpers for exactly two terminal heap exports, a finite owned
child/process/file boundary, and bounded pure snapshot validation/readout. Record
collection/export perturbation explicitly. Keep raw snapshots and process failure
artifacts before interpreting them. Parse outside the observed worker. Never open
user catalogs or execute corpus code. Do not edit any exhausted measured module.

Use pinned Node 22.23.2. Export must occur outside application operation budgets,
with no manual GC flags. The independent child retains a known synthetic owner for
the first snapshot, closes/releases it, returns from the owning stack, and exports
again in a later event-loop turn. The harness must not keep its own strong owner
registry. Recognize only validated version-specific snapshot metadata; reject
invalid node/edge/string indexes, duplicate identities and unsupported shapes.

Report counts/shallow sizes and bounded inspectable retaining paths separately;
weak/conditional/native or unknown ownership cannot become a strong-retainer or
leak claim. Do not sum overlapping subgraphs or infer process RSS from node sizes.
Demonstrate the distinction with independent graph fixtures and real tiny exports.

## Acceptance

- Actual child snapshots distinguish deliberately held and released owned objects;
  no application optimization, forced-collection acceptance or model is involved.
- Finite export size, time/process supervision and regular owned-file boundaries
  fail explicitly on malformed, missing, oversized or partial artifacts. Preserve
  stdout/stderr/exits and first failures; no automatic retry or raised bound.
- Pure readout validates schema and graph indices before traversal, bounds all
  scans/output, distinguishes weak/unknown paths and retains source node/edge IDs
  for human review. Raw graphs remain authoritative and IDs are snapshot-local.
- Cancellation/child error/watchdog/cleanup and parser-limit cases have meaningful
  independent regressions, including the actual process boundary where applicable.
- Scope all diagnostic limits before any large-family authoring. Verify references,
  full diff and frozen-file separation; run relevant tests and pinned full checks,
  then both exact-head CI events before merge.

The next task may separately author/freeze one complete positive near-limit family
and execute the specified terminal diagnostic once. All application resource gates,
old failed families, same/reopened qualification, support/domains/charges/fences and
production/private-pilot boundaries remain unchanged.

## Implementation and first observations

Scope `d006891`. New offline helpers provide a Linux child process group with hard
file limits and parent time/RSS supervision, ordered terminal exports, bounded
regular-file readback and pure pinned-schema graph validation/readout. Output keeps
node/edge indices, count/shallow-size evidence and explicit weak/runtime/native
uncertainty. No service, live catalog, source parser, model or corpus code is invoked.

The independent schema preflight records the exact pinned default V8 format and
retains its complete raw heap archive. The first child regression fails on trailing
whitespace in Linux's file-limit record, before export; that parser error is fixed
without increasing any bound. First stdout/stderr/exit and all checks are
[retained](../docs/fixtures/loredock-terminal-ownership/README.md).

The corrected actual child has one marked owned object before release and zero
after its owner returns and the next event-loop turn begins. Pure graph cases cover
strong/weak/runtime/native paths and corrupt schema/identities/indexes/encoding;
process cases cover exit/cleanup errors, cancellation, timeouts, sampled-RSS stops
and a real hard-file-size limit. File cases refuse traversal/symlinks and byte/hash
mismatches. Review preserves descriptor cleanup on setup failures and never labels
native paths as proved strong retainers. Four focused tests pass.

The final helper ceilings precede any future resource input: 128 MiB per file,
1,000,000 nodes, 4,000,000 edges, 1,000,000 strings, eight selectors/examples, 64 path
steps, 256 KiB summary, 900-second whole-child watchdog and 1 GiB parent-sampled RSS
stop. Tiny tests use a 15-second or smaller watchdog. These diagnostic bounds do
not replace or relax any application resource gate.

PR #89 merged as `3f00938d69cd87503229bce917a288d705ab4270` after final head
`3b67faea570189e79114abf413d9f115b8841ed7` passed push 41734325502 and pull-request
41734373519 CI (529 tests). Its merge tree is identical and included here; main is
clean and synchronized. No exhausted module/input/result has been edited or rerun.

Final pinned Node/pnpm `pnpm check` exits 0: all 533 tests, strict typechecks and
builds pass. Review covers process-group/descriptor cleanup, bounded native export,
version/schema/graph/file validation, explicit uncertain ownership, reference links,
retained raw/log hashes and frozen-file separation. No new resource family is
created. Both exact-head CI events remain required before merge.

Final review catches a missing-argument third-call case after the two stage names
were exhausted. The exporter now checks its finite stage count and argument type
before equality; real child assertions reject wrong order, omitted and duplicate
extra calls and verify exactly two files. The final full check repeats after this
correction and again passes all 533 tests, strict typechecks and builds. Both full
logs remain retained; no large or exhausted input was involved.
