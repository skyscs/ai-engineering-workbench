# Bounded analysis write preparation

Task 112 reuses exactly the pending-unit INSERT and the checkpoint/cumulative-counter
UPDATEs within explicit store-owned scopes. Admission owns a synchronous scope for its
pending rows; one worker invocation owns a separate asynchronous scope. The existing
read scope remains read-only. Every write still executes with current bindings, existing
per-file transaction ordering, authorization, original validation and accounting.

The helper retains at most three statements, 4 KiB SQL and 144 KiB of admitted binding
bytes per statement. Only exact trusted SQL is eligible. Unrelated/oversized/unsupported
calls and overlapping, nested or busy use follow the old fresh-preparation path. An
oversized binding drops the old cached entry. SQL errors evict without retry and preserve
the same exception; scope completion/failure and store close clear owned references.
No rows or argument arrays are cached. Native statements can retain last bound values;
these ceilings are not native-memory quotas or immediate finalization guarantees.

Two accepted modules are preserved before implementation as independent source and
compiled behavioral controls. The same current fingerprint provider is intentional
for comparisons, not historical-runtime replay. Seven paired scenarios preserve exact
retained inventory/checkpoint/source state and SQL execution counts: three normal
inventories, pause/reopen/resume, interruption/reopen/resume, cancellation, injected
counter failure with transaction rollback and recovery, policy change and revocation.
Only new run IDs and validated clocks are normalized; original checkpoint hashes are
independently verified before rebasing IDs. Payloads and source hashes compare exactly.

On three 16-file inventories, each repeated SQL template has 48 actual executions in
both arms; preparation falls from 48 to 3. The independent earlier worker trace retains
all 171 ordered SQL calls/current non-clock bindings while total preparation falls from
171 to 14. These are small diagnostic call counts, not a resource-qualification claim.
Executable SQL remains in the fingerprinted analysis module; the helper has a separate
exact eligibility list, so changed caller SQL falls back fresh until explicitly reviewed.
The new helper affects the installed runtime closure; the analysis source change also
changes the real inventory fingerprint and requires explicit reanalysis normally.
No fingerprint is disguised and schema/source data remain unchanged.

Initial failures remain retained: a test-wrapper overload mismatch; an invalid policy
argument shape/path in the new comparison (including a repeated command after an edit
used the wrong working directory); and the earlier production test's now-obsolete
requirement that write preparations stay unchanged. Its strict ordered execution/binding
comparison remains, with exact new preparation counts. No production fallback, SQL limit,
source check, first report or exhausted resource family was altered to make tests pass.


Nineteen focused cases/subcases and **813 full strict tests/builds** pass. The first
committed compiled regression at `9999955` passes all seven behavior comparisons and
all sixteen native operations/seven raw comparisons. Observed small-run resource
rows pass too; this is not a large reserved qualification. All 38 actual runtime modules
are pinned. Initial failures, raw outputs and logs are
[retained](../fixtures/loredock-bounded-analysis-writes/README.md).

Next [Task 113](../../tasks/113-loredock-native-compiled-upgrade.md) verifies native
history across the genuine older/current compiled runtimes, without the shared-provider
assumption used by behavioral controls. The large Task 110 family stays failed and
exhausted. A different final resource family follows that independent transition check;
public consumers, semantic/user acceptance, private pilot, L5 and Workbench integration
remain separate. No model/corporate inputs or user-demo changes are included.
