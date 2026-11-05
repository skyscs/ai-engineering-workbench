# Reserved complete prepared-flow inputs

Task 127 freezes the owned kiln-workshop family for the
[prospective contract](../../docs/loredock/PREPARED_FLOW_QUALIFICATION.md).
It is **unobserved by the application**: static generation/hashing verifies source
bytes and quote ranges only. No index, parser, retrieval, preparation, resource run
or model output exists for this family at the input seal.

- [corpus.mjs](corpus.mjs): twenty repositories; representative, near-limit, ambiguous,
  missing-consumer and dynamic-topic variants. No application or oracle imports.
- [oracle.json](oracle.json): ten questions, exact source quotes, required propositions,
  omissions, uncertainty, forbidden claims and human-note provenance. Author review is
  not independent external acceptance.
- [protocol.json](protocol.json): fifteen resource/lifecycle cases, complete history and
  browser measurements, fixed thresholds, bounded future model stage and stop rules.
- [freeze.json](freeze.json): all normative hashes, quote ranges, generated file counts,
  accepted source/runtime/browser bindings and ordered vector hashes.
- [source-vectors.json.gz](source-vectors.json.gz): every generated source/path/byte/hash
  tuple. Its compressed and uncompressed hashes are both sealed.

After a normal pinned installation/build, static verification is:

```sh
node fixtures/loredock-prepared-flow/seal.mjs
```

This command never imports an application module or opens a candidate catalog. The
initial authoring `--write` refuses to overwrite an existing seal. Do not regenerate
the seal after observation, add this family to ordinary product tests, import its
oracle into a producer or pass its sources to a driver before the final executable seal.

The near-limit variant uses 500 files per repository (10,000 total), with constant-only
padding around several behavioral examples. It tests count/scan pressure on a sparse
graph, not dense graph capacity or production realism. The same declared family has
an ordered model-free stage and a conditional semantic continuation; the latter is not
blind after model-free observation. Any failed prerequisite exhausts the continuation.
All old observed families remain exhausted. Ordinary permit development stays separate.

Next: [Task 128](../../tasks/128-loredock-prepared-flow-resource-qualification.md) builds
the driver on ordinary inputs, seals it, and executes the one declared model-free run.
No real model invocation or default activation belongs to that task.
