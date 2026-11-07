"""Staged temporary-file regressions; no cgroup, service or workload execution."""
import base64
import errno
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("staged_reader", Path(__file__).with_name("reader.py"))
reader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reader)
BOOT, CLOCK = "22222222-2222-4222-8222-222222222222", "b" * 64
VALUES = {"memory.current": b"0\n", "memory.peak": b"0\n", "memory.swap.current": b"0\n",
          "memory.swap.peak": b"0\n", "memory.events": b"low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\noom_group_kill 0\n",
          "memory.swap.events": b"high 0\nmax 0\nfail 0\n", "cgroup.events": b"populated 0\nfrozen 0\n",
          "cgroup.type": b"domain\n"}


class Clock:
    def __init__(self):
        self.value = 100

    def __call__(self):
        value = self.value
        self.value += 1
        return value


class Fixture:
    def __init__(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="loredock-staged-counter-test-")
        self.parent = Path(self.temporary.name)
        self.paths = {"run": self.parent / "run", "daemon": self.parent / "run/daemon",
                      "browser": self.parent / "run/browser"}
        self.parent_fd = os.open(self.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        self.fds, self.clock = {}, Clock()
        self.create("run")

    def create(self, name):
        path = self.paths[name]
        path.mkdir()
        for interface, raw in VALUES.items():
            (path / interface).write_bytes(raw)
        self.fds[name] = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)

    def roles(self):
        for name in ("daemon", "browser"):
            self.create(name)
        return {name: self.fds[name] for name in ("daemon", "browser")}

    def open(self):
        return reader.StagedCounters(self.parent_fd, self.fds["run"], boot_id=BOOT, clock_id=CLOCK,
                                     clock=self.clock)

    def prepare(self, held):
        root = held.capture_root_initial()
        held.attach_roles(self.roles())
        roles = held.capture_roles_initial()
        return root, roles

    def __enter__(self):
        return self

    def __exit__(self, *_):
        for fd in [self.parent_fd, *self.fds.values()]:
            os.close(fd)
        self.temporary.cleanup()


def fds():
    return set(os.listdir("/proc/self/fd"))


