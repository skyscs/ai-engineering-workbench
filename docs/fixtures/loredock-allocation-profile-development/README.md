# Allocation profiler development failure

Before any frozen device-corpus execution, the first full check exposed a profiler
export assumption on an independent three-source locker test. Its complete receipt
passed integrity, but profile validation rejected four samples referencing node 243
while the exported tree contained IDs 1–239. The test retained its owned temporary
directory; `first-profile-failure.jsonl.gz` preserves eleven raw files with byte/hash
frames, including the profile, receipt, capture and process exits. `check-first.log.gz`
is the first failed full check. The separately run initial integration had passed.

Source inspection of the pinned Node/V8 implementation explains why profile export
can allocate additional sampled nodes, and also establishes backend collection during
profile retrieval. These limitations were missing from the first protocol. The
[prospective revision](../../../fixtures/loredock-allocation-profile/PROTOCOL_REVISION_2.md)
records them before any new device-corpus observation and preserves the original freeze.

The revised summarizer keeps well-formed unmapped samples as unknown count/weight,
reports partial reference coverage and never invents application attribution. Invalid
numbers, duplicate identities, malformed references and structural bounds still fail.
Neither the correction nor a valid receipt repairs old resource gates. This retained
regression profile is not a large-project measurement or an acceptance sample.
