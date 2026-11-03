# Request-local compact validated payload entries

Task 088 implements the single candidate selected by the
[terminal ownership diagnostic](../../docs/fixtures/loredock-terminal-memory/README.md).
It is opt-in experiment code, not a production change or a measured memory saving.
No new resource corpus is authored or executed here; all earlier results remain.

`paths.mjs` is the reviewed complete-capture reader with one data-lifetime change.
For every parsed file, `analysis.file` still completes all checkpoint, byte/hash,
identity, original-span and fact-range validation. The reader records the same
`[fileId, contentHash, inputHash]` consumed tuple, then stores only:

```js
{ file, payload: { facts: payload.facts, ranges: payload.ranges, evidence: payload.evidence } }
```

Those three values are the already validated objects; there is no deep copy or
new registry. Duplicate identity properties no longer stay reachable through each
entry's payload wrapper. Identity values still participate in the consumed digest,
metadata and snapshot fences. Every file entry, gap, evidence reference, ambiguity
alternative and full import/Java domain remains. The resolver, admission, receipt
publication/history, work/output limits and all three snapshot checks are unchanged.
This does not omit fact-free files or reuse previously authorized payloads.

`services.mjs` composes the new reader with the unchanged streaming snapshot
candidate. Normal application consumers are unaffected. `baseline.json` records
the eleven unchanged source dependencies; the fork differs only in its descriptive
comment, factory name and the two-line entry construction. The adapter/receipt
identities remain byte-compatible because their observable contents are unchanged.

## Independent verification

The integration tests use the existing independent tiny locker example plus one
fact-free marker with a parser gap. They compare exact default/repeat/selected/
page/isolated projection and receipt bytes, consumed hashes, work/output metrics,
fact/snapshot/original read counts and no-write behavior. History after two analysis
replacements preserves its original projection without nested path/fact/snapshot
reads. The injected domain boundary verifies three-field records and keeps the
fact-free entry/gaps on every call; it retains counters only.

Adversarial cases preserve incomplete imports, ambiguous Java handlers, unsupported
consumers, corrupted unreferenced payloads/originals/rehashes with invalid ranges,
policy and registry refusal, and cancellation/metadata/policy fences after facts
have been read. A source-registration change unpublishes the inventory by trigger;
default selection returns `INVENTORY_UNAVAILABLE`, not an exception. The candidate
must preserve that exact refusal and perform no fact reads.

See [retained verification](../../docs/fixtures/loredock-compact-payloads/README.md)
for the first test-assumption failure. No forced GC or heap snapshot is needed to
prove this structural/semantic change. A later fresh, prospectively frozen,
uninstrumented complete lifecycle must establish any resource improvement before
production integration can be considered.
