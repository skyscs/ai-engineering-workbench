# Question read and selection verification

Task 122 adds internal synchronous lexical accounting and complete-resolution native
selection. [The implementation contract](../../loredock/QUESTION_READ_SELECTION.md)
describes the compatibility and ownership boundary; no consumer is enabled here.

The final local `pnpm check` passes **883 tests** (17 Git, 18 AI adapter, 43 storage,
663 LoreDock, 57 Workbench daemon and 85 script tests), strict types and all builds.
Focused source validation passes 29 tests; compiled validation initially passes all 13
question tests, including the separate ordinary 44-case matrix and ten negative assessor
checks. The final six-test compiled follow-up and full check cover the reviewed changes.
These use owned permit examples only. No reserved library/resource/model family is rerun.

The [review record](review.json) indexes all 17 compressed first-attempt logs with raw
and archive hashes, plus the [static audit](static-first.log.gz). Failures remain visible: missing initial workspace build dependencies,
three old Catalog hash assertions, a stale emitted-output audit, one focused command from
the wrong directory, and a parallel compiler/import race in the second full check. The
source pins now prove the exact permitted Catalog delta; historical expected hashes remain
unchanged. Root `pnpm test` builds the daemon once before starting parallel script tests.
The third full check passes without test or resource-limit relaxation.

[Runtime audit](runtime-audit.json) records the three extended modules (`catalog`, `store`,
`code-paths-v2`), one added lexical helper and 36 unchanged old native modules. The broader
legacy composition retains its other 43 old modules. All nine parser identity modules and
TypeScript remain unchanged; the separately imported typed selection policy has its own
emitted hash. Eighty frozen Task 120 files remain identical; only its normal regression
test is extended to prove the declared production delta. Its sealed inputs/results and
copied experimental producer are unchanged and the family remains exhausted.

The accepted [source/emitted controls](../../../apps/loredock/tests/fixtures/question-read-reference/README.md)
were committed as `b5d5265` before implementation. New source and emitted bytes are checked
against their explicit edit manifest, including reviewed absent-selector rejection and
charged root-membership validation. Actual compiled public default/explicit/page output,
legacy retrieval/input/prompt bytes, original support and accepted/rejected charges are
compared independently. Final ordinary lexical observations include:

| Question | SQL rows | Original bytes | Accepted units |
| --- | ---: | ---: | ---: |
| Apply through permit.granted.v3 | 221 | 7,055 | 7,276 |
| Topic entry point | 219 | 6,912 | 7,131 |
| Unmatched vocabulary orientation | 180 | 4,849 | 5,029 |

These are correctness observations, not scale/capacity or model-quality acceptance.
Successful tests stop owned services and remove temporary source/catalog directories;
the committed fixture generators and logs remain. The primary checkout stays clean at
`592bbc0`; no user demo, corporate source, credential, schema, prompt, HTTP/UI or model
connection is changed. Task 121 / PR #125 passed both events at `896e484` and merged as
identical-tree `2519990`. This slice awaits its own exact-head CI; next is the
[bounded preparation owner](../../../tasks/123-loredock-prepared-question-owner.md).
