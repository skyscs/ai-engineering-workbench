# Controlled server functional review evidence

[Records](records.json) bind the changed sources, one emitted JavaScript delta,
immutable contracts and closed verification logs. Complete accepted Task 163 push
and pull-request CI logs are retained as deterministic gzip files.

The first process check passed 7/8 cases. Production rejected a fake answer whose
unknowns field contained an assertion. The corrected fake returns a question; the
next process check passed 9/9. A release regression was then added.

Two incomplete full checks remain preserved: the first received SIGTERM (exit 143)
without a reported assertion failure; the second was truncated during the owner's
reported workstation memory exhaustion, with no retained exit code. Neither is a
successful check. No remaining test processes were observed at resume.

The completed full check limits local test scheduling to one workspace package and
two available CPUs. Unchanged pnpm check passes 1,251 Node tests, ten Python suites,
ten typechecks and ten final builds with zero failures, cancellations or skips.

These are ordinary synthetic functional tests, not resource or isolation acceptance.
The fake has no model/provider implementation; usage counts are synthetic. No browser,
corporate source, namespace probe or consumed first entry was used.
Task 164 exact-head CI review remains a separate merge gate. Agent merging is not
independent human semantic acceptance.
