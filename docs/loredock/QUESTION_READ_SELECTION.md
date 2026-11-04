# Bounded question reads and complete-resolution selection

Task 122 implements the first production foundation of
[ADR 0059](../decisions/0059-loredock-prepared-question-lifecycle.md). Current answers,
prompts, HTTP requests and browser behavior remain unchanged. The new capabilities are
internal; [Task 123](../../tasks/123-loredock-prepared-question-owner.md) will own their
composition before any consumer can use a prepared snapshot.

## Actual lexical accounting

A caller constructs the existing `OperationBudget` before retrieval, creates a one-use
`LexicalReadAccount`, then calls `store.withLexicalReads(account, synchronousAction)`.
The account does not close or reset the shared budget. Native reads happen after the
lexical scope returns and consume that same budget through their existing path accounting.

Actual `CatalogStore.one/all` results contribute zero/one or array-length SQL rows.
A successfully checked `Catalog.evidence` contributes the returned text's UTF-8 bytes.
Prepared statement reuse still executes and charges every returned result. Failed SQL
accessors contribute no returned rows; failed evidence integrity/range/metadata validation
contributes no original bytes. A completed SQL/evidence read whose budget charge fails is
recorded as actual work with rejected units. A throwing budget observer that already
accepted a charge retains those accepted units. Budget errors and native accessor errors
keep their identities.

A weak store-keyed registry holds a separate AsyncLocalStorage scope per participating
store, with no shared meter across catalogs. Nested or reused accounts and async callback
results fail explicitly. Deferred descendants retain a closed scope and fail before SQL,
even after store shutdown. They cannot fall through to unmetered default reads. Independent
unscoped calls preserve ordinary SQLite behavior and result objects. Archived stores
remain usable by current Catalog because evidence accounting is a no-op when that exact
store has no active scope; no new method is assumed on an archived object.

This capability is for trusted synchronous retrieval through Store/Catalog methods.
It is not a database sandbox or a meter for arbitrary direct `store.db` access. No current
HTTP input can supply it, its counters or its limits.

## Selection before display admission

`CodePathsV2` optionally accepts one typed internal `selectRoot` callback. It receives a
read-only view of the complete bounded resolution and the actual path work capability,
before display admission. The existing owner, cancellation, SQL/source fences, generation
identity and supplied OperationBudget remain in force. Explicit root/page selection cannot
be combined with this callback. Returned root membership is checked and charged within
the same work capability; invalid or absent selector results cannot fall back to defaults.

The separate typed `chooseQuestionRoot` policy preserves the offline
`exact-anchor-reachability/1` semantics: whole qualified symbol, complete HTTP method/path,
or direct literal topic, with every anchor original already issued in the lexical context.
Reverse reachability considers all roots, visits cycles once and refuses traversal beyond
1,000 visits. Zero eligible roots, multiple eligible roots and incomplete traversal are
explicit distinct outcomes. This is a narrow exact-anchor policy, not natural-language
relevance, a completeness claim or authorization to change a repository.

Without the callback, default/explicit/paged outputs remain byte-identical to accepted
compiled controls. With it, a selected response equals the existing explicit-root response,
including generation/projection identities, direct-topic witnesses and partial-path gaps.
No public schema, parser identity, native receipt encoding or answer hash changes.

## Verification and limits

[Accepted controls](../../apps/loredock/tests/fixtures/question-read-reference/README.md)
retain three original source and emitted modules before implementation. An explicit edit
manifest reconstructs current source; independent compilation checks emitted bytes. Review
added fail-closed handling for an absent selector result and metered root validation to the
initial planned delta. The original controls and historical experiment manifest are intact.

Ordinary compiled tests compare full retrieval, input hashes and prompt bytes against an
independent accepted Catalog and count actual SQLite results separately. They cover prepared
reuse, exceptions, accepted/rejected charges, genuine archived Store compatibility, late
roots, full/partial paths, direct topics, ambiguity, unsupported originals, generation
mismatch, cancellation, competing readers and SQL/source fences. Policy parity additionally
checks absent/prefix/qualified anchors, cycles and the traversal bound. Existing archived
runtime compatibility, saved history, receipt/purge and HTTP tests remain in the full suite.

[Verification records](../fixtures/loredock-question-read-selection/README.md) retain all
first attempts and the reviewed source/runtime delta. Old parser modules remain unchanged;
new lexical accounting changes the runtime closure, so old near-limit resource measurements
are historical evidence only. No exhausted family was rerun and no model was called.
A fresh complete-preparation resource gate and semantic/model gate remain necessary before
native context becomes the default answer input in the opt-in pilot.

The root `pnpm test` command builds the daemon once before parallel script tests.
Individual test files must not write their shared `dist` directory concurrently. For
focused compiled checks, first run `pnpm build:packages` and
`pnpm --filter @loredock/daemon build`, then `node --test` on the desired script tests.
The first full check reaching these parallel script tests exposed this build/import race; it is a test-runner
ordering fix, with no change to application compilation or runtime behavior.
