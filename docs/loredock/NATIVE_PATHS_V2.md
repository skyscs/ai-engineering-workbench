# Native connected paths v2

Task 103 introduced the typed internal producer for complete capture. After the fresh
Task 114 qualification, Task 115 connects the launcher, existing HTTP routes and browser
to this producer directly. Native saved-receipt APIs/UI and answer/review integration
remain separate. See the [public read contract](CODE_PATHS_API.md).

The [reader](../../apps/loredock/src/code-paths-v2.ts) uses
`loredock-code-paths/2`, `loredock-connected-display/2` and `connected-paths-v2`.
Its complete identity includes the literal-topic rule and shared accounting version.
Generation, node/edge/flow IDs and graph/projection hashes are derived natively;
selection from v1 or the experiment refuses with `INVALID_GENERATION`. Existing
compatible analysis inventories remain usable; derivation versions have distinct IDs.

Topic delivery requires equal nonempty direct double-quoted Java literals with no
escapes/newlines and at most 256 UTF-8 bytes, plus the qualified record/contract and
unique consumer conditions. The witness records both expressions and their original
evidence IDs. Dynamic, empty, escaped, overlength or different expressions preserve
explicit omissions. Configuration similarity cannot supply a missing witness.
Broker identity, deployment activation, serialization and dispatch remain unverified.

The producer uses the actual `OperationBudget` for every path charge/check. A
standalone call owns/closes its budget; a trusted internal caller can pass one budget
through path work and later receipt work. The path claims it once, preserves the
original deadline and exact subtotals, and never exposes a budget in HTTP or user
configuration. The existing local limits can only decrease. Checkpoints remain
cooperative and are not hard interruption of synchronous SQLite/parser work.

Streamed snapshots, scoped statement reuse and compact canonical facts use the Task
101 production services. Full payload/original validation, all file domains/gaps,
ambiguity, consumed hashes, metadata/source/policy fences and the final synchronous
checks remain. A [shared catalog guard](../../apps/loredock/src/code-paths-owner.ts)
prevents simultaneous v1/v2 path reads. Each version owns its cancellation/stop state;
worker overlap uses the existing fresh-read fallback and invalidates changed input.

Version-specific resolver/admission types keep the v1 contract intact while reusing
metadata, evidence and work primitives. Production imports no experimental or test
module. The unchanged offline producer is a test control only: comparisons normalize
declared version-derived IDs, while retaining complete semantic content, original
support, coverage, omissions and every work charge. Native hashes, exact repeats and
generation-bound pages/selections are checked separately.

See [retained verification](../fixtures/loredock-native-v2-producer/README.md).
Task 103 alone did not establish complete capture/history or resource acceptance.
[Task 104](../../tasks/104-loredock-native-capture-ownership.md) defined storage/lifecycle
ownership; subsequent native capture, upgrade and independent assessment work led to
the [Task 114 qualification](BOUNDED_WRITE_FINAL_QUALIFICATION.md). The public read
migration preserves those producer bytes and bounds. Dense-code/lifetime, semantic/user,
private-project/L5 and Workbench acceptance remain separate.
