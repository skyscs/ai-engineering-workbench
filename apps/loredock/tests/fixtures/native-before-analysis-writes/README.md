# Genuine compiled native runtime before bounded writes

These 37 emitted modules are byte-for-byte copies of the accepted Task 111 runtime.
Every module matches the already retained first diagnostic report. Imports and the
analysis fingerprint provider are unchanged. This is distinct from Task 112's two
behavioral controls, which deliberately share the current fingerprint provider.

`manifest.json` records accepted head/merge, both successful CI events, original report
hashes, Node/V8, all runtime module hashes, TypeScript payload and actual old fingerprint.
`load.mjs` verifies those identities before importing the archived services, then asks
the actual old fingerprint function to reproduce its recorded value. It never assigns
a substitute fingerprint. No production code imports this archive.

The archive uses the repository's installed TypeScript payload, which must match the
recorded hash, and the pinned Node 22.23.2/V8 runtime. Relative imports resolve inside
`runtime`; package resolution uses the normal LoreDock package directory. This is not
an OS/native-library bundle or a claim of portability to another runtime. It needs no
old worktree, Git history or network. Do not regenerate it from changed application
source, alter the immutable modules or use an exhausted resource corpus.
