# Answer-owned witness storage verification

Task 124 passes **912 tests, strict types and builds**. Focused validation passes 34
compiled preparation/read/storage checks, 46 source storage/answer checks and 13 source
parity checks. The final 13 storage tests include actual quota tombstones after purge.
Both final-head CI events remain required before merge.

[Review](review.json) retains every first failure and all raw log hashes. The initial
focused failures were incorrect fixture state, a capture result field and a null-prototype
comparison. The first full check detected two historical comparisons needing explicit
schema deltas. A wrong authoring working directory left the first follow-up unchanged.
The corrected comparisons preserve the original harness, source pins and old raw records.
All 18 logs are losslessly compressed. Two failed ordinary comparison trees retain all
242 files / 12,349,438 bytes, including stopped databases, Git sources and raw query traces.
Successful fixtures and other failed transient fixtures are removed by their teardown.

The normal analysis-write comparison requires exactly one additional witness-purge SQL
execution on revocation. All other execution counts and retained state must match. The
schema-8 migration comparison independently verifies every old answer field byte-for-byte
while accounting for the new legacy discriminator and empty witness table. Neither changes
the frozen experiment or its expectations.

[Runtime audit](runtime-audit.json) verifies 156 unchanged application source/emitted
files, exact Store/Answers deltas and all nine unchanged parser modules. Native core
changes only Store and adds the independent schema module; the complete prepared-storage
composition has 54 modules. The actual parser fingerprint remains `67ff7f67`. All 80
previously unchanged frozen artifacts and the original comparison harness are intact.
No prior resource qualification transfers to this composition.

The genuine archived 37-module runtime creates schema-10 catalog/receipt state with its
actual `582e7b79` parser fingerprint. Forward migration preserves all legacy answer bytes
and native files; partial migration rolls back; the old daemon explicitly refuses schema
11. Abrupt child-process exits after attempt, dependency and witness insertion leave no
partial committed answer. Source-only and full native witnesses, actual inventory eviction,
restart interruption, corruption, foreign binding, graph-absent source revocation, pending
purge recovery, stopped reporting, compaction and complete backup/restore are covered.

The SQL byte-boundary fixture reaches 768 KiB and 48 MiB with UTF-8 payloads. Those
deliberately non-JSON values isolate storage constraints and are refused by the prepared
reader; they are not valid produced question inputs or a new resource/semantic evaluation.
All 64 retained or purged records consume slots independently of saved native receipts.

No model call, corporate source, exhausted evaluation family or user demo was used.
See the [durable contract](../../loredock/ANSWER_WITNESS_STORAGE.md) and
[next admission task](../../../tasks/125-loredock-prepared-answer-admission.md).
