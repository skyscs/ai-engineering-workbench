# Bounded-write native composition evidence

Task 114 preserves its single reserved run without repair or retry. All sixteen complete
operations pass source support, exact paths, usefulness/history, accounting/no-write,
lifecycle and fixed resource gates. All seven cross-process byte comparisons pass.
The outer process and both workers exit zero. Maximum sampled RSS is 340.2734375 MiB
against 384 MiB; reopened history after two replacements uses 328.6171875 MiB.

The [validation manifest](validation.json) records seven command logs and 49 raw
artifacts, each with original length/SHA-256 and archive SHA-256. These include input/
runtime/acceptance pins, metadata, raw output/receipt bytes, actual stored receipts,
worker/coordinator assessments, stdout/stderr and all process exits. Owned SQLite
catalogs and source/Git directories remain at their original recorded locations.
The initial build exit was not retained after context recovery; its complete log is
preserved, and a subsequent full `pnpm check` independently passes all 817 tests/builds.

Inputs froze at `67f858d` before measured head `7fcc73d`. No previous resource family
was rerun or altered. No production source, driver, assessor, resource limit, user demo,
model or corporate input changed. This marker-heavy synthetic result permits a separate
public-consumer task after CI; it does not qualify dense-code/lifetime, semantic/user,
private-pilot/L5 or Workbench behavior.
