# Bounded Dojo AMD object exports — frozen design

Extend only the existing text-only TypeScript/JavaScript adapter. No project loading,
module execution, package resolution, runtime requests or model calls. Freeze these
rules and examples before implementation and measurement.

The existing single top-level define call must still name exactly dojo/request, accept
one plain identifier parameter, and return from a single-statement factory body. The
factory must be synchronous and non-generator, with no rest/default parameter. Keep
existing global binding-count and assignment guards; reject direct eval or with in this
AMD profile because local binding resolution is unsupported in those constructs.

Retain the existing returned named-function profile. Add a returned object whose own
properties are all statically named, uniquely named, ordinary property assignments to
synchronous non-generator function expressions. Accept identifier names and string names
that satisfy the existing identifier grammar. Reject getters/setters, shorthand methods,
computed names, spreads, __proto__, duplicate names, unknown initializers and mixed shapes
as an unsupported module profile. At most 100 function exports are inspected under the
existing symbol budget. Reject oversized object profiles with an explicit omission.

Each export becomes an amd-function symbol with its actual property range and an owner
identity distinct from sibling exports. The request alias must retain its sole imported
binding; shadows/reassignments remain unsupported. Existing HTTP URL/method/header parsing,
nested-function exclusion and full-file original support remain unchanged. Do not claim
that any exported action is invoked or any proxy/route binding exists at runtime.

Bump the code projection to pilot-code-v3, including identity hashes and current review
reconciliation expectations. Preserve saved v2 contexts/answers/corrections as historical
bytes; v2 code notes cannot automatically reapply under v3. Declaration-map v2 is unchanged.
New answer interface previews record v3 but never backfill old saved contexts or change
prompt/schema/retrieval versions or source-selection budgets.

Verify fresh positive/adversarial parser cases; an owned multi-export Git fixture with
original ranges, sibling ownership, route candidates, revision/history/revocation fences;
old review provenance refusal; and the unchanged observed twenty-source incident inputs.
Report current v3 candidates separately from retained v2 results. Existing v2 offline
qualification must fail clearly for unsupported adapter provenance, rather than silently
rewrite old expectations. Preserve historical reports and old answer gates.

Run full checks and a sequential model-free browser smoke that opens the newly recognized
Dojo source/route evidence and retains unresolved dynamic-plugin/runtime gaps. This is a
syntax-profile expansion, not full Dojo, automatic routing, private-pilot or L5 acceptance.

References: [Dojo AMD factory definitions](https://dojotoolkit.org/reference-guide/1.10/loader/amd.html)
and [request provider documentation](https://dojotoolkit.org/reference-guide/1.10/dojo/request.html).
