# Resource observation decision evidence

This documentation-only stage retains the two complete CI logs reviewed before Task 141
merged. It does not run a resource control, install a browser or call a model.

Accepted head: `9cdccb1e7b3fff24eea293a727eb44e8ae2f196b`.
PR: [#174](https://github.com/skyscs/ai-engineering-workbench/pull/174).
Identical-tree merge: `361728e19cdea54688b35e0b0920a24037ace54f`.

| Event | Run | Job | Tests | Typechecks / final builds |
| --- | --- | --- | ---: | ---: |
| Push | 42162837654 | 127712344836 | 1,133 | 10 / 10 |
| Pull request | 42162880154 | 127712476018 | 1,133 | 10 / 10 |

Both logs contain six successful test suites (17, 18, 43, 728, 57, 270), with zero failed
or cancelled tests. [records.json](records.json) binds the raw and compressed bytes:
[push log](task141-ci-push.log.gz), [PR log](task141-ci-pr.log.gz).
The new [decision](../../decisions/0065-loredock-resource-observation-boundary.md) cites
the retained ordinary findings and primary runtime/vendor documentation. Neither CI success
nor the choice of a new browser environment changes the failed resource gates.
