# Task 157 — Reduce owned native capabilities before direct birth

Status: implemented; focused checks and 1,208 full Node tests/typechecks/builds pass before sealing. Task 156
is accepted through PR #189, identical-tree merge 35c1a9e, after both complete exact-head
CI logs pass 1,207 Node tests, ten typechecks and ten final builds. Its sole attempt creates the
direct child, then the independent pre-exec guard rejects nonzero inheritable capability
bit 35. No sandbox/payload executes. Preserve this FAIL and the forced native-child cleanup.

1. Use the retained capability/status records and system header ABI to design an explicit
   reduction of the owned native control process's effective, permitted and inheritable
   capability sets before clone3. Require and verify the existing no-new-privileges state;
   verify the resulting zero sets. Do not grant capabilities, alter another process,
   change host/user-manager/profile settings, request privileged bounding-set changes,
   install a runtime or ignore the observed bit. Keep the independent pre-exec guard strict.
2. Implement a separate pinned native/helper candidate. Preserve every consumed Task
   152/154/155/156 helper, claim, executable and first artifact. Reuse corrected owned-leaf
   admission, capture, protocol, ownership and payload behavior without changing work or
   namespace/retention/deadline bounds. Do not reinterpret Task 156 as passing.
3. Add intercepted capability syscall tests: retained high-word inheritable bit, already
   empty sets, failed reduction/readback, unexpected remaining bits, unsupported ABI,
   unchanged no-new-privileges and no clone3 on failed admission. Check exact self-only
   zero-valued requests and ordering before direct birth. No test may grant actual rights.
4. Review full local checks and commit/seal one fresh candidate. At most one service,
   clone3, fixed sandbox/payload and 1-MiB allocation may run, with the existing 10/5/2,
   native four-second, capture five-second and launcher 25-second bounds. No fallback,
   pressure, resource ceiling or change to a consumed first entry is allowed.
5. Preserve the first outcome, actual child wait and terminal group state. Failed own-process
   reduction or unavailable real capability ends the candidate path without environment
   tuning. Retain accepted Task 156 CI and complete first evidence; review both complete
   exact-head CI logs before merge. Full executor/counter lifetime, orphan/interrupted-
   collector, application resource/timing, semantic and bridge qualification remain separate.
