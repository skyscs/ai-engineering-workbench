"""Offline adapter regressions; no systemd, Bubblewrap or cgroup mutation."""
import copy
import errno
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


probe = load(HERE / "probe.py", "user_probe")
support = load(HERE.parent / "loredock-namespace-prerequisite/probe.py", "accepted_support")
fixtures = load(HERE.parent / "loredock-user-service-ownership/test_assess.py", "accepted_fixtures")
validator = fixtures.module
RUN_ID = fixtures.EXPECTED["runId"]
UNIT = "loredock-task154-" + RUN_ID + ".service"
ROOT = "/user.slice/user-1000.slice/user@1000.service"
GROUP = ROOT + "/app.slice/" + UNIT
HASH = "a" * 64
INVOCATION = fixtures.EXPECTED["invocationId"]
BOOT = fixtures.EXPECTED["bootId"]


def data(output):
    manifest = {"runId": RUN_ID, "unit": UNIT, "uid": 1000, "gid": 1000, "output": str(output)}
    expected = probe.expected_subject(manifest, HASH, {"invocationId": INVOCATION}, BOOT)
    row = json.loads(fixtures.encode(fixtures.fixture()["before"]).replace(fixtures.EXPECTED["unit"], UNIT))
    row["window"]["clockId"] = expected["clockId"]
    row.pop("marker")
    return manifest, expected, row


def absent():
    return {"failure": None, "exitCode": 0}, {"Id": UNIT, "LoadState": "not-found", "ActiveState": "inactive",
                                              "MainPID": "0", "InvocationID": "", "ControlGroup": ""}


class FakeHeld:
    def __init__(self, row, fd=123):
        self.row, self.closed = row, False
        self.fds = [fd] * 7

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.closed = True

    def snapshot(self):
        return copy.deepcopy(self.row["directories"]), {"unit": "mnt_id:\t48\n"}


