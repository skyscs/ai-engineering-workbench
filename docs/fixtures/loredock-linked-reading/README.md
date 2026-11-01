# README-linked local documentation verification

Task 060, 2026-11-01. Scope `7621647`; implementation `ca6c182`; final message review
`343dfbe`. All sources are newly generated synthetic repositories; no models or corporate
inputs. The running user demo, its data and compiled assets remain unchanged.

`pnpm check` passed strict types, 445 tests and production builds. Thirty-four focused
checks/subchecks cover section/link navigation and the twenty-source boundary. Nine new
tests cover local paths, percent decoding, URI/traversal/control rejection, literal labels,
source order/deduplication, label/path/count bounds, code/comment exclusions, origin/target
citations, multiple parts, no recursion/cross-source fallback, corrupt originals, historic
refresh/restart and source/policy fencing. Existing protected-HTTP tests still cover the
single orientation endpoint. The scale test's first setup hit an existing `docs` directory;
fixture preparation was corrected to allow it, without changing production behavior.

The twenty-source integration test records sixty admitted documents: twenty READMEs,
fifteen manifests and twenty-five linked documents. All repositories receive their first
linked document, five receive their second and no third is admitted. This verifies reading
rounds rather than first-source consumption of all remaining slots. A second generation
fills the 640 KiB budget with twenty READMEs; all twenty contexts remain, while fifteen
manifests and sixty linked targets explicitly report the byte limit. Historical cards retain
their original reading links. The output cap remains 512 KiB.

[Raw browser result](result.json) records nine passing conditions on the compiled app:

- An owned proxy sentinel verifies isolation before ordinary application navigation.
- Linked reading starts collapsed and shows three target records, one explicit omission,
  a missing-document gap and an inert hostile label.
- Desktop and 390px layouts have no horizontal overflow.
- Both original parts of a long linked document and the referring README link reopen;
  evidence receives focus and retains the correct path/range.
- Update knowledge and historical selection open their respective target revisions.
- A delayed target-evidence response cannot repopulate an obsolete index.
- A delayed overview cannot restore a removed source's linked labels or IDs.
- A policy change clears reading navigation and fences pending original evidence.
- Source checkouts remain unchanged after explicit fixture preparation/update; no answer
  service request occurs.

Both [desktop](linked-desktop.png) and [mobile](linked-mobile.png) screenshots were visually
reviewed. A singular/plural omission message was corrected after the first successful
browser run; the final LoreDock builds and complete browser scenario then passed again.

## Reproduction and limits

With Node >=22.13, pnpm 10.15.0 and Google Chrome on Linux, build a clean checkout, then run:

```sh
LOREDOCK_SMOKE_OUTPUT=/absolute/result-directory node scripts/loredock-linked-reading-smoke.mjs
```

Use a separate owned checkout if another instance serves the primary checkout's compiled
assets. The check binds an ephemeral non-forwarding proxy, dispatching only to its own
in-process application with normal Host/Origin/session/CSRF/CSP rules. It never binds or
forwards to port 4244. A fresh browser profile and unique sentinel precede app navigation;
cleanup stops only owned processes and removes the generated fixture/data. The report and
screenshots remain in the requested output directory.

The link selector is a conservative Markdown profile, not a complete parser. External/
unsupported links are absent without being reported as missing local files. Fragments do
not resolve anchors; linked documents are not crawled recursively. These checks establish
mechanical reading behavior, not semantic architecture quality, a private pilot, or new
model-context coverage. Frozen evaluations and exhausted model budgets stay unchanged.
