# Inventory preparation audit evidence

Scope `6540991` precedes entry point `db76965`. Its first invocation exits one after
1.005 seconds: the independent fixture has three sources, while the harness assumes
four. It stops at preflight before preparing databases/repositories or recording any
query stage. `first-validation.json` retains that report, stdout/stderr and exit.

Correction `ea5dc16` changes only the exact source/dependency expectation to three;
the four-source maximum is unchanged. Both reports have the same input identity:
three sources, 38 files, 32 code files, 4,338 UTF-8 bytes, SHA-256
`b5226c2ffbd1ab5659ac4b8d011dfab9270926905ad04d0ceb5074f5d4da83a2`.
These are independent tiny development inputs, not any exhausted resource family.

The second invocation exits zero after 4.926 seconds. `second-validation.json`
retains its exact report, input bytes, reference receipt, stdout/stderr/exit and
derived `readback.json`. It records six completed stages and 2,060 preparations over
42 SQL identities / 7,504 template bytes. Both asynchronous replacement workers
prepare 520 SELECTs across ten identities, plus 65 UPDATEs across three identities.
Each synchronous start prepares 19 reads and 35 writes. Capture/history prepare
435/347 reads respectively. Bound values and result rows are never logged.

Both replacements publish and evict the initial inventory. History preserves its
exact recorded projection, ten originals and three dependencies, with ten original
reads and zero path/fact/snapshot/Git/write work. Observer sums/template hashes and
report bounds pass. Generated owned repositories/databases remain at the recorded
local output paths. No retry or replacement of a large resource result occurs.

`development-validation.json` retains the first successful install/full-check logs:
569 tests, strict typechecks and builds. The actual audit validates the corrected
entry point. Source review and all artifact/dependency/reference hashes are checked.
No profiler, heap snapshot, forced GC, model call, corporate source or demo operation
is involved. Timing/memory endpoints in the observer are not resource acceptance.

The [source/count decision](../../loredock/INVENTORY_PREPARATION_AUDIT.md) selects one
next candidate: reuse prepared read statements for one asynchronous inventory worker,
keeping fresh execution, original validation, writes and lifecycle semantics. No
optimization is implemented here, and the source of residual RSS remains unknown.

PR #95 subsequently passed both corrected exact-head CI events (41749820794 /
41749828294 at `d97db4e`) and merged as identical-tree `70f6100`. Its ordinary test
separates functional and resource outcomes without changing the measured code or
failed large qualification. This audit still requires its own final-head CI events.
