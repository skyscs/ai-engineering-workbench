# Native capture and authorized history verification

Task 107 implements the [internal service](../../loredock/NATIVE_CAPTURE_SERVICE.md).
An actual shared budget spans paths, codec, originals and guarded publication. History
rechecks every original and the complete saved source scope without deriving paths.
It preserves exact saved content after restart and two inventory replacements.

The focused run passes 55 storage/service cases and subcases. The first complete
strict check passes 776 tests. Final review adds five history-cancellation cases;
all **781 tests**, typechecks and builds pass. The compiled service smoke captures
23,808 bytes from three owned sources, with 9 nodes, 8 edges and 6 originals. It
verifies duplicate bytes, restart, eviction, policy denial and physical revocation.
The first and final checks have no failures. Ten original command logs, their hashes,
source hashes and actual smoke counts are retained in the [manifest](validation.json).

Review covers new/duplicate guard-release failures, persistent cleanup disablement,
capacity, zero source writes/Git, complete aggregate work and original deadlines,
external SQLite changes, worker overlap, cross-instance ownership, stop and every
cooperative cancellation/authorization boundary. An undisplayed dependency participates
in purge. Corrupting a root-page original outside the displayed graph denies history.
No result is returned between asynchronous preparation and synchronous final checks.

All nine analysis fingerprint modules and historical measured artifacts are unchanged.
No exhausted family was rerun. This is functional evidence on small owned sources;
independent native assessment, final compiled resource qualification and user/semantic
acceptance remain separate. No HTTP/browser integration or model call occurs here.
