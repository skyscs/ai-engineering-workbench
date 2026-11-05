# Prepared-flow cancellation observation

This ordinary Task 128 diagnostic closes a measurement gap: a `preparing` admission
response followed by a successful cancellation does not, by itself, distinguish active
preparation from cancellation after Ready. No application code, runtime limit, source
family or experimental default changes.

The existing diagnostic accounting module now observes Node's actual
`http.server.response.finish` channel. At response completion it records method, route,
status, monotonic timestamp and the IDs of actual budgets whose forwarded `close`
method has not run. It reads no headers or bodies, holds no response, and does not call
application methods. A read-only accounting-status command observes unfinished budgets
without ending their scope. The normal bootstrap never imports this diagnostic module.

The [ordinary driver](../../../scripts/loredock-prepared-flow/cancellation-observation-development.mjs)
uses real HTTP admission and cancellation, waits for observed budget closure, and then
prepares the same question again. It requires one actual preparation budget to remain
open when the cancellation response finishes. Ready publication and budget closure are
synchronous within the same worker turn, so an already completed preparation cannot
satisfy that condition. If a future run misses the window, its observation fails; the
driver does not retry or infer success from the public status alone.

Both ordinary observations satisfy that condition and retain the actual
`check:CANCELLED` exception from the forwarded budget check. The cancelled preparation
performed 6,438 accepted units before closing. A replacement reaches Ready with its
useful native path, closes its budget, and makes no runtime/model request. The second
observation adds a negative control: cancelling that Ready preparation returns the same
public `cancelled` status but records no open budget and no budget error. This negative
control is absent from the first retained observation; it is not retroactively credited.

A separate actual HTTP-server test checks the native channel, active/closed budget
distinction, non-destructive scope inspection and omission of response cookies. Existing
accounting checks still cover rejected work and activity after scope closure. The
complete ordinary answer-flow parity exercise also passes: exact prompt/schema/witness
bytes and useful outputs match the ordinary bootstrap after only the already declared
UUID/time normalization. It records eight real budgets and 2,253,226 units, with two
controlled answers and no real models.

[records.json](records.json) retains raw outputs, complete stopped catalogs, synthetic
Git sources, journals, code/reference snapshots, per-file hashes and verification logs.
All three application exercises run under the kernel owner, finish with no errors or
survivors, and keep their original trees. Diagnostic overhead remains included; none of
these timings or memory samples supply a resource pass.
Independent inspection of complete stopped copies passes SQLite integrity and
foreign-key checks for all five catalogs; source hashes and original raw trees remain
unchanged. The local `pnpm check` passes 955 tests (17 Git, 18 adapter, 43 storage,
664 LoreDock, 57 daemon and 156 scripts), strict typechecks and production builds.
The original application/input seal still validates with zero candidate family reads.

The preceding owner slice is accepted through [PR #133](https://github.com/skyscs/ai-engineering-workbench/pull/133).
Push 41994419744 and pull_request 41994481613 both pass 954 tests at exact head
`59e3f277cde1c49a6328829ed57a785373bb7920`; merge
`8da3df9759b1852a0b4a3faeb504eb6f4ff0c253` has the identical tree. Both CI logs are retained.

First-preflight authority mutations, the final R01–R15 driver/assessor and executable
seal remain pending. The reserved kiln family has zero candidate reads. The original
known history-work, Chrome-RSS and startup-delay exceedances remain recorded against
unchanged thresholds. Cancellation observation does not establish the full gate,
semantic quality, ordinary-pilot adoption or L5 acceptance.
