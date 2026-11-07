# Controlled server compatibility delta

The prior server source has SHA-256
1616b645be5b0e0bdbf8413a4cfd373015f37dbf13ab4e397f61d16c551ae3c7.

Task 164 adds a type-only TextRuntime import, one optional constructor field and
passes that field into the existing Answers dependency. The verifier reverses
exactly those three edits and checks every reconstructed byte against the original
hash. Original bytes remain valid. An unrelated server change fails.

The older owned-parser delta manifest and archived sources are unchanged. This is
a historical compatibility check, not resource qualification of the changed server.
Ordinary lifecycle and emitted-process HTTP tests also exercise the production owner.
