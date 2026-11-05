# Task 128 ordinary driver review

This is a development review, not the executable seal. The reserved kiln family still
has zero candidate reads, and no real model has been called.

The corrected controlled launcher imports the exact ESM Hono entry used by index.js.
It creates the actual CatalogStore/Catalog, analysis/follow, path/capture, preparation,
Answers and HTTP app in the same order and serves the accepted built browser assets.
The only production dependency replacement is the existing TextRuntime constructor input.
The fault flag enables prepare/provider promise holds. The accounting flag separately
forwards the actual OperationBudget methods. Neither flag changes production limits.

Shutdown first stops listening and releases declared runtime holds, then stops follow,
answers, preparations, captures, paths, analysis, catalog and store in the accepted order.
Release schedules promise continuations; Answers.stop synchronously fences/aborts its
worker before those continuations run. The shutdown-held-worker development case verifies
an interrupted durable attempt, retained late usage and no redispatch on actual-entry replay.

The owner process validates direct-child process-group identity and Linux start ticks,
records observed group descendants, enforces external wall/storage ceilings and retains
all files. It handles TERM-resistant children and observed orphan descendants in separate
subprocess tests. This is not a universal continuous descendant-discovery guarantee:
sampling can miss a child that is forked and orphaned between observations. The final
qualification owner still requires review of that gap before any executable seal.

Preparation cancellation currently records a preparing admission response and a subsequent
cancel response. The public API does not report the precise internal cancellation instant;
this observation alone must not claim a deterministic in-worker checkpoint. The first
preflight authority boundary is also still pending; the current ordinary matrix covers
real review/policy/build changes after preflight and after dispatch. Do not call it the
complete frozen R07/R11 matrix.

Network faults operate through CDP Fetch response interception. The driver preserves real
request/response bytes, then drops or releases them. Product fetch and producers are not
replaced. Review changes preserve authorized historical answers with an explicit historical
review label; revocation hides and purges content. An obsolete response must not reclassify
historical review as current. The first ordinary network run used an incorrect banner and
assertion; it remains retained as a driver failure.

The real ten-minute expiry development run overlaps focused tests and pnpm check. Its
functional polling/expiry result may be reported, but its resource samples are contended
ordinary observations. No result transfers to the reserved full-composition gate.
