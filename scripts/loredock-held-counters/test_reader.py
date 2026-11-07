"""Temporary-file counter observations only; no service, cgroup or workload is created."""
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

SPEC = importlib.util.spec_from_file_location("held_reader", Path(__file__).with_name("reader.py"))
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
        self.temporary = tempfile.TemporaryDirectory(prefix="loredock-counter-test-")
        self.parent = Path(self.temporary.name)
        self.paths = {"run": self.parent / "run", "daemon": self.parent / "run/daemon",
                      "browser": self.parent / "run/browser"}
        for path in self.paths.values():
            path.mkdir()
            for name, raw in VALUES.items():
                (path / name).write_bytes(raw)
        self.parent_fd = os.open(self.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        self.fds = {name: os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
                    for name, path in self.paths.items()}
        self.clock = Clock()

    def open(self, **kwargs):
        return reader.HeldCounters(self.parent_fd, self.fds, boot_id=BOOT, clock_id=CLOCK,
                                   clock=self.clock, **kwargs)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        for fd in [self.parent_fd, *self.fds.values()]:
            os.close(fd)
        self.temporary.cleanup()


def fds():
    return set(os.listdir("/proc/self/fd"))


class ReaderTests(unittest.TestCase):
    def test_exact_raw_bytes_and_role_before_root_windows(self):
        with Fixture() as fixture, fixture.open() as held:
            result = held.capture()
            self.assertEqual(result["scopeOrder"], ["daemon", "browser", "run"])
            previous = 0
            for scope in result["scopeOrder"]:
                row = result["observations"][scope]
                self.assertEqual(row["snapshot"]["raw"], {name: raw.decode() for name, raw in VALUES.items()})
                self.assertFalse(row["errors"])
                self.assertGreater(int(row["snapshot"]["window"]["fromNs"]), previous)
                previous = int(row["snapshot"]["window"]["toNs"])
                for name, value in row["reads"].items():
                    self.assertTrue(value["complete"])
                    self.assertFalse(value["errors"])
                    self.assertEqual(base64.b64decode(value["bytesBase64"]), VALUES[name])
            self.assertTrue(result["offlineOnly"])
            for key in ("ownershipEstablished", "executorQualified", "resourceQualification", "terminalEstablished"):
                self.assertFalse(result[key])

    def test_second_observation_reuses_read_only_noninheritable_descriptors(self):
        with Fixture() as fixture, fixture.open() as held:
            self.assertEqual(len(held.owned), 28)
            for fd in held.owned:
                self.assertFalse(os.get_inheritable(fd))
                self.assertEqual(fcntl.fcntl(fd, fcntl.F_GETFL) & os.O_ACCMODE, os.O_RDONLY)
            held.capture()
            (fixture.paths["daemon"] / "memory.peak").write_bytes(b"17\n")
            real_open = os.open
            def no_counter_open(path, *args, **kwargs):
                self.assertNotIn(path, reader.INTERFACES)
                return real_open(path, *args, **kwargs)
            with mock.patch.object(reader.os, "open", side_effect=no_counter_open):
                result = held.capture()
            self.assertEqual(result["observations"]["daemon"]["snapshot"]["raw"]["memory.peak"], "17\n")

    def test_invalid_scope_and_context_reject_before_any_open(self):
        with Fixture() as fixture:
            for scopes, boot, clock in [(dict(fixture.fds, control=fixture.parent_fd), BOOT, CLOCK),
                    ({"run": fixture.fds["run"]}, BOOT, CLOCK), (fixture.fds, "invalid", CLOCK),
                    (fixture.fds, BOOT, "invalid"), (fixture.fds, True, CLOCK)]:
                with mock.patch.object(reader.os, "open", side_effect=AssertionError("Unexpected open")):
                    with self.assertRaises(ValueError):
                        reader.HeldCounters(fixture.parent_fd, scopes, boot_id=boot, clock_id=clock)

    def test_inheritable_original_handle_is_rejected_without_changing_flags(self):
        with Fixture() as fixture:
            os.set_inheritable(fixture.parent_fd, True)
            try:
                with self.assertRaises(ValueError): fixture.open()
                self.assertTrue(os.get_inheritable(fixture.parent_fd))
            finally:
                os.set_inheritable(fixture.parent_fd, False)

    def test_writable_and_path_only_flags_are_rejected(self):
        with Fixture() as fixture:
            real_fcntl = fcntl.fcntl
            for value in (os.O_RDWR, os.O_PATH):
                def flags(fd, operation, *args):
                    if fd == fixture.parent_fd and operation == fcntl.F_GETFL: return value
                    return real_fcntl(fd, operation, *args)
                with mock.patch.object(reader.fcntl, "fcntl", side_effect=flags):
                    with self.assertRaises(ValueError): fixture.open()

    def test_aliases_and_wrong_topology_close_duplicates(self):
        with Fixture() as fixture:
            for kind in ("alias", "wrong-parent"):
                extra = fixture.parent / "other"
                extra.mkdir(exist_ok=True)
                fd = os.open(extra, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
                scopes = dict(fixture.fds, browser=fixture.fds["daemon"] if kind == "alias" else fd)
                before = fds()
                try:
                    with self.assertRaises(ValueError):
                        reader.HeldCounters(fixture.parent_fd, scopes, boot_id=BOOT, clock_id=CLOCK)
                    self.assertEqual(fds(), before)
                finally: os.close(fd)

    def test_missing_interface_is_sticky_even_if_it_appears_later(self):
        with Fixture() as fixture:
            path = fixture.paths["browser"] / "memory.swap.peak"
            path.unlink()
            with fixture.open() as held:
                path.write_bytes(b"0\n")
                result = held.capture()["observations"]["browser"]
                self.assertNotIn("memory.swap.peak", result["snapshot"]["raw"])
                self.assertEqual(result["reads"]["memory.swap.peak"]["errors"][0]["errno"], errno.ENOENT)
                self.assertEqual(len(result["snapshot"]["raw"]), 7)

    def test_symlink_fifo_and_directory_counter_names_do_not_block_or_follow(self):
        for kind in ("symlink", "fifo", "directory"):
            with self.subTest(kind=kind), Fixture() as fixture:
                path = fixture.paths["daemon"] / "memory.peak"
                path.unlink()
                if kind == "symlink": path.symlink_to(fixture.paths["run"] / "memory.peak")
                elif kind == "fifo": os.mkfifo(path)
                else: path.mkdir()
                with fixture.open() as held:
                    row = held.capture()["observations"]["daemon"]
                    self.assertNotIn("memory.peak", row["snapshot"]["raw"])
                    self.assertFalse(row["reads"]["memory.peak"]["complete"])

    def test_exact_read_bound_and_overflow_prefix(self):
        for size in (4096, 4097, 8192):
            with self.subTest(size=size), Fixture() as fixture:
                (fixture.paths["daemon"] / "memory.peak").write_bytes(b"7" * size)
                with fixture.open() as held:
                    row = held.capture()["observations"]["daemon"]
                    self.assertEqual(row["reads"]["memory.peak"]["complete"], size == 4096)
                    self.assertEqual(len(base64.b64decode(row["reads"]["memory.peak"]["bytesBase64"])), min(size, 4097))
                    self.assertEqual("memory.peak" in row["snapshot"]["raw"], size == 4096)

    def test_short_reads_are_joined_without_normalization(self):
        with Fixture() as fixture, fixture.open() as held:
            path = fixture.paths["daemon"] / "memory.events"
            path.write_bytes(b" x\n" * 1000)
            target = held.counters[("daemon", "memory.events")][0]
            real_read = os.pread
            def short(fd, size, offset):
                self.assertLessEqual(size, 4096)
                return real_read(fd, min(size, 1) if fd == target else size, offset)
            with mock.patch.object(reader.os, "pread", side_effect=short):
                row = held.capture()["observations"]["daemon"]
            self.assertEqual(row["snapshot"]["raw"]["memory.events"], " x\n" * 1000)

    def test_error_after_prefix_and_interrupted_reads_preserve_other_values(self):
        for number in (errno.EIO, errno.EINTR):
            with self.subTest(errno=number), Fixture() as fixture, fixture.open() as held:
                target = held.counters[("daemon", "memory.events")][0]
                real_read = os.pread
                def fail(fd, size, offset):
                    if fd == target:
                        if offset: raise OSError(number, "Injected read failure")
                        return real_read(fd, 3, offset)
                    return real_read(fd, size, offset)
                with mock.patch.object(reader.os, "pread", side_effect=fail):
                    row = held.capture()["observations"]["daemon"]
                self.assertEqual(base64.b64decode(row["reads"]["memory.events"]["bytesBase64"]), b"low")
                self.assertFalse(row["reads"]["memory.events"]["complete"])
                self.assertNotIn("memory.events", row["snapshot"]["raw"])
                self.assertEqual(row["snapshot"]["raw"]["memory.peak"], "0\n")
                self.assertEqual(row["reads"]["memory.events"]["errors"][0]["errno"], number)

    def test_invalid_utf8_retains_exact_bytes_without_a_scalar(self):
        with Fixture() as fixture, fixture.open() as held:
            (fixture.paths["run"] / "memory.peak").write_bytes(b"\xff\n")
            row = held.capture()["observations"]["run"]
            self.assertEqual(base64.b64decode(row["reads"]["memory.peak"]["bytesBase64"]), b"\xff\n")
            self.assertNotIn("memory.peak", row["snapshot"]["raw"])

    def test_counter_replacement_is_latched_and_never_reopened(self):
        with Fixture() as fixture, fixture.open() as held:
            initial = held.capture()
            path = fixture.paths["daemon"] / "memory.peak"
            old = path.with_name("old-peak")
            path.rename(old)
            path.write_bytes(b"400\n")
            row = held.capture()["observations"]["daemon"]
            self.assertNotIn("memory.peak", row["snapshot"]["raw"])
            path.unlink(); old.rename(path)
            self.assertNotIn("memory.peak", held.capture()["observations"]["daemon"]["snapshot"]["raw"])
            self.assertEqual(initial["observations"]["daemon"]["snapshot"]["raw"]["memory.peak"], "0\n")

    def test_removed_counter_does_not_reuse_the_previous_complete_value(self):
        with Fixture() as fixture, fixture.open() as held:
            first = held.capture()
            (fixture.paths["daemon"] / "memory.peak").unlink()
            last = held.capture()
            self.assertIn("memory.peak", first["observations"]["daemon"]["snapshot"]["raw"])
            self.assertNotIn("memory.peak", last["observations"]["daemon"]["snapshot"]["raw"])

    def test_scope_replacement_invalidates_identity_and_preserves_other_scopes(self):
        with Fixture() as fixture, fixture.open() as held:
            old = fixture.paths["daemon"].with_name("old-daemon")
            fixture.paths["daemon"].rename(old)
            fixture.paths["daemon"].mkdir()
            result = held.capture()
            self.assertIsNone(result["observations"]["daemon"]["snapshot"]["identity"])
            self.assertIsNotNone(result["observations"]["browser"]["snapshot"]["identity"])
            fixture.paths["daemon"].rmdir(); old.rename(fixture.paths["daemon"])
            self.assertIsNone(held.capture()["observations"]["daemon"]["snapshot"]["identity"])

    def test_symlinked_run_name_is_not_followed(self):
        with Fixture() as fixture:
            original = fixture.parent / "original-run"
            fixture.paths["run"].rename(original)
            fixture.paths["run"].symlink_to(original, target_is_directory=True)
            with self.assertRaises(ValueError): fixture.open()

    def test_open_race_retains_the_counter_identity_failure(self):
        with Fixture() as fixture:
            real_open = os.open
            replaced = False
            def race(path, flags, *args, **kwargs):
                nonlocal replaced
                if path == "memory.peak" and not replaced:
                    replaced = True
                    directory = kwargs["dir_fd"]
                    os.rename(path, "old-peak", src_dir_fd=directory, dst_dir_fd=directory)
                    fd = real_open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=directory)
                    os.write(fd, b"0\n"); os.close(fd)
                return real_open(path, flags, *args, **kwargs)
            with mock.patch.object(reader.os, "open", side_effect=race), fixture.open() as held:
                row = held.capture()["observations"]["daemon"]
                self.assertNotIn("memory.peak", row["snapshot"]["raw"])
                self.assertIn("changed while opening", row["reads"]["memory.peak"]["errors"][0]["message"])

    def test_invalid_or_failed_clock_invalidates_window_without_erasing_bytes(self):
        for value in (True, -1, 18446744073709551616, RuntimeError("Injected clock failure")):
            with self.subTest(value=value), Fixture() as fixture, fixture.open() as held:
                calls = 0
                def clock():
                    nonlocal calls
                    calls += 1
                    if calls == 3:
                        if isinstance(value, Exception): raise value
                        return value
                    return 100 + calls
                held.clock = clock
                row = held.capture()["observations"]["daemon"]
                self.assertIsNone(row["snapshot"]["window"]["toNs"])
                self.assertEqual(row["snapshot"]["raw"]["memory.current"], "0\n")

    def test_clock_reversal_between_captures_is_not_accepted(self):
        with Fixture() as fixture, fixture.open() as held:
            held.capture()
            fixture.clock.value = 0
            row = held.capture()["observations"]["daemon"]
            self.assertIsNone(row["snapshot"]["window"]["fromNs"])
            self.assertIsNone(row["snapshot"]["window"]["toNs"])

    def test_normal_and_exceptional_close_preserve_caller_handles(self):
        with Fixture() as fixture:
            for fail in (False, True):
                held = fixture.open(); owned = list(held.owned)
                try:
                    with held:
                        held.capture()
                        if fail: raise RuntimeError("Caller failed")
                except RuntimeError: pass
                held.close()
                for fd in owned:
                    with self.assertRaises(OSError): os.fstat(fd)
                for fd in [fixture.parent_fd, *fixture.fds.values()]: os.fstat(fd)
                with self.assertRaises(ValueError): held.capture()

    def test_constructor_interruption_closes_all_acquired_handles(self):
        with Fixture() as fixture:
            before = fds(); real_open = os.open
            def interrupt(path, *args, **kwargs):
                if path == "memory.swap.current": raise KeyboardInterrupt("Injected constructor interruption")
                return real_open(path, *args, **kwargs)
            with mock.patch.object(reader.os, "open", side_effect=interrupt):
                with self.assertRaises(KeyboardInterrupt): fixture.open()
            self.assertEqual(fds(), before)

    def test_close_error_is_reported_after_attempting_all_owned_handles(self):
        with Fixture() as fixture:
            held = fixture.open(); owned = list(held.owned); real_close = os.close
            def close(fd):
                real_close(fd)
                if fd == owned[-1]: raise OSError(errno.EIO, "Injected close result")
            with mock.patch.object(reader.os, "close", side_effect=close):
                with self.assertRaises(OSError): held.close()
            for fd in owned:
                with self.assertRaises(OSError): os.fstat(fd)

    def test_reentrant_capture_is_denied(self):
        with Fixture() as fixture, fixture.open() as held:
            held.busy = True
            with self.assertRaises(ValueError): held.capture()
            held.busy = False
            held.capture()

    def test_worst_case_escaped_raw_records_remain_bounded(self):
        with Fixture() as fixture:
            for path in fixture.paths.values():
                for name in VALUES: (path / name).write_bytes(b"\0" * 4096)
            with fixture.open() as held:
                result = held.capture()
                self.assertLessEqual(len(json.dumps(result, ensure_ascii=True).encode()), reader.MAX_RECORD)

    def test_returned_metadata_cannot_mutate_reader_state(self):
        with Fixture() as fixture:
            (fixture.paths["daemon"] / "memory.swap.peak").unlink()
            with fixture.open() as held:
                row = held.capture()["observations"]["daemon"]
                original = row["reads"]["memory.peak"]["identity"]["inode"]
                row["reads"]["memory.peak"]["identity"]["inode"] = "999999999"
                row["reads"]["memory.swap.peak"]["errors"][0]["stage"] = "clock"
                next_row = held.capture()["observations"]["daemon"]
                self.assertEqual(next_row["reads"]["memory.peak"]["identity"]["inode"], original)
                self.assertEqual(next_row["snapshot"]["raw"]["memory.peak"], "0\n")
                self.assertNotIn("memory.swap.peak", next_row["snapshot"]["raw"])
                self.assertEqual(next_row["reads"]["memory.swap.peak"]["errors"][0]["stage"], "open")

    def test_replacement_during_read_retains_bytes_but_invalidates_the_scalar(self):
        with Fixture() as fixture, fixture.open() as held:
            target = held.counters[("daemon", "memory.peak")][0]
            path = fixture.paths["daemon"] / "memory.peak"
            real_read = os.pread
            def replace(fd, size, offset):
                value = real_read(fd, size, offset)
                if fd == target and offset == 0:
                    path.rename(path.with_name("old-peak"))
                    path.write_bytes(b"100\n")
                return value
            with mock.patch.object(reader.os, "pread", side_effect=replace):
                row = held.capture()["observations"]["daemon"]
            self.assertEqual(base64.b64decode(row["reads"]["memory.peak"]["bytesBase64"]), b"0\n")
            self.assertNotIn("memory.peak", row["snapshot"]["raw"])

    def test_permission_denial_retains_errno_and_other_fields(self):
        with Fixture() as fixture:
            real_open = os.open
            def deny(path, *args, **kwargs):
                if path == "memory.events": raise PermissionError(errno.EACCES, "Injected permission denial")
                return real_open(path, *args, **kwargs)
            with mock.patch.object(reader.os, "open", side_effect=deny), fixture.open() as held:
                row = held.capture()["observations"]["daemon"]
                self.assertEqual(row["reads"]["memory.events"]["errors"][0]["errno"], errno.EACCES)
                self.assertNotIn("memory.events", row["snapshot"]["raw"])
                self.assertEqual(len(row["snapshot"]["raw"]), 7)

    def test_missing_ambiguous_or_unreadable_mount_metadata_never_passes(self):
        with Fixture() as fixture:
            before = fds()
            for raw in (b"pos: 0\n", b"mnt_id:\t1\nmnt_id:\t2\n", b"mnt_id:\t0\n"):
                with mock.patch.object(reader, "bounded_read", return_value=(raw, None)):
                    with self.assertRaises(ValueError): reader.descriptor_identity(fixture.parent_fd)
            failure = reader.error_record(PermissionError(errno.EACCES, "Metadata denied"), "read")
            with mock.patch.object(reader, "bounded_read", return_value=(b"", failure)):
                with self.assertRaises(OSError) as result: reader.descriptor_identity(fixture.parent_fd)
                self.assertEqual(result.exception.errno, errno.EACCES)
            self.assertEqual(fds(), before)


def integration_fixtures():
    results = {}
    for case in ("valid", "breach-and-missing", "missing-final"):
        with Fixture() as fixture, fixture.open() as held:
            initial = held.capture()
            for scope, value in [("daemon", 200), ("browser", 300), ("run", 500)]:
                (fixture.paths[scope] / "memory.peak").write_text(str(value) + "\n")
            fixture.clock.value = 500
            previous = held.capture()
            if case == "breach-and-missing":
                for scope in ("daemon", "run"):
                    (fixture.paths[scope] / "memory.peak").write_text("402653185\n")
                (fixture.paths["browser"] / "memory.swap.peak").unlink()
            elif case == "missing-final":
                (fixture.paths["daemon"] / "memory.peak").unlink()
            fixture.clock.value = 700
            final = held.capture()
            results[case] = {"initial": initial, "previous": previous, "final": final,
                             "suppliedLifecycleIsSynthetic": True}
    return results


if __name__ == "__main__":
    if sys.argv[1:] == ["--emit-fixtures"]:
        print(json.dumps(integration_fixtures(), separators=(",", ":")))
    else:
        unittest.main(verbosity=2)
