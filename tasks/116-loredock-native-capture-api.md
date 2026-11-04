# Task 116 — Expose authorized native path capture and history

Status: scoped, 2026-11-04.

The [prospective HTTP contract](../docs/loredock/NATIVE_CAPTURE_API.md) fixes the two
routes, empty-body/query-only selection, native response types and known error mappings
before implementation. Reuse the existing strict query parser to reject duplicate keys;
do not add a second JSON request decoder or put session/CSRF tokens in URLs.

After Task 115 acceptance, connect the already qualified NativeCaptures service to the
local daemon as a separate public API slice. Use the same explicit native path owner;
stop capture/history work before paths, analysis and catalog storage. Do not change
the qualified producer, codec, source authorization, receipt storage, schema, work/
resource limits or parser fingerprint. Do not rerun exhausted resource families.

Add one protected POST to save a complete path selection and one protected GET to reopen
a saved native receipt by its content-addressed ID. Define exact routes, typed responses
and error mappings before implementation. POST accepts only the existing validated build/
inventory/generation/root selection; GET accepts only a valid receipt ID. Reject unknown,
duplicate, oversized, malformed, filesystem-path, budget and identity-override inputs.
Keep loopback host/origin/session/CSRF/body limits, no-store responses and request aborts.
Never make an ordinary path GET create a receipt or expose raw receipt filesystem paths.

Use actual service capture/history without projection relabels, optional authority
bypasses or another budget. Return bounded native outcomes. Map known cancellation,
time/work, capacity, unavailable and authorization outcomes to documented errors;
unexpected internal/storage faults must not leak paths or source-derived partial data.
History returns the recorded projection/originals/dependencies with current authorization
revalidated and current applicability explicitly unchecked. Stale recorded scope and
current runtime validity remain separate. Never silently rederive a saved path.

Test actual HTTP session/CSRF and input rejection before work, complete save/open,
duplicates/capacity, selected roots, cancellation/disconnection and owner shutdown.
History after two inventory replacements and daemon restart must preserve exact bytes,
revalidate all originals, and perform no fact/path/snapshot derivation or publication
locks. Policy fences retained bytes; revocation of an undisplayed dependency purges
affected records and prevents reopening. Keep read-only source/Git/legacy behavior.
Use fresh small owned inputs and retain first failures; no corporate/model run is needed.

Document the implemented API and full stopped-directory backup boundary. Browser save/
open navigation, receipt listing, explicit deletion/repair, semantic answer context,
private pilot, L5 and Workbench remain subsequent work. Do not add a raw receipt-ID input
form as a substitute for the later user workflow. Finish strict and relevant actual
compiled HTTP/startup checks, require both exact-head CI events, then scope the smallest
usable saved-path browser workflow with clear recorded/current status and authority.
