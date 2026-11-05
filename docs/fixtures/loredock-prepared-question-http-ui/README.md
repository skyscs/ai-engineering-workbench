# Prepared-question HTTP and browser verification

Task 126 connects protected scalar routes and the existing question/review/generate UI
behind `LOREDOCK_PREPARED_ANSWERS=1` alongside the answer pilot. The ordinary pilot stays
on legacy input. No corporate code, real model call or exhausted-family run is involved.

Accepted base: `b0c89dffc87020281e51aaf678a165ad727ef62c` (PR #129).
The public contract and 188 prior application/browser file controls were committed in
`2404754` before implementation. The final executable is recorded in [review.json](review.json).
Node 22.23.2 / V8 12.4.254.21-node.56, TypeScript 5.9.3 and pnpm 10.15.0.

- [Review](review.json): all command statuses/hashes, first typecheck failure, refinements
  and scope. All 21 unedited logs are stored as `*.log.gz`.
- [Runtime audit](runtime-audit.json): exact app/index/AnswerPanel deltas, 183 unchanged
  source/emitted/browser files, 64 unchanged prepared-service modules, actual 82-module
  daemon workspace imports, resolved external entries and final browser asset hashes.
- [Browser result](browser-result.json), [desktop](desktop.png) and [390px layout](mobile.png).
  Six `browser-*.tar.gz` archives retain every output from five prepared smoke runs and
  the existing legacy answer smoke, including earlier UI-copy versions.

`pnpm check` passed strict types, **938 tests** and all builds at `c92349a`: 17 Git,
18 AI, 43 storage, 664 LoreDock, 57 daemon and 139 scripts. Nine new compiled HTTP tests
cover session/CSRF/origin/body protection, disabled mode, exact bounded fields, model-free
review without configuration, exact dispatch/replay, original-only citation rejection,
cancel/expiry, source/review fences, capacity refusal, restart and invalid startup flags.
The combined HTTP/prepared-answer focused run passed 26/26.

The first web typecheck failed because three React refs lacked explicit initial values,
leading to thirteen additional undefined-assignment errors. The fix passed corrected
types and all full checks; that first failed log remains intact. Every browser run passed.
Later review refined copy and duplicate header display, replaced a deliberate wait on an
empty-question disabled button, and added a late question-edit case. Final production web
builds, the complete prepared browser smoke and source/emitted audit passed again after
these small UI changes. Backend/schema/parser/provider code stayed unchanged.

Chrome drives the real protected server and built interface. It verifies the exact saved
prompt, an admission response lost **after commit** with same-ID replay, native/original
evidence buttons, omitted paths, escaped model prose, active and late-start cancellation,
late review/question edits, late cancellation usage, restart, historical revocation,
disabled legacy preview and 390px layout without horizontal overflow. Each prepared run
uses three controlled runtime calls; the existing legacy smoke uses four. No actual model
process runs, and the browser runtime injection is test-only.

All 80 frozen artifacts and all parser/provider/package/lockfile inputs remain intact.
The daemon import graph includes workspace modules and separately hashes resolved
external entry points; it does not claim recursive external-package auditing. Existing
resource/model results do not qualify this complete public composition. Fresh prospective
resource and semantic gates remain required before ordinary pilot adoption.

Ordinary fixture teardown deletes temporary source/catalog trees on success and failure;
the archived browser outputs and raw logs are the retained evidence. The primary checkout
stayed clean at `592bbc0`. Both final-head CI events are required before acceptance.

See [usage](../../loredock/USER_GUIDE.md#try-prepared-context-experimental),
[the frozen public contract](../../loredock/PREPARED_QUESTION_API.md) and
[the next qualification contract](../../../tasks/127-loredock-prepared-flow-qualification-contract.md).
