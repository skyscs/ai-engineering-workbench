# Dojo object-export verification

Task 039 follows PR #42 (`1af275f`). Commit `4cfe08a` freezes the profile and 24 syntax
examples before implementation. Only owned synthetic sources were used; no model calls.

[Frozen design](../../../fixtures/loredock-dojo-exports/DESIGN.md) ·
[Current v3 diagnostic](candidate-result.json) · [Browser verification](browser-result.json) ·
[ADR 0038](../../decisions/0038-loredock-dojo-object-exports.md)

The code adapter now recognizes literal function-valued properties returned by the
supported single-dependency Dojo AMD factory. Existing request helpers remain unchanged.
Each export has its own symbol/range and operation ownership, while original citations
include the complete module evidence. ES module imports do not resolve AMD properties.
Dynamic plugins, aliases with uncertain bindings and unsupported object shapes remain gaps.

## Current diagnostic

| Observed ten-case incidents | Previous code v2 | Current code v3 |
| --- | ---: | ---: |
| Critical repository occurrences | 21/22 | 22/22 |
| Every critical repository present | 9/10 | 10/10 |
| Within useful candidate bound | 5/10 | 5/10 |
| Both necessary scope conditions | 4/10 | 5/10 |
| Automatic routing/abstention | Not implemented | Not implemented |

The ir06 union now contains legacy-admin, portal, order-api and inventory-api. The new
original-evidence HTTP candidate connects the stock caller to its literal reservation
route. The incidental portal/order-api alternative remains visible; no ranking rule is
tuned to remove it. Union counts are `[7, 6, 1, 2, 2, 4, 7, 7, 1, 8]` in case order.
Configuration comparisons still widen five case scopes.

Both fresh generations select the same sources and relationship support after normalizing
symmetric declaration sides; raw side differences remain recorded. The diagnostic verifies
176 original-support occurrences against Git. Task 035 original span selections and
Task 036 primary lexical selections are unchanged. Derived interface metadata now records
v3 and can include newly recognized comparisons; old input hashes are not claimed unchanged.

The Task 038 precision proposal remains offline. Its v2 qualifier now refuses v3 inputs,
so historical results cannot silently become measurements of a different parser. Read
the retained report or use its frozen implementation to reproduce it.

## Verification

Full checks pass with 356 tests, strict types and builds, followed by the current
diagnostic and final browser acceptance. Focused parser, graph and historical-data
checks pass, including all 24 frozen cases, 100/101 export
limits, no execution, exact sibling ranges, route references, revision/revocation fences,
historical v2 answer replay and refusal to reapply v1/v2 code corrections.

Browser acceptance uses twenty owned sources with answer mode disabled. It opens both
new Dojo caller and inventory route originals, retains dynamic-plugin and runtime gaps,
and checks existing escaping, keyboard/mobile access and late response fences. The first
new harness assertion omitted the existing `adapter:` prefix on omission keys; correcting
that assertion requires no product workaround. Review found and fixed the unsupported
ES-import-to-AMD-property resolution, followed by focused and full verification.

After building, reproduce the current diagnostic and browser checks with:

```sh
node scripts/loredock-candidate-links-evaluation.mjs
node scripts/loredock-candidate-smoke.mjs
```

Keep browser runs sequential because they own port 4244. No historical model answers,
source corpus or old scores are rewritten. Full Dojo/framework coverage, independent
semantic acceptance, actual missing-evidence decisions and the Workbench bridge remain open.
