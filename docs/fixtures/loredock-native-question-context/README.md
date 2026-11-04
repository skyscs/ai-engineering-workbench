# Native question-context design review

Task 119 is a source-backed design and prospective input freeze, not an executed
feasibility or model result. See [the contract](../../loredock/NATIVE_QUESTION_CONTEXT.md),
[ADR 0058](../../decisions/0058-loredock-native-question-context.md),
[frozen inputs](../../../fixtures/loredock-native-question-context/README.md) and
[static review record](review.json).

PR #122 passed push 41916361811 and pull-request 41916371049 at exact head `c59a792`
(862 tests) and merged as identical-tree `883b589`. The new design/input freeze is
`615570976d5c1a97cc4147c3f8e175bccc8fb1f5`.

Static authoring checks verify the factory syntax, seven unique JSON question cases,
eight boundary groups, four generated file vectors, five normative file hashes and
sixteen audited production source hashes. The [command log](static-first.log.gz) is
retained with raw/archive hashes. Generated source/path references resolve. Documentation
links and an empty application/package/script/workflow diff were checked separately.

The base, missing-consumer and dynamic-topic variants contain 24 files in six repositories;
the overlapping-root variant contains 25. There are no observed retrieval, parser, native
resolution, candidate, model or semantic scores. Hashing a data-only source factory does
not exercise the prospective matrix or consume its first comparison attempt. Source
idioms are familiar and agent-authored; these are not blind independent acceptance cases.

The chosen experiment preserves literal retrieval and original evidence, uses the complete
bounded resolution for relevance, admits at most one completely supported static path,
and retains ambiguity/omission and scope limits. It does not claim a prepared-answer owner,
durable witness retention or production publication validation already exists. Those
integration decisions follow only if the separate offline feasibility gate warrants them.
