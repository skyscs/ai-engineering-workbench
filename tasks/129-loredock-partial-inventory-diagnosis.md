# Task 129 — Diagnose preparation over terminal partial inventories

Status: first ordinary diagnosis complete; result awaiting exact-head CI and merge.
See the [four-control result](../docs/fixtures/loredock-partial-inventory-diagnosis/README.md).

Task 128 processed every eligible code file but published `partial` inventories because
coverage gaps remained. Its frozen driver required `completed` and therefore never sent
the public preparation request for those cases. The
[retained result](../docs/fixtures/loredock-prepared-flow-result/README.md) also records
real startup-gap and heap failures. Do not misreport the prerequisite failure as proof
that the application's public preparation API rejects a terminal partial inventory.

## Objective

Determine, on ordinary development inputs, whether a useful original-backed prepared
context remains available when unrelated files have explicit coverage gaps. Separate
processing completion, publication/parser compatibility, coverage, source usefulness and
resource measurements. Produce a bounded diagnosis and the smallest justified next task.
This task does not qualify or activate the prepared-answer flow.

## Sequence

1. Review the existing inventory publication, public preparation and native omission
   contracts. Define a decision table for running/unpublished/incompatible inventories,
   terminal `completed`, terminal `partial` with all files parsed, and missing analysis.
   Preserve the distinction between a missing required original/path and unrelated gaps.
2. Use ordinary permit development sources only. Freeze a small control and two explicit
   variants before running: one adds a constant-only TypeScript file, the other an
   unrelated unsupported/dynamic HTTP request. Include a separate ordinary Catalog-only
   control for missing compatible analysis. Do not derive new inputs from the consumed
   kiln family or describe these development controls as prospective qualification.
3. Exercise actual production Catalog/follow/HTTP/preparation code. Wait for each declared
   terminal state, retain the exact published inventory and file/gap counts, then make
   one public Find context request. Running analysis must remain busy; unavailable
   analysis must remain an explicit omission. Do not change the Task 128 driver or use
   a private producer/validator shortcut. No answer admission or model call is needed.
4. Independently check the original-required context, native presence/omission reason,
   truthful coverage qualifications and immutable reviewed hash. Retain first failures,
   raw HTTP bytes, stopped catalogs, sources and passive resource observations. No rerun
   may turn an initial diagnostic failure into an acceptance result.
5. Explain whether the observed blocker is an evaluation prerequisite, product behavior
   or both. Recommend only the smallest next change supported by these observations.
   A future contract may distinguish terminal processing from complete coverage, but it
   must retain required-positive checks and explicitly unqualified gaps. Do not weaken
   an existing frozen gate or conceal failures behind a fast refusal.

## Acceptance and boundaries

- A concise decision table and actual four-control comparison, with original-by-original
  evidence and explicit limitations; unsupported or unavailable results remain visible.
- Focused tests only for new diagnostic boundary decisions; existing application behavior
  and all Task 127/128 frozen files, driver, manifest and raw results remain unchanged.
- Independent retention checks, relevant build/type checks, and both exact-head CI events
  before merge. Agent review is not independent product acceptance.
- No corporate sources, reserved-family replay, parser/schema changes, limits increases,
  model execution, default activation, new runtime/account configuration or Workbench bridge.
- Startup timer delay, near-limit heap, list work, browser RSS and required native output
  remain unresolved until separately scoped fixes and a new prospective qualification.
