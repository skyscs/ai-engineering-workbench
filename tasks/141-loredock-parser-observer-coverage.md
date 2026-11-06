# Task 141 — Establish production parser observation coverage

Status: first control complete; lifecycle passes, coverage remains blocked. The full local
check passes 1,133 tests, ten typechecks and ten final builds. Exact-head CI review is pending.

See [the prospective method](../docs/loredock/PARSER_OBSERVATION_COVERAGE.md) and
[fixed inputs and bounds](../scripts/loredock-parser-coverage/plan.mjs).

Task 140's compatibility and worker lifecycle results do not qualify complete startup,
whole-isolate heap, ordinary near-limit preparation or browser memory. Its parent-only
297 samples cannot bound worker heap. Earlier external worker heap requests had delayed,
missing and rejected samples. Preserve those failures and every existing resource limit.

Before any new measurement, commit a small prospective ordinary plan with immutable
synthetic inputs, exact source/emission/runtime identities, independent process ownership,
absolute deadlines and an exclusive first output directory. Do not rerun a consumed family.
Keep the application implementation fixed while evaluating observation coverage.

1. Audit the actual parent/worker startup sequence, including execution before the first
   interval, identity streams, compiler loading, busy parsing, ready/idle and actual exit.
   Account for parent composition and expanded native payload allocation as remaining risks.
2. Define which existing observer facilities measure process RSS and per-isolate heap,
   and which intervals they cannot cover. Exercise controlled slow/missing/rejected worker
   samples, worker creation/exit and cleanup. Reject incomplete coverage explicitly; summed
   independent maxima are not a simultaneous peak, and missing samples are never zero.
3. Run one fresh small ordinary source/emitted production startup and native/foreground
   lifecycle control, with no model or corporate code. Record complete process ownership,
   elapsed intervals, raw samples, requests/completions, errors and stopped catalog state.
   Keep first failures and original candidate bytes. Never use forced GC, heap overrides,
   profiler substitutions or revised ceilings to manufacture acceptance.
4. Decide whether the observer can support the existing aggregate heap and complete startup
   contract. If it cannot, retain that blocker and scope a concrete architecture or measurement
   decision before a near-limit gate. Do not infer acceptance from a quiet sample or RSS alone.
5. Only after coverage is established, scope a separate fresh ordinary near-limit stage.
   The known browser baseline RSS failure needs its own explicit environment/contract decision;
   it is not repaired by compiler isolation.

Run focused observer regressions, strict types and full checks; inspect both complete CI
logs for the exact PR head, merge, and continue with the next evidence-supported task.
No new product features, schemas, model calls, background retries or default changes.

The original source/emitted children both exit 0 with no descendants, one parsed native
file and an integrity-checked stopped catalog. Source's parent interval reaches 324.833 ms;
emitted reaches 72.231 ms. Missing startup/worker/nested-isolate coverage remains explicit.
All 95 emitted LoreDock modules match Task 140. Eight observer regression tests pass.
Continue with [Task 142](142-loredock-resource-observation-decision.md) after acceptance;
do not launch a near-limit gate with this incomplete observer.
