# Prepared-answer admission verification

Task 125 uses ordinary owned permit fixtures and controlled runtimes. No corporate
sources, actual model calls or exhausted/reserved family runs are involved. Public
answer inputs remain unchanged. The complete new composition still requires prospective
resource and semantic qualification before default adoption.

Accepted base: `c1f6c37cacca27a4d803c18ebf3ae3988ce75966` (PR #128).
Controls preceded implementation in `4fb8c2e`; reviewed executable:
`82478312d239d97c8f7e0b3b29a4c0d983a8d52d`.
Production code and the initial full local check remain at `809b0c0`; the later executable
commit changes only deterministic test scheduling after CI exposed an ordering assumption.
Node 22.23.2, V8 12.4.254.21-node.56, TypeScript 5.9.3 and pnpm 10.15.0.

- [Review](review.json): checks, hashes, first failures, scope and limitations.
- [Runtime audit](runtime-audit.json): exact source/emitted changes and actual imports.
- `*.log.gz`: complete unedited local command output, including failed first runs.

`pnpm check` passed strict types, **929 tests** (17 Git, 18 AI, 43 storage, 664 LoreDock,
57 daemon, 130 scripts) and all production builds. Seventeen new compiled integration
tests exercise exact native/source-only prompt dispatch, citations, shared ownership,
realpath leases, quota/transaction rollback, all three authority boundaries, inventory
eviction, policy/review/build/original changes, late cancellation usage, restart,
corrupt/unknown witnesses, cleanup and accepted legacy execution parity. Existing legacy
answer tests separately passed 19/19. The second combined focused run passed 43/43;
two further restart/original-boundary tests were included in the full run.

The first combined focused run passed 36/43. Its failures were invalid `unknowns` prose
in the fake runtime (four expectations), CommonJS resolution of an ESM-only export in
the preserved-control loader (two), and a mistyped corruption-test trigger name (one).
The product validator correctly rejected the malformed fixture output. The first audit
also failed: direct emitted Answers imports omit type-only constructor dependencies.
The corrected audit explicitly unions native service/legacy roots, preparation and
Answers plus actual AI/core package imports. Both failed logs are retained, and these
corrections do not modify frozen source copies or old expected hashes.

Five modules have independently recompiled exact line deltas and `prepared-answer` is
new. The other 154 application source/emitted files, all 64 tracked package files and
80 frozen artifacts are unchanged. The 41-module native core and 48-module legacy
comparison closure are unchanged; the new service comparison union has 64 modules.
This union is not the entire HTTP/browser daemon and carries no old qualification.
The original analysis comparison harness remains hash-identical.

One warmed ordinary shared-budget observation used 158,428 units for saved input loading
and 437,184 including revalidation. It is not a near-limit, aggregate worker or semantic
qualification. The actual operation bounds remain unchanged; large retained inputs may
be refused by a validation work limit.

The ordinary fixture helper removes temporary repositories/catalogs on success **and
failure**. Raw logs are retained; failed temporary source/catalog trees are not claimed
as retained evidence. The primary checkout stayed clean at `592bbc0`. Both push and
pull-request CI must pass at the final PR head before acceptance.

See the [adapter contract](../../loredock/PREPARED_ANSWER_ADMISSION.md) and
[next public integration scope](../../../tasks/126-loredock-prepared-question-http-ui.md).

Push CI 41946324582 at `c5d7a8a` failed one test-ordering assertion: a real asynchronous
index rebuild could finish after preflight legitimately began. The worker still refused
stale publication. The corrected test holds the scheduled worker until the new build is
published, then executes actual validation and requires zero preflight calls. All 130
compiled script tests pass after this test-only fix. Production code is unchanged. Pull-request CI 41946364449 independently failed the same assertion. A cancellation request
raced with its completion and was refused. Both failed CI logs and the post-fix script
log are retained, bringing the archive to 14. New final-head CI events are required.
