"""Offline regressions: these tests never contact systemd or run Bubblewrap."""
import errno
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("namespace_probe", Path(__file__).with_name("probe.py"))
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)
UNIT = "loredock-task152-11111111-1111-4111-8111-111111111111.service"
INVOCATION = "a" * 32


def fixture():
    owner = {"unit": UNIT, "invocationId": INVOCATION,
             "namespaces": {name: f"{name}:[100]" for name in probe.NAMESPACES}}
    row = {"schemaVersion": "loredock-namespace-payload/1", "uid": 1000, "gid": 1000,
           "namespaces": {name: f"{name}:[200]" for name in probe.NAMESPACES},
           "status": {"NoNewPrivs": "1", **{name: "0000000000000000" for name in ("CapInh", "CapPrm", "CapEff", "CapAmb")}},
           "descriptors": {"0": "/dev/null", "1": "pipe:[1]", "2": "pipe:[2]"},
           "hiddenPaths": {name: True for name in ("/home", "/run/user", "/sys/fs/cgroup", "/proc/1/root/home")},
           "readOnlyErrno": errno.EROFS, "nestedUsernsErrno": errno.EPERM,
           "allocationBytes": 1048576, "touchedPages": 256, "environmentKeys": ["PATH", "LANG", "PWD"]}
    return owner, row


def assessment(owner, row):
    return probe.assess_payload({"exitCode": 0, "failure": None, "stdout": json.dumps(row)}, owner, 1000, 1000)


