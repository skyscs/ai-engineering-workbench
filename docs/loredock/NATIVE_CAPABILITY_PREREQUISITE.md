# Native capability reduction before direct birth

Task 157 addresses the owned-process defect observed by the
[Task 156 first attempt](EMPTY_CONTROLLER_PREREQUISITE_RESULT.md). That FAIL, consumed
entry, strict independent pre-exec guard and complete raw observations remain unchanged.
The sole new candidate is sealed, consumed and PASS; see the
[retained first result](NATIVE_CAPABILITY_PREREQUISITE_RESULT.md). Its entry and inputs
are now frozen first-attempt history and must not be repaired or rerun.

The separate [native helper](../../scripts/loredock-native-capability-prerequisite/native.c)
requires the existing no-new-privileges state to be exactly one. Before clone3 it makes
one self-only capset call with ABI version 3, pid zero and two completely zero-valued
words for the effective, permitted and inheritable sets. One capget readback must return
the same ABI and self identity with every field zero. Its output starts filled with
nonzero bytes, so a partial readback cannot silently look empty. No-new-privileges must
still be one after reduction. Any failure ends admission before child creation, with
the specific stage and errno retained separately from clone3 failures.

The [Linux capability interface](https://man7.org/linux/man-pages/man2/capset.2.html)
supports reducing the caller's own sets without granting new rights. The
[capability rules](https://man7.org/linux/man-pages/man7/capabilities.7.html) constrain
ambient bits to permitted and inheritable membership; clearing those sets also removes
ambient rights. The independent child guard still reads all four sets from the kernel.
[No-new-privileges](https://www.kernel.org/doc/html/v7.0/userspace-api/no_new_privs.html)
is required, not substituted for clearing inheritable bits. No bounding-set change,
host/user-manager adjustment, profile change or capability grant is requested.

The [entry adapter](../../scripts/loredock-native-capability-prerequisite/probe.py)
uses new manifest, unit and output bindings. Corrected Task 156 leaf admission and
Task 155 capture/protocol bytes are independently pinned; acquisition, ownership,
sandbox and payload dependencies retain their accepted pins. The existing deadline
starts before reduction. Direct placement, durable pre-exec observation before the
permit, normal child wait and terminal group checks are unchanged.

## Verification and single-attempt boundary

Four Python cases include 26 intercepted C capability scenarios: empty sets, the
retained high-word bit, all bits set in fake state, no-new-privileges failures before
and after reduction, capset/capget errors, unsupported ABI, malformed positive returns,
changed header identity, partial readback, each of the six remaining fields and a
clone3 error after successful admission. They assert exact self-only zero requests,
call order and no child creation on denied admission. Real capability, prctl, clone3
and waitpid operations are intercepted; only the production binary is compiled.

The initial single-file linker-wrapper harness failed under optimization; adding a
diagnostic print changed its result. The corrected harness compiles wrappers and shared
state in a separate translation unit, preserving the original direct assertion and
production optimization flags. This avoids relying on compiler assumptions about
file-local state across linker-rewritten calls. The
[GNU linker documentation](https://sourceware.org/binutils/docs/ld/Options.html) describes
the undefined-symbol wrapping boundary. The initial failure remains part of development
history; it is not evidence of a real capability syscall failure.

Other cases preserve the original retained FAIL, exact shared sources/archive and rejection
of the old manifest. Existing 18/34/20/20/16 Python regressions remain independent checks.
Full local checks pass 1,208 Node tests, ten typechecks and ten final builds without
failures, cancellations or skips. All 148 emitted application/package modules and previous
consumed inputs/first records remain unchanged. Source review and checks precede sealing.

At most one fresh service, native invocation, clone3, fixed sandbox/payload and explicit
1-MiB allocation may execute. Retain the service 10/5/2-second bounds, native four-second
deadline, capture five-second and launcher 25-second limits, 64-KiB streams, 1-MiB records
and 2-MiB output. Failed own-process reduction or unavailable real capability ends this
candidate without tuning the environment or selecting a fallback.

A passing prerequisite would not qualify complete counter lifetime, ancestor controls,
orphan/interrupted-collector behavior, application resources/timing, semantic quality or
the Workbench bridge. No application, corporate source or model is part of this attempt.
