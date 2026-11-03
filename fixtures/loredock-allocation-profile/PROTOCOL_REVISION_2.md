# Protocol revision 2 — Pinned V8 export behavior

This prospective amendment supersedes the no-forced-collection and exact sample-
reference assumptions in `README.md` at input freeze `c34cece`. It is declared
before any preparation/parser/candidate observation of the frozen device corpus.
The original four input files and the first independent regression failure remain
unchanged. No measured outcome or acceptance gate is being repaired retrospectively.

The first full check of the independent tiny locker regression produced a valid
receipt but rejected its profile: four samples referenced node 243 while the
returned tree contained IDs 1–239. Raw bytes, exits and the failed check are retained.
Inspection of pinned runtime source establishes two relevant implementation details:

- The [Node 22.23.2 V8 inspector agent](https://github.com/nodejs/node/blob/v22.23.2/deps/v8/src/inspector/v8-heap-profiler-agent-impl.cc)
  enables forced collection for sampling and retrieves the profile before stopping.
- The [pinned sampling profiler](https://github.com/nodejs/node/blob/v22.23.2/deps/v8/src/profiler/sampling-heap-profiler.cc)
  collects when retrieving, translates the tree using allocating operations, and
  builds the sample vector afterward. New samples can therefore appear during export.

Use the same single capture, Node version, 32-KiB interval and collected-object flags.
Make no explicit `collectGarbage`/heap-snapshot call and open no debugger port.
**Backend collection and profile-export allocations after the capture are part of
this diagnostic mode.** Application JSON serialization remains outside sampling.
Profile data can include export/GC costs and must never supply resource-acceptance
samples, retained-object counts or a claim about exact allocation timing.

`profile-policy.json` enables explicit accounting for well-formed samples whose
node ID is absent from the returned tree. Preserve every such raw sample; report
its count and weight as unmapped, with status `partial-unmapped-samples`. Never
invent a node, discard weights or assign them to an application function. Keep
mapped/unmapped sample weights separate from direct tree-node weights. Malformed
IDs/ordinals, duplicate identities, invalid numbers and all existing size/depth/
count bounds still fail. Do not silently downgrade an invalid structural field.

The coordinator may report protocol validity with partial reference coverage, but
must expose that status and unknown weights alongside integrity. A complete receipt
does not make the profile complete. Source attribution uses only inspectable tree
stacks; profiler/harness/internal locations remain visible. Any later candidate
choice must account for these limitations and the worst-case unknown weight rather
than treating a missing frame as evidence for a preferred hypothesis. If allocation
evidence is insufficient, record that outcome without rerunning this profile.

No production behavior, source bytes, expected paths, work/output/time limits or
old resource gates change. Retain this amendment and its commit separately from
the original freeze, verify both before measurement, and commit the revised harness
after its independent regressions pass.