class ProbeTests(unittest.TestCase):
    def test_valid_payload_is_only_a_prerequisite(self):
        self.assertEqual(assessment(*fixture())["status"], "PASS")

    def test_each_namespace_must_differ(self):
        for name in probe.NAMESPACES:
            with self.subTest(name=name):
                owner, row = fixture()
                row["namespaces"][name] = owner["namespaces"][name]
                self.assertEqual(assessment(owner, row)["status"], "FAIL")

    def test_security_boundaries_cannot_be_skipped(self):
        edits = [lambda r: r.update(uid=0), lambda r: r["status"].update(NoNewPrivs="0"),
                 lambda r: r["status"].update(CapEff="0000000000000001"),
                 lambda r: r["descriptors"].update({"3": "/sys/fs/cgroup/cgroup.procs"}),
                 lambda r: r["hiddenPaths"].update({"/home": False}),
                 lambda r: r.update(readOnlyErrno=None), lambda r: r.update(nestedUsernsErrno=None),
                 lambda r: r.update(touchedPages=0), lambda r: r["environmentKeys"].append("UNEXPECTED")]
        for edit in edits:
            owner, row = fixture()
            edit(row)
            self.assertEqual(assessment(owner, row)["status"], "FAIL")

    def test_missing_or_malformed_payload_is_unavailable(self):
        owner, _ = fixture()
        for value in ({}, None, [], {"schemaVersion": "wrong"}):
            self.assertEqual(assessment(owner, value)["status"], "UNAVAILABLE")
        self.assertEqual(probe.assess_payload({"exitCode": 1}, owner, 1000, 1000)["status"], "UNAVAILABLE")

    def test_manifest_digest_precedes_any_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text("{}")
            with self.assertRaisesRegex(ValueError, "digest"):
                probe.load_manifest(path, "0" * 64)

    def test_records_are_exclusive_and_symlinks_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt"
            probe.retain(path, {"first": 1})
            original = path.read_bytes()
            with self.assertRaises(FileExistsError):
                probe.retain(path, {"second": 2})
            self.assertEqual(path.read_bytes(), original)
            link = Path(directory) / "link"
            link.symlink_to(path)
            with self.assertRaises(OSError):
                probe.read_bounded(link)

    def test_input_and_receipt_size_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "large"
            path.write_bytes(b"x" * 33)
            with self.assertRaisesRegex(ValueError, "bound"):
                probe.read_bounded(path, 32)
            self.assertEqual(probe.read_bounded(path, 33), b"x" * 33)
            with self.assertRaisesRegex(ValueError, "bound"):
                probe.retain(Path(directory) / "receipt", "x" * probe.MAX_RECORD)

    def test_claim_blocks_repeated_service_requests(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "task152-namespace-first"
            manifest = {"unit": UNIT, "output": str(output)}
            probe.retain(Path(str(output) + ".claim"), {"first": True})
            with patch.object(probe, "capture", side_effect=AssertionError("Must not execute")):
                with self.assertRaises(FileExistsError):
                    probe.run_first(manifest, Path(directory) / "manifest", "a" * 64)
            self.assertFalse(output.exists())

    def test_capture_bounds_both_streams_and_reaps_child(self):
        result = probe.capture([sys.executable, "-I", "-S", "-c", "import os; os.write(1,b'x'*1000000)"], timeout=2, env={})
        self.assertEqual(result["failure"], "OUTPUT_BOUND")
        self.assertEqual(len(result["stdout"]), probe.MAX_STREAM)
        self.assertIsInstance(result["exitCode"], int)

    def test_capture_timeout_and_stderr_are_retained(self):
        result = probe.capture([sys.executable, "-I", "-S", "-c", "import os,time; os.write(2,b'diagnostic'); time.sleep(5)"], timeout=0.1, env={})
        self.assertEqual(result["failure"], "TIMEOUT")
        self.assertEqual(result["stderr"], "diagnostic")
        self.assertLess(int(result["durationNs"]), 2000000000)
        self.assertIsInstance(result["exitCode"], int)

    def test_closed_streams_do_not_kill_a_normally_exiting_process(self):
        result = probe.capture([sys.executable, "-I", "-S", "-c",
            "import os,time; os.close(1); os.close(2); time.sleep(0.08)"], timeout=2, env={})
        self.assertIsNone(result["failure"])
        self.assertEqual(result["exitCode"], 0)

    def test_internal_service_entry_is_also_exclusive(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "task152-namespace-first"
            output.mkdir()
            manifest = {"unit": UNIT, "output": str(output), "uid": 1000}
            probe.retain(Path(str(output) + ".claim"), {"manifestSha256": "a" * 64, "unit": UNIT})
            with patch.object(probe, "manager_state", return_value=({"failure": "UNAVAILABLE"}, {})) as manager:
                self.assertEqual(probe.service(manifest, "a" * 64), 1)
                with self.assertRaises(FileExistsError):
                    probe.service(manifest, "a" * 64)
                self.assertEqual(manager.call_count, 1)

    def test_capture_interrupt_reaps_the_direct_child(self):
        created = []
        original = probe.subprocess.Popen
        def record(*args, **kwargs):
            process = original(*args, **kwargs)
            created.append(process)
            return process
        with patch.object(probe.subprocess, "Popen", side_effect=record), patch.object(
                probe.selectors.DefaultSelector, "select", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                probe.capture([sys.executable, "-I", "-S", "-c", "import time; time.sleep(5)"], timeout=2, env={})
        self.assertEqual(len(created), 1)
        self.assertIsInstance(created[0].returncode, int)

    def test_terminal_manager_requires_same_invocation_or_explicit_unloaded_unit(self):
        owner, _ = fixture()
        result = {"exitCode": 0, "failure": None}
        fields = {"Id": UNIT, "LoadState": "loaded", "InvocationID": INVOCATION,
                  "ActiveState": "inactive", "MainPID": "0"}
        self.assertTrue(probe.terminal_manager_valid(result, fields, owner))
        self.assertFalse(probe.terminal_manager_valid(result, {**fields, "InvocationID": "b" * 32}, owner))
        self.assertFalse(probe.terminal_manager_valid({**result, "failure": "TIMEOUT"}, fields, owner))
        self.assertFalse(probe.terminal_manager_valid(result, {**fields, "MainPID": "123"}, owner))
        self.assertTrue(probe.terminal_manager_valid(result, {"Id": UNIT, "LoadState": "not-found", "ActiveState": "inactive"}, owner))
        self.assertFalse(probe.terminal_manager_valid(result, {}, owner))

    def test_manager_properties_and_placement_cannot_be_self_selected(self):
        manifest = {"uid": 1000, "unit": UNIT}
        group = "/user.slice/user-1000.slice/user@1000.service/app.slice/" + UNIT
        fields = {"Id": UNIT, "InvocationID": INVOCATION, "ControlGroup": group,
                  "Delegate": "yes", "DelegateControllers": "memory", "DelegateSubgroup": "attestor", "MainPID": "123",
                  "NoNewPrivileges": "yes", "RuntimeMaxUSec": "10s", "TimeoutStartUSec": "5s",
                  "TimeoutStopUSec": "2s", "KillMode": "control-group", "Restart": "no", "ActiveState": "active"}
        self.assertEqual(str(probe.verify_owner(manifest, fields, group + "/attestor", INVOCATION, 123)), "/sys/fs/cgroup" + group)
        for field, value in [("InvocationID", "b" * 32), ("Delegate", "no"), ("DelegateControllers", ""),
                             ("NoNewPrivileges", "no"), ("RuntimeMaxUSec", "infinity"), ("MainPID", "124")]:
            with self.assertRaises(ValueError):
                probe.verify_owner(manifest, {**fields, field: value}, group + "/attestor", INVOCATION, 123)
        with self.assertRaises(ValueError):
            probe.verify_owner(manifest, fields, "/existing-terminal", INVOCATION, 123)

    def test_commands_have_no_optional_namespace_or_privileged_fallback(self):
        manifest = {"unit": UNIT, "uid": 1000, "gid": 1000,
                    "files": {name: {"path": "/input/" + name} for name in ("helper", "payload", "canary", "bwrap")}}
        command = probe.sandbox_command(manifest)
        self.assertNotIn("--unshare-all", command)
        self.assertFalse(any(value.endswith("-try") for value in command))
        for value in ("--clearenv", "--disable-userns", "--die-with-parent", "--new-session", "--cap-drop"):
            self.assertIn(value, command)
        self.assertNotIn("--bind", command)
        service = probe.service_command(manifest, Path("/input/manifest"), "a" * 64)
        self.assertIn("--user", service)
        self.assertIn("--property=Restart=no", service)
        self.assertFalse(any("MemoryMax" in item or "CPUQuota" in item for item in service))


if __name__ == "__main__":
    unittest.main(verbosity=2)
