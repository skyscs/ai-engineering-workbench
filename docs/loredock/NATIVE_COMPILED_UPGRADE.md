# Native history across genuine compiled analysis upgrades

Task 113 verifies schema-10 native history using two real compiled runtimes. The older
37-module archive exactly matches accepted Task 111 output, including every relative
import and fingerprinted file. The current composition has 38 modules. Both use the
pinned Node 22.23.2/V8 and the same verified installed TypeScript payload. The archive
needs no old worktree, Git history or network and is never imported by production.
It is not an OS/native-library bundle.

The older actual fingerprint is
`582e7b79b510b091ed2b73494b485f495aa8eecd7c6033c7c5588adf0622acdc`;
the current one is
`67ff7f67edc7abe7c4739e23764d33a91454556f32e82d1e67b84b6640d9fef2`.
No property override, module rewrite or fingerprint substitution is used. This differs
from Task 112's intentional shared-provider behavioral comparison.

The [committed regression](../../scripts/loredock-native-upgrade/README.md) uses one
fresh small complete four-source example with an undisplayed dependency. Its eight
phases are creation in the old runtime, forward history, explicit reanalysis, backward
reopening, then policy and revocation checks in each runtime. All eight pass, with six
exact history reads and eleven expected refusals. These are upgrade/authority phases,
not the separate sixteen-operation resource-qualification denominator.

The new runtime rejects an old snapshot/capture before explicit reanalysis while still
reopening saved native history. New analysis produces a different actual fingerprint,
generation and receipt. Old originals and full dependencies remain exact. The older
runtime rejects the new inventory for derivation, selects its compatible retained one,
reproduces the old receipt byte-for-byte as a duplicate and reads both saved histories.
Every successful history revalidates ten originals and all four dependencies, performs
zero Git/source writes, fact/snapshot/path reads, path work or publication locks, and
retains the exact saved projection. It reports current applicability as unchecked;
unchanged scope is not labeled stale. Exact byte/count metrics match the saved content.

Both runtimes deny old/new history after a policy change while retaining receipt bytes.
Revoking the source without displayed originals purges both generations and marks the
source purge complete; reopening in the old runtime preserves that outcome. Offline
strict schema/source checks and complete typed paths/original ranges use the existing
independent assessor and authored oracle. Actual service authorization remains mandatory.

Three archive integrity/portable-load tests and **817 full strict tests/builds** pass.
The first backward-read assertion omitted the required generation pin; its original
partial report/receipts/histories remain unchanged. Corrected and reviewed runs pass.
Ten command logs and 54 raw artifacts are
[retained](../fixtures/loredock-native-compiled-upgrade/README.md) with verified hashes.
No application code or user-demo data changes in this task.

Initial push CI at `6305cf2` failed an older ordinary offline-assessor test: its
reopened isolated operation sampled 164.052043 ms against 150 ms, while all functional
dimensions and the child lifecycle passed. The pull-request event passed independently.
The corrected ordinary test requires functional gates, retains any actual resource
failure and verifies its overall propagation, and injects each resource excess to prove
rejection. Nine focused tests/subtests and the full suite pass. Assessor bytes, reserved
families, numerical limits and original measurements are unchanged. The failed GitHub
step log is archived; runner-local temporary raw files were not uploaded and are not
claimed available locally. New exact-head CI is still required before acceptance.

Next [Task 114](../../tasks/114-loredock-bounded-write-final-qualification.md) freezes a
different final resource family after exact-head acceptance. Task 110 remains failed
and exhausted. Memory-cause attribution, dense-code/lifetime qualification, semantic/user
acceptance, private pilot, L5, public consumer migration and the Workbench bridge remain
separate. No model or corporate source was used.
