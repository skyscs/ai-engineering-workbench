# Native receipt codec verification

Task 105 adds a pure internal format boundary for native v2 paths, without storage,
schema migration or an application consumer. See the [format contract](../../loredock/NATIVE_RECEIPT_FORMAT.md)
and [validation manifest](validation.json).

The final focused run passes 79 cases/subcases. Independent hand-authored records
and actual native v2 output cover default, selected and isolated paths; tests rehash
nested mutations so outer integrity cannot hide a missing validation check. Complete
strict checks/tests/build pass 720 tests. The separate compiled smoke preserves a
23,808-byte receipt through restart and two inventory replacements, with no source,
fact or path reads during pure decoding. No model, corporate input or measured
resource family is used. This does not authorize historical source release.

All twelve command logs are retained as deterministic gzip archives, including
initial type/test failures and the event-environment correction described in the
manifest. The first full check was launched before the third focused result had
been inspected; it reports the same environment refusal, not an independent cause.
The corrected focused and full runs both pass. Production changes after initial
implementation are explicit commits; no failed result is overwritten.

The implementation imports no experimental helper or store. Its existing dependency
modules, historical scripts/manifests/archives and v1 consumers remain unchanged.
Schema-10 ownership and native publication/history remain subsequent tasks.
