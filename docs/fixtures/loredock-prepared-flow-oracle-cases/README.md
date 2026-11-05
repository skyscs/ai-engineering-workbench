# Reusable source and oracle prerequisites

The [case function](../../../scripts/loredock-prepared-flow/oracle-case.mjs) accepts
already materialized sources, original texts, expected outcomes, quote references and
an optional engineer-note target. It contains no reserved-family names. Before any
candidate catalog/index/retrieval operation it checks every supplied source file against
its text/hash/size, required source quotes and the declared note endpoints. A focused
test rejects missing quotes or changed source bytes before a catalog or daemon exists.

Each case prepares exactly once, retains the actual review and checks that no answer was
admitted. Independent source assessment failures are recorded separately from setup or
lifecycle errors. The [ordinary entry](../../../scripts/loredock-prepared-flow/oracle-cases-development.mjs)
may continue to the next independent case after an assertion about its review, while
keeping the overall run failed. Unknown setup/lifecycle errors stop remaining cases.
No retry, modified oracle, replacement context or successful bounded-refusal credit is
introduced.

## Explicit setups

Most cases index and analyze through actual production HTTP. The catalog-only setup uses
the actual Catalog without CodeAnalysisFollow, completes indexing, stops the catalog and
closes its store. It preserves a complete checkpoint before reopening the working catalog
through the actual production entry. The existing index receives no replacement build
or manual analysis. Code analysis remains absent before and after preparation, and the
review refers to the original published build. The checkpoint is never opened for SQLite
inspection; verification uses complete independent copies.

The engineer-note setup finds exactly one actual `http-target` edge matching both supplied
source/path endpoints. It fetches the edge's original evidence and checks both header
quotes before posting the note through the public corrections API. The returned and
reviewed note remains human/unverified. This parameterization supports the later frozen
setup without attaching a note to an arbitrary edge or substituting a generated statement.

## Ordinary observations

The original eight-source permit cases are unchanged. One new ordinary execution makes
exactly ten preparations in the declared order. All setup/lifecycle checks pass. Nine
independent prerequisite assessments pass; D01's required complete native path remains
**failed** because its 8,368 derived bytes exceed the unchanged 8,192 limit. Its required
original references are present, but useful native context is omitted with `derived-size`.
The run exits 1, retains the failed positive and makes no model calls.

Consumer-method and dynamic-topic gaps retain their exact omission counts and exclude
unsupported delivery/dispatch edges. Ambiguous actions remain ambiguous; the empty
handler, header mismatch, unavailable analysis, unknown deployment, human note and
untrusted quotation preserve their original evidence and stated limitations. This is
an ordinary harness control, not an execution or score of the reserved S01–S10 cases.

## Retention and validation

[records.json](records.json) binds the complete execution, source Git trees, ten stopped
working catalogs, catalog-only checkpoint, copied-catalog inspections, focused control
and verification logs. All eleven copied catalogs pass integrity and foreign-key checks
and contain zero answer attempts. The two catalog-only copies have zero analyses; each
other case has one actual analysis. Independent inspection verifies 80 clean synthetic
Git identities, 33 required review quotes and all 194 protected-client responses (184
exact byte sizes and ten redacted sessions). It confirms one preparation POST per case,
the original published-build identity, exact note provenance and unchanged raw trees.

The external owner records the expected driver failure, no cleanup errors and no surviving
processes. Installation, production builds, the focused input guard, syntax and the
original application/input seal pass locally. Both full final-head CI events remain
required before merge. No application, parser, schema, frozen input/oracle/threshold,
reserved-family candidate or user demo changes. Full R01–R15 integration, remaining
resource assessment and the final executable/environment/output seal remain pending;
resource qualification and model eligibility are false.

The preceding accounting checkpoint is accepted through
[PR #150](https://github.com/skyscs/ai-engineering-workbench/pull/150): push 42042208634 and
pull_request 42042306502 pass 984 tests at exact head
`cebd01477b36fec6964ed5d2f37b376fc4236e2d`. Merge
`be1b78c59d1396ee3da82fdfaa98c28d371ab534` has the identical tree. Both complete CI logs
are retained here.
