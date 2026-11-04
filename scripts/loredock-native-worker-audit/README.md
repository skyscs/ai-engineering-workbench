# Native replacement-worker ownership diagnostic

This opt-in Task 111 audit uses actual compiled services and a fresh 47-file owned
development input. It records SQL preparation, statement invocation and `db.exec`
transaction counts around native capture, two inventory admissions/workers, evicted
history and owner close. It retains at most 128 SQL identities, 64 KiB of SQL text,
twelve stages and a 256 KiB report. No bound values, result rows, native statements
or per-call records are retained by the observer. Iterator counts mean calls to
`iterate`, not per-row execution or deferred iterator errors.

After committing the entry point and building, use Node 22 with an absent absolute
`LOREDOCK_NATIVE_WORKER_AUDIT_OUTPUT` and run `node scripts/loredock-native-worker-audit/run.mjs`.
The output directory is exclusive, and failures/partial reports remain there. Only
its own synthetic repositories/catalog are modified. All underlying calls still run;
the observer changes timing/allocation and is never resource-qualification evidence.
It reports no RSS/heap/native allocation estimates and does not replay Task 110.

The observer has an explicit owner, rejects overlapping attachment, restores original
methods and does not instrument process-global SQLite. Raw capture/history and exact
source-row hashes establish the diagnostic's functional path. Runtime hashes identify
the compiled application. A successful audit can justify investigating repeated work;
it cannot prove the cause of the failed memory row or acceptance of a candidate.
