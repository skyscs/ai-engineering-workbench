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

At the Task 028 freeze, reserved wordings had no answering-model output. Their retrieval
was inspected, and the same agent authored them after earlier failures. They are **not**
a blind or independent corpus. The contract reserved their model outputs for one later
evaluation after prompt changes were frozen, without repeated tuning against those
outputs. Task 028 permits zero model attempts.

Task 030 subsequently completes that [single separately budgeted model evaluation](../../docs/fixtures/loredock-prospective-answers/README.md)
with fixed prompt v8/retrieval v7. Agent review passes 11/12 development and 12/12 reserved
cases; an unsupported extra header-propagation claim fails the prospective gate despite
complete required content. These outputs are now observed, not reserved for future tuning.
The original contract/baseline above remain unchanged historical records.

After a normal build, reproduce the offline report or regenerate this worksheet:

```sh
node scripts/loredock-completeness.mjs
node scripts/loredock-completeness.mjs --rubric > fixtures/loredock-completeness/RUBRIC.md
```

See [question/rubric alignment and next implementation](../../docs/loredock/ANSWER_COMPLETENESS.md).
