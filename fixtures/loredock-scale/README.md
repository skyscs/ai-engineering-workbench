# Heterogeneous LoreDock system fixture

Task 024 expands the evaluation topology to **20 distinct repositories** while retaining
the original three-repository source commits unchanged. It supplies **79 text files**,
60 policy/binary/symlink canaries and a separate 20-question scale oracle. It is a small
static source corpus, not twenty runnable services, a production-sized load test or an
accepted twenty-source application. No dependencies, applications or source commands run.

[corpus.mjs](corpus.mjs) defines seventeen additional source sets. Their documentation
and implementation clues cover stock, shipping, notification, reporting, shared contracts,
tenant propagation, presentation components, legacy administration, local/production
configuration, Mongo migrations, architecture decisions and supplier import.

Different roles deliberately exercise boundaries: two applications in one repository;
a schema library that is not a producer; an additional order consumer; `orders`
collections in different databases; unresolved production placeholders and Dojo module
names; a renamed component; migration source without execution proof; unavailable
payment/carrier internals; and security properties not implied by identity propagation.
The original README/config mismatch and source-instruction canary remain unchanged.

## Reproduce and review

Use the pinned Node toolchain:

```sh
node scripts/loredock-scale-fixture.mjs
node --test scripts/tests/loredock-scale.test.mjs
pnpm build
node scripts/loredock-scale-readiness.mjs
```

The generator leaves an owned temporary root for inspection. `sources/` contains only
static source repositories. `manifest.json` and `oracle.json` are outside them; original
pilot records are retained separately as `pilot-manifest.json` and `pilot-oracle.json`.
Tests and the readiness probe clean their own roots. The CLI generator prints its root;
remove only that owned root when finished.

[baseline.json](baseline.json) freezes all twenty commit IDs, the full source/evidence
manifest digest and the new oracle digest. Each generated evidence locator includes
source revision, blob/content hash and inclusive line range. Tests regenerate two copies,
check the baseline and original pilot manifest, reopen every evidence file, verify
excluded canaries, and keep evaluator files outside all source trees.

[oracle.mjs](oracle.mjs) contains explicit expected information and required uncertainty.
It was authored before any model evaluation of this corpus. Do not supply it to product
retrieval, prompts or an extractor. Do not apply the original small-system oracle to the
expanded system as though its global claims were still exhaustive. Future evaluated
adapters must declare their supported conventions; no Spring/driver compatibility is
implied by these Java application ports and plain JS examples.

## Current result and next gate

[readiness-result.json](readiness-result.json) records the current production rejection
of the fourth repository. Three sources are admitted and indexed; sixteen further sources
are deliberately unattempted. No registration limit is bypassed. Twenty-source ingestion,
latency, retained storage and answer quality remain unmeasured. Fixture creation timing
is reported separately and must not be presented as ingestion or answer performance.

This corpus can reveal topology, evidence identity and scope mistakes. It is too small
to establish throughput, retained-data budgets or production usefulness. Later load
profiles must include an imbalanced large repository, long README files, many spans,
changed/deleted/new sources and repeated refreshes. A permitted private pilot remains
necessary after synthetic qualification. See the
[capacity audit](../../docs/loredock/SCALE_READINESS.md) for the next bounded work.

Task verification also fixed a pre-existing CI fixture lifetime problem: a child kept
alive by an empty timer could lose its unreachable SQLite ownership handle to garbage
collection. The storage helper now retains that handle, and the existing killed-owner
test explicitly requests collection before checking exclusion/recovery. Forced collection
reproduced the original failure; the strengthened check passes with the retention fix.
Production locking code is unchanged.
