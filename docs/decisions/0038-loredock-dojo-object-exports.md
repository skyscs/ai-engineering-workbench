# ADR 0038 — Bounded Dojo AMD object exports

Status: implemented in Task 039. Code adapter: `pilot-code-v3`.

## Context

The existing Dojo profile recognizes a returned named function but misses a common
synthetic module that returns an object of function-valued properties. The request
method helpers are already supported. This export-shape gap prevents a source-backed
HTTP candidate from the stock administration module to its declared reservation route.

The [Dojo AMD guide](https://dojotoolkit.org/reference-guide/1.10/loader/amd.html) documents
factory-produced module values, and [dojo/request](https://dojotoolkit.org/reference-guide/1.10/dojo/request.html)
provides the imported request boundary. This implementation deliberately supports only
the frozen subset below, not general Dojo or deployed module wiring.

## Decision

Preserve in-memory parsing without execution, configuration loading or package resolution.
Accept the existing single `dojo/request` dependency with one plain factory parameter
and a single return statement. The factory must be synchronous and non-generator.
Existing alias binding-count/reassignment guards apply; direct eval and with are rejected.

In addition to a returned named function, accept at most 100 uniquely named ordinary
properties whose values are synchronous non-generator function expressions. Identifier
and identifier-shaped string names are allowed. Reject the whole object profile for
duplicates, computed properties, spread, accessors, shorthand methods, __proto__, mixed
initializers or excess exports. Nested functions, dynamic URLs and unsupported request
syntax retain their existing gaps.

Each export owns a distinct symbol/property range and its contained operations. Complete
original file support still includes the module dependency and other relevant declarations.
AMD exports cannot resolve an ES module named import: such interoperation needs evidence
outside this profile. No call becomes proof of invocation, live routing or deployment.

Use `pilot-code-v3` in graph identities and current review reconciliation. Saved v2 answer
contexts/results and v1/v2 correction histories remain readable and byte-identical.
Earlier code-adapter notes cannot be implicitly reapplied. New derived interface contexts
record v3; original source selection, prompt/schema versions and budgets remain unchanged.
Declaration-map v2 and the offline precision proposal are unchanged.

## Verification and limits

The design and 24 parser examples were frozen in `4cfe08a` before implementation. Tests
cover shape/binding guards, export limits, non-execution, exact sibling ownership, HTTP
route originals, source revisions, revocation, historical answers and incompatible notes.
Review also closes the unsupported ES-import-to-AMD-export path.

On the unchanged observed incident corpus, ir06 now includes inventory-api. Combined
candidate recall reaches 22/22, but five cases still exceed useful size bounds. Original
span and lexical selections stay unchanged; new derived v3 context/hashes are expected
to differ from v2. The current report is separate from every retained historical report.
The old v2 precision qualifier refuses current v3 inputs explicitly.

Broader Dojo modules, computed plugins, multiple dependencies, runtime bindings,
automatic repository selection and independent/private-pilot acceptance remain open.
