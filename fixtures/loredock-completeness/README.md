# Prospective completeness questions

Task 028 adds twenty-four question wordings over the unchanged twenty-source fixture.
The [contract](cases.mjs) defines twelve intents: eight narrow/contextual intents for
stock topics, reservation routes, shipment projections and supplier cursors, plus four
controls for production configuration, identity enforcement, schema ownership and
migration execution. Each intent has a development wording and a reserved wording.

Read the [reviewer worksheet](RUBRIC.md) for every question, required proposition,
necessary qualification, optional context and forbidden assertion. Claims remain
subject to source support even when they provide optional background. A scoped claim
can establish a limitation without a mandatory keyword or redundant question.

The [baseline](baseline.json) pins the complete contract, source/oracle baseline and
the previous raw/semantic-review files. It was saved before the first retrieval
measurement. Expectations stay outside generated source repositories and model inputs.
No original question, source, score or failed Task 027 gate is changed.

The [offline measurement](../../docs/fixtures/loredock-completeness/README.md) finds
the complete recorded evidence basis for 12/12 development and 10/12 reserved wordings.
These counts measure selected original files/ranges, not correct model answers. A
reviewer may find semantically equivalent evidence in another issued passage and must
record that judgment; for example, the h02 handler record already supplies message
fields even though the chosen shared JSON contract is absent.

Reserved wordings have no answering-model output. Their retrieval has been inspected,
and the same agent authored them after earlier failures. They are **not** a blind or
independent corpus, and are no longer held out for retrieval changes. Reserve their
model outputs for a single subsequent evaluation after any prompt changes are frozen;
do not repeatedly tune against those outputs. This task permits zero model attempts.

After a normal build, reproduce the offline report or regenerate this worksheet:

```sh
node scripts/loredock-completeness.mjs
node scripts/loredock-completeness.mjs --rubric > fixtures/loredock-completeness/RUBRIC.md
```

See [question/rubric alignment and next implementation](../../docs/loredock/ANSWER_COMPLETENESS.md).
