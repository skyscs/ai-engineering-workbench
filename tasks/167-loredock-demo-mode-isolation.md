# Task 167 — Isolate demo startup from inherited prepared-answer mode

Status: planned after Task 166 exact-head CI acceptance. Narrow repair of a source-review
finding; no model, browser, resource or native executor experiment.

The demo child environment and printed reopening command force answers/development off,
but currently preserve an inherited LOREDOCK_PREPARED_ANSWERS=1. The production entry point
correctly rejects prepared answers without cited answers. This is a statically identified
startup conflict; Task 166 did not execute a failing demo to establish it.

1. Retain Task 166's source review and both complete exact-head CI logs. Preserve all
   consumed first results, API/resource contracts and historical compatibility manifests.
2. Explicitly disable prepared-answer mode in both demoEnvironment and demoRestartCommand.
   Preserve the selected demo data directory, model-free/development settings, unrelated
   environment fields and parent environment. Do not weaken the normal startup guard,
   clear arbitrary configuration, change ports or introduce another launcher/runtime.
3. Add focused regression coverage for an inherited prepared flag and the printed shell
   command, including literal paths with spaces, quotes and substitution characters.
   Use an explicitly synthetic child environment. Keep the real model/provider absent.
4. The demo script is pinned by Task 140's owned-parser compatibility delta. Add an exact,
   narrowly reviewed inverse for these environment edits and verify the original full
   source hash. Preserve the original manifest/hash and archives; unrelated edits must
   still fail. Do not relabel historical evidence as testing the changed helper.
5. Update the temporary first-use workaround once the repair is verified. Confirm emitted
   application JavaScript, normal entry point and answer switches are unchanged. Ordinary
   focused/full tests suffice; do not invoke a consumed demo/resource/qualification entry.
6. Use workspace concurrency one and two available CPUs for the local full check. Review
   focused/full results, the entire diff and both complete exact-head CI logs before merge.

This fixes demo environment selection only. It grants no application resource, semantic,
forced-crash/orphan, L5, private-project or Workbench bridge acceptance.