class ReaderTests(unittest.TestCase):
    def test_root_fds_survive_later_role_creation_and_unreset_setup_charge(self):
        with Fixture() as fixture, fixture.open() as held:
            self.assertFalse(fixture.paths["daemon"].exists())
            self.assertEqual(len(held.owned), 10)
            original = dict(held.counters)
            root = held.capture_root_initial()
            self.assertEqual(root["phase"], "root-initial")
            self.assertEqual(root["scopeOrder"], ["run"])
            self.assertTrue(root["rootInitialEligible"])
            self.assertFalse(root["initialDataEligible"])
            role_fds = fixture.roles()
            (fixture.paths["run"] / "memory.peak").write_bytes(b"520192\n")
            (fixture.paths["run"] / "memory.current").write_bytes(b"512000\n")
            real_open = os.open
            def no_reopen(path, *args, **kwargs):
                if path in reader.INTERFACES:
                    self.assertNotEqual(kwargs.get("dir_fd"), held.directories["run"])
                return real_open(path, *args, **kwargs)
            with mock.patch.object(reader.os, "open", side_effect=no_reopen):
                held.attach_roles(role_fds)
                roles = held.capture_roles_initial()
                final = held.capture_final()
            self.assertEqual(len(held.owned), 28)
            self.assertEqual({key: held.counters[key] for key in original}, original)
            for fd in held.owned:
                self.assertFalse(os.get_inheritable(fd))
                self.assertEqual(fcntl.fcntl(fd, fcntl.F_GETFL) & os.O_ACCMODE, os.O_RDONLY)
            self.assertTrue(roles["initialDataEligible"])
            self.assertEqual(roles["scopeOrder"], ["daemon", "browser"])
            self.assertEqual(final["scopeOrder"], ["daemon", "browser", "run"])
            self.assertEqual(root["observations"]["run"]["snapshot"]["raw"]["memory.peak"], "0\n")
            self.assertEqual(final["observations"]["run"]["snapshot"]["raw"]["memory.peak"], "520192\n")
            previous = int(root["acquiredAtNs"])
            for result in (root, roles, final):
                self.assertEqual(result["acquiredAtNs"], root["acquiredAtNs"])
                self.assertTrue(result["offlineOnly"])
                for flag in ("ownershipEstablished", "terminalEstablished", "executorQualified", "resourceQualification"):
                    self.assertFalse(result[flag])
                self.assertNotIn("fsynced", result)
                for name in result["scopeOrder"]:
                    row = result["observations"][name]
                    span = row["snapshot"]["window"]
                    self.assertGreater(int(span["fromNs"]), previous)
                    previous = int(span["toNs"])
                    for interface, read in row["reads"].items():
                        self.assertTrue(read["complete"])
                        self.assertEqual(base64.b64decode(read["bytesBase64"]).decode(), row["snapshot"]["raw"][interface])

    def test_premature_duplicate_and_after_close_transitions_are_denied(self):
        with Fixture() as fixture, fixture.open() as held:
            for operation in (held.capture_roles_initial, held.capture_final, lambda: held.attach_roles({})):
                with self.assertRaises(ValueError): operation()
            held.capture_root_initial()
            with self.assertRaises(ValueError): held.capture_root_initial()
            held.attach_roles(fixture.roles())
            with self.assertRaises(ValueError): held.attach_roles(fixture.fds)
            with self.assertRaises(ValueError): held.capture_final()
            held.capture_roles_initial()
            with self.assertRaises(ValueError): held.capture_roles_initial()
            held.capture_final()
            with self.assertRaises(ValueError): held.capture_final()
            held.close()
            for operation in (held.capture_root_initial, held.capture_roles_initial, held.capture_final,
                              lambda: held.attach_roles({})):
                with self.assertRaises(ValueError): operation()

    def test_reentrant_capture_and_attachment_do_not_consume_current_stage(self):
        with Fixture() as fixture, fixture.open() as held:
            def clock():
                with self.assertRaises(ValueError): held.capture_root_initial()
                with self.assertRaises(ValueError): held.attach_roles({})
                with self.assertRaises(ValueError): held.close()
                return fixture.clock()
            held.clock = clock
            self.assertTrue(held.capture_root_initial()["rootInitialEligible"])

    def test_nonzero_or_malformed_initial_root_cannot_be_retried_or_admitted(self):
        cases = [(name, b"1\n") for name in reader.SCALARS] + [
            ("memory.peak", b"00\n"), ("memory.peak", b"0"), ("cgroup.type", b"threaded\n"),
            ("memory.events", VALUES["memory.events"] + b"unknown 0\n"),
            ("memory.events", VALUES["memory.events"] + b"low 0\n"),
            ("memory.swap.events", b"high 0\nmax 0\nfail 1\n"),
            ("cgroup.events", b"populated 1\nfrozen 0\n")]
        for name, raw in cases:
            with self.subTest(name=name, raw=raw), Fixture() as fixture, fixture.open() as held:
                (fixture.paths["run"] / name).write_bytes(raw)
                result = held.capture_root_initial()
                self.assertFalse(result["rootInitialEligible"])
                self.assertEqual(result["observations"]["run"]["snapshot"]["raw"][name], raw.decode())
                (fixture.paths["run"] / name).write_bytes(VALUES[name])
                with self.assertRaises(ValueError): held.capture_root_initial()
                with self.assertRaises(ValueError): held.attach_roles(fixture.roles())
                self.assertFalse(held.owned)

    def test_optional_zero_memory_event_is_accepted(self):
        with Fixture() as fixture, fixture.open() as held:
            (fixture.paths["run"] / "memory.events").write_bytes(VALUES["memory.events"] + b"sock_throttled 0\n")
            self.assertTrue(held.capture_root_initial()["rootInitialEligible"])

    def test_missing_initial_counter_is_sticky_after_file_appears(self):
        with Fixture() as fixture:
            path = fixture.paths["run"] / "memory.peak"
            path.unlink()
            with fixture.open() as held:
                path.write_bytes(b"0\n")
                result = held.capture_root_initial()
                row = result["observations"]["run"]
                self.assertFalse(result["rootInitialEligible"])
                self.assertNotIn("memory.peak", row["snapshot"]["raw"])
                self.assertEqual(row["reads"]["memory.peak"]["errors"][0]["errno"], errno.ENOENT)
                self.assertEqual(len(row["snapshot"]["raw"]), 7)

    def test_partial_role_open_keeps_other_fields_and_never_becomes_eligible(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            roles = fixture.roles()
            path = fixture.paths["browser"] / "memory.swap.peak"
            path.unlink()
            held.attach_roles(roles)
            path.write_bytes(b"0\n")
            initial = held.capture_roles_initial()
            final = held.capture_final()
            for result in (initial, final):
                self.assertFalse(result["initialDataEligible"])
                row = result["observations"]["browser"]
                self.assertNotIn("memory.swap.peak", row["snapshot"]["raw"])
                self.assertEqual(len(row["snapshot"]["raw"]), 7)
                self.assertEqual(row["reads"]["memory.swap.peak"]["errors"][0]["errno"], errno.ENOENT)

    def test_nonzero_role_initial_is_permanently_ineligible(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            held.attach_roles(fixture.roles())
            path = fixture.paths["daemon"] / "memory.peak"
            path.write_bytes(b"1\n")
            self.assertFalse(held.capture_roles_initial()["initialDataEligible"])
            path.write_bytes(b"0\n")
            self.assertFalse(held.capture_final()["initialDataEligible"])

    def test_failed_partial_attachment_closes_duplicates_without_changing_callers(self):
        for kind in ("invalid-fd", "alias", "wrong-parent", "interruption"):
            with self.subTest(kind=kind), Fixture() as fixture:
                roles = fixture.roles()
                if kind == "invalid-fd": roles["browser"] = -1
                if kind == "alias": roles["browser"] = roles["daemon"]
                if kind == "wrong-parent": roles["browser"] = fixture.parent_fd
                before = fds()
                held = fixture.open()
                held.capture_root_initial()
                real_acquire = held._acquire_directory
                def acquire(name, fd):
                    if kind == "interruption" and name == "browser": raise KeyboardInterrupt("Injected attachment interruption")
                    return real_acquire(name, fd)
                with mock.patch.object(held, "_acquire_directory", side_effect=acquire):
                    with self.assertRaises((ValueError, KeyboardInterrupt)): held.attach_roles(roles)
                self.assertEqual(fds(), before)
                self.assertTrue(held.closed)
                with self.assertRaises(ValueError): held.attach_roles(roles)
                for fd in [fixture.parent_fd, *fixture.fds.values()]: os.fstat(fd)

    def test_changed_root_counter_prevents_attachment_without_reopening(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            path = fixture.paths["run"] / "memory.peak"
            path.rename(path.with_name("old-peak"))
            path.write_bytes(b"0\n")
            with self.assertRaises(ValueError): held.attach_roles(fixture.roles())
            self.assertTrue(held.closed)

    def test_removed_or_replaced_role_is_partial_with_unaffected_sibling(self):
        with Fixture() as fixture, fixture.open() as held:
            fixture.prepare(held)
            path = fixture.paths["daemon"]
            path.rename(path.with_name("old-daemon"))
            path.mkdir()
            final = held.capture_final()
            self.assertIsNone(final["observations"]["daemon"]["snapshot"]["identity"])
            self.assertEqual(final["observations"]["daemon"]["snapshot"]["raw"], {})
            self.assertEqual(len(final["observations"]["browser"]["snapshot"]["raw"]), 8)

    def test_latched_counter_replacement_cannot_be_repaired_before_final(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            held.attach_roles(fixture.roles())
            path = fixture.paths["daemon"] / "memory.peak"
            old = path.with_name("old-peak")
            path.rename(old)
            path.write_bytes(b"0\n")
            initial = held.capture_roles_initial()
            path.unlink()
            old.rename(path)
            final = held.capture_final()
            for result in (initial, final):
                self.assertNotIn("memory.peak", result["observations"]["daemon"]["snapshot"]["raw"])
                self.assertFalse(result["initialDataEligible"])

    def test_raw_read_bounds_and_invalid_utf8_preserve_bytes(self):
        for raw in (b"\xff\n", b"7" * 4096, b"7" * 4097, b"7" * 8192):
            with self.subTest(length=len(raw)), Fixture() as fixture, fixture.open() as held:
                (fixture.paths["run"] / "memory.peak").write_bytes(raw)
                result = held.capture_root_initial()
                row = result["observations"]["run"]
                self.assertEqual(base64.b64decode(row["reads"]["memory.peak"]["bytesBase64"]), raw[:4097])
                self.assertEqual(row["reads"]["memory.peak"]["complete"], len(raw) == 4096)
                self.assertFalse(result["rootInitialEligible"])

    def test_partial_read_errno_and_short_reads_preserve_independent_fields(self):
        for number in (None, errno.EIO, errno.EINTR):
            with self.subTest(errno=number), Fixture() as fixture, fixture.open() as held:
                target = held.counters[("run", "memory.events")][0]
                real_read = os.pread
                def read(fd, size, offset):
                    self.assertLessEqual(size, 4096)
                    if fd == target:
                        if number is not None and offset: raise OSError(number, "Injected read failure")
                        return real_read(fd, min(size, 3), offset)
                    return real_read(fd, size, offset)
                with mock.patch.object(reader.os, "pread", side_effect=read):
                    result = held.capture_root_initial()
                row = result["observations"]["run"]
                self.assertEqual(result["rootInitialEligible"], number is None)
                self.assertEqual(row["snapshot"]["raw"]["memory.peak"], "0\n")
                if number is not None:
                    self.assertEqual(base64.b64decode(row["reads"]["memory.events"]["bytesBase64"]), b"low")
                    self.assertEqual(row["reads"]["memory.events"]["errors"][0]["errno"], number)
                    self.assertNotIn("memory.events", row["snapshot"]["raw"])

    def test_clock_failure_is_sticky_across_attachment_and_final(self):
        for bad in (True, -1, 2**64, RuntimeError("Injected clock failure")):
            with self.subTest(bad=bad), Fixture() as fixture, fixture.open() as held:
                held.capture_root_initial()
                held.attach_roles(fixture.roles())
                def fail():
                    if isinstance(bad, Exception): raise bad
                    return bad
                held.clock = fail
                initial = held.capture_roles_initial()
                held.clock = fixture.clock
                final = held.capture_final()
                for result in (initial, final):
                    self.assertFalse(result["initialDataEligible"])
                    row = result["observations"]["daemon"]
                    self.assertIsNone(row["snapshot"]["window"]["toNs"])
                    self.assertEqual(row["snapshot"]["raw"]["memory.peak"], "0\n")

    def test_acquisition_and_cross_stage_clock_reversals_reject_eligibility(self):
        with Fixture() as fixture:
            fixture.clock = lambda: False
            with fixture.open() as held:
                initial = held.capture_root_initial()
                self.assertIsNone(initial["acquiredAtNs"])
                self.assertTrue(initial["acquisitionErrors"])
                self.assertFalse(initial["rootInitialEligible"])
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            held.attach_roles(fixture.roles())
            fixture.clock.value = 0
            self.assertFalse(held.capture_roles_initial()["initialDataEligible"])

    def test_exception_consumes_phase_and_context_closes_handles(self):
        with Fixture() as fixture:
            before = fds()
            held = fixture.open()
            with self.assertRaises(KeyboardInterrupt), held:
                with mock.patch.object(held, "observe_scope", side_effect=KeyboardInterrupt("Injected capture interruption")):
                    held.capture_root_initial()
            self.assertEqual(fds(), before)
            with self.assertRaises(ValueError): held.capture_root_initial()

    def test_record_overflow_is_not_retryable(self):
        with Fixture() as fixture, fixture.open() as held:
            with mock.patch.object(reader, "MAX_RECORD", 1):
                with self.assertRaises(ValueError): held.capture_root_initial()
            with self.assertRaises(ValueError): held.capture_root_initial()

    def test_returned_mutations_cannot_change_initial_eligibility_or_descriptors(self):
        with Fixture() as fixture, fixture.open() as held:
            root = held.capture_root_initial()
            root["rootInitialEligible"] = False
            root["acquiredAtNs"] = "999999"
            root["observations"]["run"]["reads"]["memory.peak"]["identity"]["inode"] = "999999"
            held.attach_roles(fixture.roles())
            (fixture.paths["daemon"] / "memory.peak").write_bytes(b"1\n")
            roles = held.capture_roles_initial()
            roles["initialDataEligible"] = True
            final = held.capture_final()
            self.assertFalse(final["initialDataEligible"])
            self.assertEqual(final["acquiredAtNs"], "100")
            self.assertNotEqual(final["observations"]["run"]["reads"]["memory.peak"]["identity"]["inode"], "999999")

    def test_invalid_caller_flags_context_and_topology_close_duplicates(self):
        with Fixture() as fixture:
            before = fds()
            for run, boot, clock in [(fixture.parent_fd, BOOT, CLOCK), (-1, BOOT, CLOCK),
                                     (fixture.fds["run"], "invalid", CLOCK), (fixture.fds["run"], BOOT, True)]:
                with self.assertRaises(ValueError):
                    reader.StagedCounters(fixture.parent_fd, run, boot_id=boot, clock_id=clock)
                self.assertEqual(fds(), before)
            os.set_inheritable(fixture.parent_fd, True)
            try:
                with self.assertRaises(ValueError): fixture.open()
                self.assertTrue(os.get_inheritable(fixture.parent_fd))
            finally: os.set_inheritable(fixture.parent_fd, False)
            real_fcntl = fcntl.fcntl
            for flags in (os.O_RDWR, os.O_PATH):
                def bad_flags(fd, operation, *args):
                    if fd == fixture.parent_fd and operation == fcntl.F_GETFL: return flags
                    return real_fcntl(fd, operation, *args)
                with mock.patch.object(reader.fcntl, "fcntl", side_effect=bad_flags):
                    with self.assertRaises(ValueError): fixture.open()
                self.assertEqual(fds(), before)

    def test_constructor_interruption_and_close_errors_attempt_all_handles(self):
        with Fixture() as fixture:
            before, real_open = fds(), os.open
            def interrupt(path, *args, **kwargs):
                if path == "memory.swap.current": raise KeyboardInterrupt("Injected open interruption")
                return real_open(path, *args, **kwargs)
            with mock.patch.object(reader.os, "open", side_effect=interrupt):
                with self.assertRaises(KeyboardInterrupt): fixture.open()
            self.assertEqual(fds(), before)
            held = fixture.open()
            owned, real_close = list(held.owned), os.close
            def close(fd):
                real_close(fd)
                if fd == owned[-1]: raise OSError(errno.EIO, "Injected close result")
            with mock.patch.object(reader.os, "close", side_effect=close):
                with self.assertRaises(OSError): held.close()
            self.assertEqual(fds(), before)
            held.close()

    def test_counter_open_permissions_and_unsafe_file_types_remain_partial(self):
        for kind in ("denied", "symlink", "fifo", "directory"):
            with self.subTest(kind=kind), Fixture() as fixture:
                path = fixture.paths["run"] / "memory.peak"
                if kind != "denied": path.unlink()
                if kind == "symlink": path.symlink_to(fixture.paths["run"] / "memory.current")
                if kind == "fifo": os.mkfifo(path)
                if kind == "directory": path.mkdir()
                real_open = os.open
                def open_file(name, *args, **kwargs):
                    if kind == "denied" and name == "memory.peak": raise PermissionError(errno.EACCES, "Injected denial")
                    return real_open(name, *args, **kwargs)
                with mock.patch.object(reader.os, "open", side_effect=open_file), fixture.open() as held:
                    result = held.capture_root_initial()
                    self.assertFalse(result["rootInitialEligible"])
                    row = result["observations"]["run"]
                    self.assertEqual(len(row["snapshot"]["raw"]), 7)
                    if kind == "denied": self.assertEqual(row["reads"]["memory.peak"]["errors"][0]["errno"], errno.EACCES)

    def test_worst_case_final_record_stays_bounded_without_normalizing_scalars(self):
        with Fixture() as fixture, fixture.open() as held:
            fixture.prepare(held)
            for path in fixture.paths.values():
                for name in reader.INTERFACES: (path / name).write_bytes(b"\0" * 4096)
            final = held.capture_final()
            self.assertLessEqual(len(json.dumps(final, ensure_ascii=True).encode()), reader.MAX_RECORD)
            self.assertEqual(final["observations"]["run"]["snapshot"]["raw"]["memory.peak"], "\0" * 4096)

    def test_root_counter_change_during_role_initials_prevents_eligibility(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            held.attach_roles(fixture.roles())
            original = held.observe_scope
            def observe(scope):
                row = original(scope)
                if scope == "browser":
                    path = fixture.paths["run"] / "memory.peak"
                    path.rename(path.with_name("old-peak"))
                    path.write_bytes(b"0\n")
                return row
            with mock.patch.object(held, "observe_scope", side_effect=observe):
                result = held.capture_roles_initial()
            self.assertTrue(result["continuityErrors"])
            self.assertFalse(result["initialDataEligible"])
            self.assertEqual(len(result["observations"]["browser"]["snapshot"]["raw"]), 8)

    def test_distinct_wrong_parent_and_owner_or_mount_mismatch_are_rejected(self):
        with Fixture() as fixture:
            other = fixture.parent / "browser"
            other.mkdir()
            other_fd = os.open(other, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            try:
                before = fds()
                held = fixture.open()
                held.capture_root_initial()
                roles = fixture.roles()
                baseline = fds()
                roles["browser"] = other_fd
                with self.assertRaises((OSError, ValueError)): held.attach_roles(roles)
                self.assertEqual(len(fds()), len(baseline) - 10)
                self.assertTrue(before <= fds())
            finally: os.close(other_fd)
        for key in ("mountId", "uid", "gid"):
            with self.subTest(key=key), Fixture() as fixture:
                original = reader.descriptor_identity
                inode = os.fstat(fixture.fds["run"]).st_ino
                def changed(fd):
                    row = original(fd)
                    if row["inode"] == str(inode):
                        row[key] = str(int(row[key]) + 1) if key == "mountId" else row[key] + 1
                    return row
                before = fds()
                with mock.patch.object(reader, "descriptor_identity", side_effect=changed):
                    with self.assertRaises(ValueError): fixture.open()
                self.assertEqual(fds(), before)

    def test_open_and_read_identity_races_preserve_failure_and_bytes(self):
        for phase in ("open", "read"):
            with self.subTest(phase=phase), Fixture() as fixture:
                path = fixture.paths["run"] / "memory.peak"
                def replace():
                    path.rename(path.with_name("old-peak"))
                    path.write_bytes(b"0\n")
                if phase == "open":
                    real_open = os.open
                    def race(name, *args, **kwargs):
                        if name == "memory.peak": replace()
                        return real_open(name, *args, **kwargs)
                    with mock.patch.object(reader.os, "open", side_effect=race): held = fixture.open()
                else:
                    held = fixture.open()
                with held:
                    real_read = os.pread
                    target = held.counters.get(("run", "memory.peak"), (None,))[0]
                    def read(fd, size, offset):
                        raw = real_read(fd, size, offset)
                        if phase == "read" and fd == target and offset == 0: replace()
                        return raw
                    with mock.patch.object(reader.os, "pread", side_effect=read):
                        result = held.capture_root_initial()
                    self.assertFalse(result["rootInitialEligible"])
                    row = result["observations"]["run"]
                    self.assertNotIn("memory.peak", row["snapshot"]["raw"])
                    self.assertEqual(base64.b64decode(row["reads"]["memory.peak"]["bytesBase64"]),
                                     b"0\n" if phase == "read" else b"")

    def test_mount_metadata_failure_is_bounded_and_preserves_errno(self):
        with Fixture() as fixture:
            before = fds()
            for raw in (b"pos: 0\n", b"mnt_id:\t1\nmnt_id:\t2\n", b"mnt_id:\t0\n"):
                with mock.patch.object(reader, "bounded_read", return_value=(raw, None)):
                    with self.assertRaises(ValueError): reader.descriptor_identity(fixture.parent_fd)
            error = reader.error_record(PermissionError(errno.EACCES, "Metadata denied"), "read")
            with mock.patch.object(reader, "bounded_read", return_value=(b"", error)):
                with self.assertRaises(OSError) as result: reader.descriptor_identity(fixture.parent_fd)
                self.assertEqual(result.exception.errno, errno.EACCES)
            self.assertEqual(fds(), before)

    def test_returned_open_error_mutation_cannot_repair_initial_or_final(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture_root_initial()
            roles = fixture.roles()
            (fixture.paths["browser"] / "memory.peak").unlink()
            held.attach_roles(roles)
            initial = held.capture_roles_initial()
            initial["observations"]["browser"]["reads"]["memory.peak"]["errors"][0]["stage"] = "clock"
            final = held.capture_final()
            self.assertFalse(final["initialDataEligible"])
            row = final["observations"]["browser"]
            self.assertEqual(row["reads"]["memory.peak"]["errors"][0]["stage"], "open")
            self.assertNotIn("memory.peak", row["snapshot"]["raw"])


def integration_fixtures():
    results = {}
    for case in ("valid", "breach-and-missing", "missing-final"):
        with Fixture() as fixture, fixture.open() as held:
            root = held.capture_root_initial()
            held.attach_roles(fixture.roles())
            (fixture.paths["run"] / "memory.peak").write_bytes(b"520192\n")
            roles = held.capture_roles_initial()
            if case == "breach-and-missing":
                (fixture.paths["run"] / "memory.peak").write_bytes(b"1476395009\n")
                (fixture.paths["browser"] / "memory.swap.peak").unlink()
            elif case == "missing-final":
                (fixture.paths["run"] / "memory.peak").unlink()
            fixture.clock.value = 700
            final = held.capture_final()
            results[case] = {"rootInitial": root, "rolesInitial": roles, "final": final,
                             "suppliedLifecycleIsSynthetic": True}
    return results


if __name__ == "__main__":
    if sys.argv[1:] == ["--emit-fixtures"]:
        print(json.dumps(integration_fixtures(), separators=(",", ":")))
    else:
        unittest.main(verbosity=2)
