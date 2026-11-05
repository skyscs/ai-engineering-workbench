# Task 126 — Connect prepared questions to protected HTTP and the review flow

Status: in progress after Task 125 exact-head acceptance (`9c21c17`, merge `b0c89df`).
The [public contract](../docs/loredock/PREPARED_QUESTION_API.md) is frozen before implementation.

Connect the internal preparation/answer lifecycle to one coherent experimental user
flow. Preserve the ordinary answer pilot until fresh complete-composition resource and
semantic gates pass. Follow [ADR 0059](../docs/decisions/0059-loredock-prepared-question-lifecycle.md)
and [the adapter contract](../docs/loredock/PREPARED_ANSWER_ADMISSION.md).

1. Audit actual HTTP session/CSRF/body limits, answer browser state, question editing,
   cancellation/polling and history. Preserve accepted source/emitted controls before
   editing. Freeze exact routes, payload fields, feature-switch behavior and status/error
   mapping before wiring. Keep schema, parsers, model policy and exhausted families intact.
2. Expose preparation start/status/review/cancel and scalar prepared-answer admission only
   when explicitly enabled by a server experiment setting alongside the answer pilot.
   Use current session/origin/CSRF protection, strict bounded input keys and server-owned
   context. Reject caller-provided context, prompts, roots, receipts and budget overrides.
   Disabled endpoints remain unavailable; legacy routes retain their existing behavior.
3. Use question → Find context → review → Generate without another user selector. The
   server-advertised mode selects the matching preview and answer path. Show preparation
   progress and a clear action on expiry, cancellation, source/review/build change, busy
   analysis, quota or configuration failure. Never silently generate from legacy input
   after showing prepared/native context, and never automatically retry model execution.
4. Bind Generate to the displayed server preparation ID and reviewed hash. Editing the
   question or changing scope/review invalidates the local preview. Ignore late responses
   from superseded operations; keep request IDs stable for uncertain network retries.
   Do not persist full context/witness in browser storage or add a background queue.
5. Render compact qualifications, original-only evidence buttons and whole-item omission
   reasons alongside existing source/legacy context. Distinguish saved prepared history
   and staleness from current preview. Fenced/purged/corrupt history must not reveal content
   or fall back to another input. Preserve old historical answer rendering.
6. Exercise real protected routes and browser flow with ordinary owned synthetic sources
   and controlled runtimes: exact preview-to-dispatch binding, duplicate/network retry,
   stale asynchronous responses, cancellation, capacity failure, restart, source changes,
   cleanup, disabled mode and mobile layout. Preserve failures and actual runtime deltas.
7. Run appropriate full checks and both CI events at the final head. Update the user guide
   with the experiment's setup, normal flow, limitations and actionable recovery. Then
   scope fresh prospective resource and semantic qualifications of the complete actual
   HTTP/UI/answer composition before changing the existing pilot default.

No corporate repositories, real model call, production/default activation, automatic
history deletion, new account selector or mutation of the user's prepared demo.