class AdapterTests(unittest.TestCase):
    def collect(self, directory, marker=None, failing=None):
        manifest, expected, row = data(directory)
        fake = SimpleNamespace(command_env=lambda uid: {}, capture=Mock(return_value={"exitCode": 0,
            "failure": None, "stdout": "ControlGroup=" + ROOT + "\n"}),
            manager_state=Mock(return_value=({"exitCode": 0, "failure": None, "stdout": row["unitRaw"]}, {})))
        if failing == "manager":
            fake.capture.return_value["failure"] = "TIMEOUT"
        if failing == "unit":
            fake.manager_state.return_value[0]["failure"] = "TIMEOUT"
        held = FakeHeld(row)
        if failing == "directories":
            held.snapshot = Mock(side_effect=OSError(errno.EIO, "Invented directory failure"))
        original = probe.read_bounded
        def read(path, maximum=probe.MAX_RECORD, *, dir_fd=None):
            name = str(path)
            if failing == name:
                raise OSError(errno.EIO, "Invented read failure")
            if name == "/proc/self/cgroup":
                return row["placementRaw"].encode()
            if name == "/proc/self/mountinfo":
                return b"48 46 0:30 / /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n"
            if name == "cgroup.controllers":
                self.assertEqual(dir_fd, 123)
                return b"memory\n"
            return original(path, maximum, dir_fd=dir_fd)
        def observe(fd):
            self.assertTrue((Path(directory) / "before-required.json").exists())
            if isinstance(marker, BaseException):
                raise marker
            return marker or {"state": "missing", "errno": 61}
        with patch.object(probe, "read_bounded", side_effect=read), patch.object(probe, "process_record", return_value=(row["process"], "invented stat"),
                side_effect=OSError(errno.EIO, "Invented process failure") if failing == "process" else None), patch.object(probe, "optional_marker", side_effect=observe):
            return probe.collect_observation(manifest, expected, fake, held, "before")

    def setup_service(self, output):
        manifest, expected, row = data(output)
        claim = Path(str(output) + ".claim")
        self.addCleanup(claim.unlink, missing_ok=True)
        probe.retain(claim, {"manifestSha256": HASH, "unit": UNIT})
        command, properties = absent()
        probe.save(output, "manager-initial", {"command": command, "properties": properties})
        return manifest, expected, row

    def service_case(self, output, edit=None, interrupt=False):
        manifest, expected, row = self.setup_service(output)
        held = FakeHeld(row)
        def collect(_manifest, binding, _support, _held, phase):
            current = copy.deepcopy(row)
            current["window"] = {"clockId": binding["clockId"], "fromNs": str(probe.time.monotonic_ns()),
                                 "toNs": str(probe.time.monotonic_ns())}
            if edit:
                edit(current, phase)
            probe.save(output, phase + "-required", current)
            if phase == "after":
                raise KeyboardInterrupt() if interrupt else OSError(errno.EIO, "Invented later read failure")
            return current
        fake = SimpleNamespace(capture=Mock(side_effect=AssertionError("Sandbox must not run")))
        with patch.dict(os.environ, {"INVOCATION_ID": INVOCATION}), patch.object(probe, "HeldDirectories", return_value=held), patch.object(probe, "collect_observation", side_effect=collect), patch.object(probe, "expected_subject", return_value=expected):
            result = probe.service(manifest, HASH, fake, validator)
        self.assertTrue(held.closed)
        self.assertFalse(fake.capture.called)
        self.assertEqual(result, 1)
        return json.loads((output / "ownership-assessment.json").read_text())

    def test_01_required_records_are_durable_before_absent_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            row = self.collect(directory)
            self.assertEqual(row["marker"], {"state": "missing", "errno": 61})
            self.assertTrue((Path(directory) / "before.json").exists())

    def test_02_optional_marker_exception_keeps_required_records(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(OSError):
                self.collect(directory, OSError(errno.EIO, "Invented marker failure"))
            self.assertTrue((Path(directory) / "before-required.json").exists())
            self.assertFalse((Path(directory) / "before.json").exists())
        for code, state in [(errno.ENODATA, "missing"), (errno.EACCES, "unreadable"), (errno.EIO, "unreadable")]:
            with patch.object(os, "getxattr", side_effect=OSError(code, "Invented")):
                self.assertEqual(probe.optional_marker(123), {"state": state, "errno": code})

    def test_03_later_required_read_errors_preserve_earlier_steps(self):
        for failed, retained in [("manager", ["manager"]), ("unit", ["manager", "unit"]),
                                 ("/proc/self/cgroup", ["manager", "unit"]),
                                 ("process", ["manager", "unit", "placement"]),
                                 ("directories", ["manager", "unit", "placement", "process"]),
                                 ("/proc/self/mountinfo", ["manager", "unit", "placement", "process", "directories"]),
                                 ("cgroup.controllers", ["manager", "unit", "placement", "process", "directories", "mount"])]:
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises((OSError, ValueError)):
                    self.collect(directory, failing=failed)
                for part in retained:
                    self.assertTrue((Path(directory) / ("before-" + part + ".json")).exists())

    def test_04_independent_invocation_mismatch_blocks_sandbox(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.service_case(Path(directory), lambda row, _: row["process"].update(invocationId="c" * 32))
            self.assertEqual(result["status"], "UNAVAILABLE")
        with self.assertRaises(ValueError):
            probe.expected_subject({"unit": UNIT}, HASH, {"invocationId": None}, BOOT)

    def test_05_changed_start_or_directory_identity_is_unavailable(self):
        for edit in [lambda row: row["process"].update(startTimeTicks="999"),
                     lambda row: row["directories"]["unit"].update(inode="999")]:
            with tempfile.TemporaryDirectory() as directory:
                result = self.service_case(Path(directory), lambda row, phase: edit(row) if phase == "after" else None)
                self.assertEqual(result["status"], "UNAVAILABLE")

    def tree(self, directory):
        root = Path(directory)
        group = root / GROUP.lstrip("/")
        (group / "attestor").mkdir(parents=True)
        return root, group

    def test_06_held_descriptors_do_not_hide_named_directory_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root, group = self.tree(directory)
            with probe.HeldDirectories(1000, UNIT, root) as held:
                held.snapshot()
                group.rename(group.with_name("replaced"))
                (group / "attestor").mkdir(parents=True)
                with self.assertRaisesRegex(ValueError, "replaced"):
                    held.snapshot()

    def test_07_directory_descriptors_close_on_success_error_and_interruption(self):
        for error in (None, ValueError("Invented"), KeyboardInterrupt()):
            with tempfile.TemporaryDirectory() as directory:
                root, _ = self.tree(directory)
                opened = []
                try:
                    with probe.HeldDirectories(1000, UNIT, root) as held:
                        opened = list(held.fds)
                        if error:
                            raise error
                except (ValueError, KeyboardInterrupt):
                    pass
                self.assertEqual(len(opened), 7)
                for fd in opened:
                    with self.assertRaises(OSError):
                        os.fstat(fd)

    def test_08_held_descriptors_are_not_inherited_by_captured_children(self):
        with tempfile.TemporaryDirectory() as directory:
            root, _ = self.tree(directory)
            with probe.HeldDirectories(1000, UNIT, root) as held:
                self.assertTrue(all(not os.get_inheritable(fd) for fd in held.fds))
                command = [sys.executable, "-I", "-S", "-c", "import os; print([fd for fd in range(3,256) if os.path.exists('/proc/self/fd/'+str(fd))])"]
                result = support.capture(command, timeout=2, env={})
                self.assertEqual(result["stdout"].strip(), "[]")
                self.assertEqual(result["exitCode"], 0)

    def test_09_existing_or_ambiguous_unit_never_receives_start(self):
        for key, value in [("LoadState", "loaded"), ("InvocationID", INVOCATION), ("MainPID", "12"), ("ControlGroup", GROUP)]:
            with tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "task154-user-namespace-first"
                manifest, _, _ = data(output)
                result, fields = absent()
                fields[key] = value
                fake = SimpleNamespace(manager_state=Mock(return_value=(result, fields)), capture=Mock())
                self.assertEqual(probe.run_first(manifest, Path(directory) / "manifest", HASH, fake), 1)
                self.assertFalse(fake.capture.called)

    def test_10_outside_claim_is_exclusive_before_any_query(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "task154-user-namespace-first"
            manifest, _, _ = data(output)
            probe.retain(Path(str(output) + ".claim"), {"first": True})
            fake = SimpleNamespace(manager_state=Mock(side_effect=AssertionError("No query")))
            with self.assertRaises(FileExistsError):
                probe.run_first(manifest, Path(directory) / "manifest", HASH, fake)
            self.assertFalse(fake.manager_state.called)

    def test_11_internal_entry_is_exclusive_before_collection(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            manifest, _, _ = self.setup_service(output)
            probe.save(output, "service-entry", {"first": True})
            with patch.object(probe, "HeldDirectories", side_effect=AssertionError("No descriptors")):
                with self.assertRaises(FileExistsError):
                    probe.service(manifest, HASH, None, None)

    def test_12_known_violation_survives_later_collection_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.service_case(Path(directory), lambda row, _: row.update(unitRaw=row["unitRaw"].replace("NoNewPrivileges=yes", "NoNewPrivileges=no")))
            self.assertEqual(result["status"], "FAIL")

    def test_13_terminal_evidence_requires_exact_identity_and_closure(self):
        owner = {"unit": UNIT, "invocationId": INVOCATION, "group": "/sys/fs/cgroup" + GROUP}
        command, fields = absent()
        self.assertTrue(probe.terminal_valid(command, fields, owner))
        for key, value in [("MainPID", "12"), ("InvocationID", INVOCATION), ("ControlGroup", GROUP), ("Id", "other.service")]:
            self.assertFalse(probe.terminal_valid(command, {**fields, key: value}, owner))
        self.assertFalse(probe.terminal_valid(command, {}, owner))
        self.assertFalse(probe.terminal_valid(command, fields, None))

    def test_14_foreign_invocation_or_group_never_authorizes_cleanup(self):
        owner = {"unit": UNIT, "invocationId": INVOCATION, "group": "/sys/fs/cgroup" + GROUP}
        fields = {"Id": UNIT, "InvocationID": INVOCATION, "ControlGroup": GROUP, "ActiveState": "active"}
        self.assertTrue(probe.cleanup_allowed(fields, owner))
        for key, value in [("InvocationID", "c" * 32), ("ControlGroup", "/terminal"), ("Id", "foreign.service")]:
            self.assertFalse(probe.cleanup_allowed({**fields, key: value}, owner))

    def test_15_collection_interruption_retains_evidence_and_blocks_sandbox(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            self.service_case(output, interrupt=True)
            self.assertEqual(json.loads((output / "acquisition-error.json").read_text())["type"], "KeyboardInterrupt")
            self.assertTrue((output / "before-required.json").exists())

    def test_16_record_and_total_output_bounds_precede_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with self.assertRaisesRegex(ValueError, "Receipt"):
                probe.save(output, "oversized", "x" * probe.MAX_RECORD)
            (output / "existing").write_bytes(b"x" * probe.MAX_OUTPUT)
            with self.assertRaisesRegex(ValueError, "First output"):
                probe.save(output, "overflow", {})
            self.assertFalse((output / "overflow.json").exists())

    def test_17_manifest_and_command_mismatch_prevent_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest_path = root / "manifest"
            manifest_path.write_text("{}")
            with self.assertRaisesRegex(ValueError, "digest"):
                probe.load_manifest(manifest_path, HASH)
            output = root / "task154-user-namespace-first"
            manifest, _, _ = data(output)
            manifest.update(serviceCommandTemplate=["wrong"], sandboxCommand=[])
            fake = SimpleNamespace(manager_state=Mock(return_value=absent()),
                service_command=Mock(return_value=["actual"]), sandbox_command=Mock(return_value=[]), capture=Mock())
            self.assertEqual(probe.run_first(manifest, manifest_path, HASH, fake), 1)
            self.assertFalse(fake.capture.called)

    def test_18_outer_interruption_is_retained_and_cannot_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "task154-user-namespace-first"
            manifest, _, _ = data(output)
            manifest.update(serviceCommandTemplate=["sealed"], sandboxCommand=[])
            fake = SimpleNamespace(manager_state=Mock(return_value=absent()), command_env=lambda uid: {},
                service_command=Mock(return_value=["sealed"]), sandbox_command=Mock(return_value=[]),
                capture=Mock(side_effect=KeyboardInterrupt))
            with patch.object(probe, "load_manifest", return_value=manifest):
                self.assertEqual(probe.run_first(manifest, root / "manifest", HASH, fake), 1)
            result = json.loads((output / "assessment.json").read_text())
            self.assertEqual(result["status"], "UNAVAILABLE")
            self.assertFalse(result["executorQualified"])
            self.assertEqual(json.loads((output / "launch-error.json").read_text())["failure"], "KeyboardInterrupt")

    def test_19_complete_consistent_acquisition_admits_only_one_mock_sandbox(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            manifest, expected, row = self.setup_service(output)
            fd = os.open(output, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            held = FakeHeld(row, fd)
            fake = SimpleNamespace(NAMESPACES=support.NAMESPACES, sandbox_command=Mock(return_value=["invented-sandbox"]),
                capture=Mock(return_value={"failure": None, "exitCode": 0, "stdout": "invented payload"}))
            def collect(_manifest, binding, _support, _held, phase):
                current = copy.deepcopy(row)
                current["window"] = {"clockId": binding["clockId"], "fromNs": str(probe.time.monotonic_ns()),
                                     "toNs": str(probe.time.monotonic_ns())}
                probe.save(output, phase, current)
                return current
            try:
                with patch.dict(os.environ, {"INVOCATION_ID": INVOCATION}), patch.object(probe, "HeldDirectories", return_value=held), patch.object(probe, "collect_observation", side_effect=collect), patch.object(probe, "expected_subject", return_value=expected):
                    self.assertEqual(probe.service(manifest, HASH, fake, validator), 0)
                self.assertTrue(held.closed)
                self.assertEqual(fake.capture.call_count, 1)
                self.assertFalse(json.loads((output / "ownership.json").read_text())["executorQualified"])
                self.assertTrue(json.loads((output / "ownership-assessment.json").read_text())["offlineOnly"])
            finally:
                os.close(fd)

    def test_20_timeout_and_forced_cleanup_cannot_pass(self):
        for timeout, forced in [(True, False), (False, True)]:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                output = root / "task154-user-namespace-first"
                manifest, _, _ = data(output)
                manifest.update(serviceCommandTemplate=["sealed"], sandboxCommand=[])
                owner = {"manifestSha256": HASH, "unit": UNIT, "invocationId": INVOCATION,
                         "group": "/sys/fs/cgroup" + GROUP}
                final = {"Id": UNIT, "LoadState": "loaded", "InvocationID": INVOCATION, "ControlGroup": GROUP,
                         "ActiveState": "active" if forced else "inactive", "MainPID": "123" if forced else "0"}
                command_result = {"failure": None, "exitCode": 0}
                states = [absent(), (command_result, final)]
                if forced:
                    states.append((command_result, {**final, "ActiveState": "inactive", "MainPID": "0"}))
                def capture(command, **_):
                    if command == ["sealed"]:
                        probe.save(output, "service-entry", {"invocationId": INVOCATION})
                        probe.save(output, "ownership-receipt", {"invented": True})
                        probe.save(output, "ownership", {**owner, "receiptSha256": probe.digest(output / "ownership-receipt.json")})
                        probe.save(output, "sandbox", {"invented": True})
                    return {"failure": "TIMEOUT" if timeout else None, "exitCode": -9 if timeout else 0}
                fake = SimpleNamespace(manager_state=Mock(side_effect=states), command_env=lambda uid: {},
                    service_command=Mock(return_value=["sealed"]), sandbox_command=Mock(return_value=[]),
                    capture=Mock(side_effect=capture), assess_payload=Mock(return_value={"status": "PASS", "reasons": []}))
                with patch.object(probe, "load_manifest", return_value=manifest), patch.object(probe, "terminal_group", return_value={"empty": True}):
                    self.assertEqual(probe.run_first(manifest, root / "manifest", HASH, fake), 1)
                assessment = json.loads((output / "assessment.json").read_text())
                self.assertEqual(assessment["status"], "FAIL" if forced else "UNAVAILABLE")
                self.assertEqual(assessment["forcedCleanup"], forced)
                self.assertFalse(assessment["executorQualified"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
