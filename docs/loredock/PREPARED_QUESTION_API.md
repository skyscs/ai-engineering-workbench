# Protected prepared-question API and browser contract

## Versioned format extension (Task 133)

New Ready reviews record `loredock-prepared-answer-v2` and, when present,
`native-question-item/2`. Its lexical hash is the enclosing context's `inputHash`.
Duplicate clue tuples contain legacy-comparison and native-edge indexes; a header
reference contains only `legacyHeader`, an index into the same context's comparisons.
All referenced endpoints, status, original support and header content must match.
Unmatched headers remain inline. These indexes are never citations.

Saved v1 answers retain their exact item, prompt, hashes and response bytes. History,
full validation and replay select the stored supported version; unknown or mixed
versions fail explicitly. Source-only inputs retain their recorded prompt version.
No database migration is required. Ready and saved browser displays resolve references
against their matching enclosing context and retain the complete header explanation.
The 8 KiB combined derived and 96 KiB prompt limits remain unchanged. See
[ADR 0061](../decisions/0061-loredock-native-question-format-v2.md) and the
[first ordinary result](../fixtures/loredock-native-format-v2/README.md).

## Original Task 126 contract

Frozen before Task 126 implementation. Task 125 passed push 41947342761 and pull-request
41947350906 at `9c21c17` and merged as identical-tree `b0c89df`. This contract changes
no default answer input. Fresh complete-composition resource and semantic gates remain
required before experimental prepared input becomes the ordinary answer pilot default.

## Reviewed boundaries

- createApp already applies fixed Host/Origin rules, same-site sessions, CSRF on writes,
  16 KiB bodies and no-store to API responses. Existing answers routes stay intact.
- AnswerPanel already owns the simple question/preview/generate flow, 1-second answer
  polling, source/review boundary invalidation and saved history. It imports server types
  only. Native preparation must have its own generation identity so stale start, polling,
  review and admission responses cannot restore an old question or source scope.
- QuestionPreparations always prepares the current published source index. The UI currently
  also supports choosing historical indexes. New start must explicitly bind the selected
  buildId to the current published index and reject historical selection, not silently use
  a different index. It accepts no source/root/context/witness input.
- NativeReceiptError currently uses nativeCaptureError in global error handling. New routes
  need a question-specific bounded error mapping so question failures do not display path
  capture recovery instructions. Existing path errors must keep their current mapping.
- Configure and generation share operation ownership with all preparation consumers. A
  preparation does not require Codex configuration. Server switch must require answers
  and a same-store preparation owner; no route creates an implicit alternate owner.

## Frozen public contract

- LOREDOCK_ANSWERS=1 retains the optional legacy pilot.
- LOREDOCK_PREPARED_ANSWERS=1 additionally exposes the experimental prepared flow. No
  browser mode/account selector. When disabled, all new routes are unavailable and the
  ordinary response shapes remain unchanged. Invalid standalone enablement must fail
  closed with a clear startup error, rather than advertise a broken mode.
- Protected GET /api/answers can add preparedQuestions: true only when enabled, alongside
  its unchanged service state. This is server HTTP metadata, not a change to Answers.state.
- POST /api/question-preparations accepts exactly requestId, question, buildId; all bounded,
  buildId must match the current published source index. Returns preparation state, 202.
- GET /api/question-preparations/:id returns scalar state; GET .../:id/review returns
  reviewed base/compact context only when Ready. No raw witness/prompt/receipt text.
- POST .../:id/cancel accepts an empty JSON object and returns terminal state.
- POST /api/prepared-answers accepts exactly requestId, preparationId, reviewedHash and
  calls the actual Answers.startPrepared, 202. Matching retries remain durable. It must
  never accept context, prompt, root, receipt, model, connection or budget overrides.
- IDs use the existing UUID and request/hash bounds. Responses retain existing global
  no-store/security headers. Review serialization is bounded to 1 MiB, no partial output.
- Current context is reviewable for at most ten minutes. Failed/expired/cancelled/fenced
  preparations require explicit Find context again; capacity failures preserve Ready and
  explain that no saved answers were deleted. A network-uncertain admission retries the
  same scalar request, never creates a new model attempt automatically.

## Browser behavior and verification

- One question editor and Find context button; prepared progress and Cancel context,
  then the exact server-reviewed preview and Generate answer. Source-only omission stays
  a prepared input with exact stored prompt, not an implicit legacy fallback.
- Keep generation IDs and boundary/question binding for every async response. Editing or
  scope/review changes invalidates preview and admission references. Cancel late-discovered
  obsolete preparation on a best-effort basis without masking the original failure.
- Preserve request IDs across uncertain transport failures. Explicit new preparation gets
  a new request ID; a failed model attempt needs a new Find context after consumption.
- Render original-only citation buttons, static/unverified/partial/deployment-unknown
  labels, gaps, omissions and duplicate-legacy qualification; never link native IDs.
- History renders prepared compact metadata only when authorized, alongside existing
  legacy review/interfaces. On failed history retrieval, clear any previous visible
  content for that attempt rather than leave a stale answer visible.
- HTTP tests use actual app/request/session helpers and owned ordinary fixtures/runtime
  doubles. Browser smoke uses compiled UI, real local server and Chrome CDP on owned data,
  with exact prompt assertion, transport replay, stale response, cancel/restart, revocation,
  source-only/disabled mode, escaped text and 390px layout. Preserve first failures.
- Preserve app/index and relevant browser source/emitted controls before edits; compose
  Task 125's normal historical proof without rewriting old manifests or frozen harnesses.
- Fresh complete HTTP/UI/answer resource and semantic qualifications follow; no exhausted
  corpus or real model call belongs to this task.

## Additional review findings

- Include selected buildId in the browser operation boundary; the old boundary only
  combines source/published-index and engineer-review revision. A historical index
  selection must invalidate the current preview even without a source revision change.
- Do not permit Find context until server mode is known. A failing history/state request
  must not silently route an experiment-enabled browser through the legacy preview.
- Ready expiration should poll scalar state until consumed or invalidated. Displaying a
  preview indefinitely and discovering expiry only after Generate is avoidable. Polling
  must not reopen full review payloads every second or reset the preparation TTL.
- Cancellation can race with a delayed start response. Track the operation generation;
  when its ID finally arrives after local cancellation, cancel that owned ID without
  restoring preview. A canceled request does not cancel some other tab's newer ID.
- A transport failure after admission may have committed and dispatched. Retain that
  request's scalar binding and offer explicit Retry request. Do not force a new preparation
  before resolving an uncertain committed request, and never automatically send a new ID.
- If a start definitely failed before committing (validated error response), keep Ready
  for fixable configuration/quota errors. If it was consumed, require Find context again.
- A route must return only QuestionPreview, never the durable QuestionSnapshot. Compact
  receipt hashes remain informational and cannot be turned into evidence links. All
  links must resolve through the issued base context span IDs.
- HTML must treat all source labels, compact flow text, gaps and error messages as text.
  No raw HTML/SVG or data URLs are needed for this change.
- Existing answer history fetch can leave old content visible when a refreshed fetch
  fails. Clear the displayed attempt when starting a new fetch and on failure; retain
  latest-authorized history only after its new request succeeds for the current boundary.
