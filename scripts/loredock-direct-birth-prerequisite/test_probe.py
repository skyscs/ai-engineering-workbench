"""Offline boundary checks. No real clone3, systemd, sandbox or cgroup writes."""
import copy
import hashlib
import importlib.util
import json
import os
import shutil
from pathlib import Path
import subprocess
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


probe = load(HERE / "probe.py", "probe")
protocol = load(HERE / "protocol.py", "protocol")
capture = load(HERE / "capture.py", "capture")
leaf_module = load(HERE / "leaf.py", "leaf")
acquisition = load(HERE.parent / "loredock-user-namespace-prerequisite/probe.py", "acquisition")
fixtures = load(HERE.parent / "loredock-namespace-prerequisite/test_probe.py", "fixtures")
support = fixtures.probe
RUN = "11111111-1111-4111-8111-111111111111"
UNIT = "loredock-task155-" + RUN + ".service"
HASH = "a" * 64


def fixture():
    owner, payload = fixtures.fixture()
    expected = {"uid": 1000, "gid": 1000, "placement": "/owned/run/probe", "device": "30", "inode": "123"}
    birth = {"schemaVersion": protocol.SCHEMA, "phase": "birth", "mechanism": "clone3", "flags": protocol.FLAGS,
             "pid": "321", "startTimeTicks": "456", **expected, "fromNs": "100", "observedNs": "200"}
    end = {"schemaVersion": protocol.SCHEMA, "phase": "exit", "pid": "321", "waited": True, "exitCode": 0,
           "signal": 0, "pidfdReady": True, "targetStable": True, "forcedKill": False, "collectorError": 0, "toNs": "400"}
    raw_stat = "321 (nested (process)) S " + "0 " * 18 + "456 0\n"
    raw_status = "Uid:\t1000\t1000\t1000\t1000\nGid:\t1000\t1000\t1000\t1000\nNoNewPrivs:\t1\n"
    raw_status += "".join(name + ":\t0000000000000000\n" for name in ("CapInh", "CapPrm", "CapEff", "CapAmb"))
    independent = {"birth": birth, "validated": True, "retainedBeforeAck": True, "processStatRaw": raw_stat,
                   "placementRaw": "0::/owned/run/probe\n", "statusRaw": raw_status, "targetProcsRaw": "321\n",
                   "fromNs": "210", "toNs": "300"}
    independent["targetIdentity"] = {key: expected[key] for key in ("device", "inode", "uid", "gid")}
    result = {"stdout": "\n".join(json.dumps(row) for row in (birth, payload, end)) + "\n",
              "failure": None, "exitCode": 0, "acknowledged": True, "startedAtNs": "90", "endedAtNs": "500"}
    return result, expected, birth, independent, owner


def assess(data):
    return protocol.assess_native(*data, support)


class ProtocolTests(unittest.TestCase):
    def test_positive_supplied_records_do_not_grant_live_authority(self):
        row = assess(fixture())
        self.assertEqual(row["status"], "PASS")
        self.assertTrue(row["offlineOnly"])
        for name in ("directBirthEstablished", "executorQualified", "resourceQualification"):
            self.assertFalse(row[name])

    def test_duplicate_malformed_and_oversized_json(self):
        for raw in ('{"a":1,"a":2}', '{"a":NaN}', '[]', "{" + "x" * 4096, "{"):
            with self.subTest(raw=raw[:20]), self.assertRaises(ValueError):
                protocol.decode_line(raw)

    def test_birth_binding_numbers_identity_and_clock(self):
        result, expected, birth, *_ = fixture()
        for key, value in (("pid", "0"), ("pid", "2147483648"), ("startTimeTicks", "01"),
                           ("inode", "124"), ("device", "18446744073709551616"), ("uid", True),
                           ("placement", "/terminal"), ("fromNs", "201"), ("observedNs", "501"),
                           ("flags", "0"), ("mechanism", "fork")):
            with self.subTest(key=key, value=value):
                self.assertFalse(protocol.valid_birth({**birth, key: value}, expected, 90, 500))

    def test_missing_duplicate_and_out_of_order_records(self):
        data = fixture()
        lines = data[0]["stdout"].splitlines()
        for rows in (lines[1:], lines[:-1], lines + [lines[0]], [lines[1], lines[0], lines[2]], []):
            changed = copy.deepcopy(data)
            changed[0]["stdout"] = "\n".join(rows) + "\n"
            self.assertEqual(assess(changed)["status"], "UNAVAILABLE")

    def test_exit_must_confirm_same_child_normal_wait_and_target(self):
        for key, value in (("pid", "322"), ("waited", False), ("exitCode", 125), ("signal", 9),
                           ("pidfdReady", False), ("targetStable", False), ("collectorError", 5), ("toNs", "199")):
            data = fixture()
            lines = data[0]["stdout"].splitlines()
            end = json.loads(lines[-1])
            end[key] = value
            data[0]["stdout"] = "\n".join(lines[:-1] + [json.dumps(end)]) + "\n"
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_forced_cleanup_survives_missing_payload(self):
        data = fixture()
        lines = data[0]["stdout"].splitlines()
        end = json.loads(lines[-1])
        end["forcedKill"] = True
        data[0]["stdout"] = lines[0] + "\n" + json.dumps(end) + "\n"
        self.assertEqual(assess(data)["status"], "FAIL")

    def test_descriptor_leak_survives_missing_exit(self):
        data = fixture()
        lines = data[0]["stdout"].splitlines()
        payload = json.loads(lines[1])
        payload["descriptors"]["3"] = "/sys/fs/cgroup"
        data[0]["stdout"] = lines[0] + "\n" + json.dumps(payload) + "\n"
        self.assertEqual(assess(data)["status"], "FAIL")

    def test_independent_pid_start_placement_and_membership(self):
        for key, value in (("processStatRaw", "321 bad"), ("placementRaw", "0::/other\n"),
                           ("targetProcsRaw", "321\n322\n"), ("fromNs", "199"), ("toNs", "209")):
            data = fixture()
            data[3][key] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_known_security_failure_survives_later_missing_reads(self):
        data = fixture()
        data[3]["statusRaw"] = data[3]["statusRaw"].replace("NoNewPrivs:\t1", "NoNewPrivs:\t0")
        data[3].pop("targetProcsRaw")
        first = data[0]["stdout"].splitlines()[0] + "\n"
        for raw in (first, "", "truncated", "x" * 65537):
            data[0]["stdout"] = raw
            self.assertEqual(assess(data)["status"], "FAIL")

    def test_missing_ack_and_unretained_birth_cannot_pass(self):
        for target, field, value in ((0, "acknowledged", False), (0, "failure", "TIMEOUT"),
                                     (3, "validated", False), (3, "retainedBeforeAck", False)):
            data = fixture()
            data[target][field] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_independent_target_and_final_window_must_match(self):
        for key, value in (("targetIdentity", {}), ("toNs", "501")):
            data = fixture()
            data[3][key] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")


class CaptureTests(unittest.TestCase):
    def run_child(self, code, callback=lambda *_: None, timeout=2):
        created = []
        original = capture.subprocess.Popen
        def spawn(*args, **kwargs):
            process = original(*args, **kwargs)
            created.append(process)
            return process
        with tempfile.TemporaryDirectory() as directory:
            fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            try:
                with patch.object(capture.subprocess, "Popen", side_effect=spawn):
                    result = capture.capture_native([sys.executable, "-I", "-S", "-c", code], fd, callback,
                                                    timeout=timeout, env={})
            finally:
                os.close(fd)
        self.assertEqual(len(created), 1)
        self.assertIsInstance(created[0].returncode, int)
        return result

    def test_permit_follows_durable_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.json"
            def publish(line, start, end):
                self.assertEqual(line, '{"birth":true}')
                self.assertLessEqual(start, end)
                acquisition.retain(receipt, {"retained": True})
            code = "import os,json; os.write(1,b'{\"birth\":true}\\n'); assert os.read(0,1)==b'A'; "
            code += "assert json.load(open(" + repr(str(receipt)) + "))['retained']; os.write(1,b'after\\n')"
            row = self.run_child(code, publish)
        self.assertTrue(row["acknowledged"])
        self.assertIsNone(row["failure"])
        self.assertEqual(row["exitCode"], 0)
        self.assertTrue(row["stdout"].endswith("after\n"))

    def test_callback_failure_closes_permit_and_preserves_birth(self):
        def reject(*_):
            raise ValueError("Invented failed durable write")
        row = self.run_child("import os; os.write(1,b'birth\\n'); assert os.read(0,1)==b''", reject)
        self.assertFalse(row["acknowledged"])
        self.assertEqual(row["failure"], "BIRTH_NOT_ACKNOWLEDGED:ValueError")
        self.assertEqual(row["stdout"], "birth\n")
        self.assertEqual(row["exitCode"], 0)

    def test_collector_interrupt_reaps_child(self):
        def interrupt(*_):
            raise KeyboardInterrupt()
        row = self.run_child("import os,time; os.write(1,b'birth\\n'); time.sleep(5)", interrupt)
        self.assertEqual(row["failure"], "COLLECTOR_INTERRUPTED:KeyboardInterrupt")
        self.assertFalse(row["acknowledged"])

    def test_oversized_birth_cannot_receive_permit(self):
        callback = Mock(side_effect=AssertionError("Must not acknowledge"))
        row = self.run_child("import os; os.write(1,b'x'*4097+b'\\n'); assert os.read(0,1)==b''", callback)
        self.assertEqual(row["failure"], "BIRTH_RECORD_BOUND")
        callback.assert_not_called()

    def test_timeout_preserves_stderr_and_reaps(self):
        row = self.run_child("import os,time; os.write(2,b'diagnostic'); time.sleep(5)", timeout=0.1)
        self.assertEqual(row["failure"], "TIMEOUT")
        self.assertEqual(row["stderr"], "diagnostic")
        self.assertFalse(row["acknowledged"])

    def test_stream_bound(self):
        row = self.run_child("import os; os.write(2,b'x'*1000000)")
        self.assertEqual(row["failure"], "OUTPUT_BOUND")
        self.assertEqual(len(row["stderr"]), 65536)

    def test_closed_streams_wait_for_actual_exit(self):
        row = self.run_child("import os,time; os.close(1); os.close(2); time.sleep(0.08)")
        self.assertEqual(row["exitCode"], 0)
        self.assertIsNone(row["failure"])
        self.assertFalse(row["acknowledged"])


class IntegrationTests(unittest.TestCase):
    def test_native_harness_intercepts_syscall_and_wait(self):
        with tempfile.TemporaryDirectory() as directory:
            binary = Path(directory) / "native-test"
            production = subprocess.run(["/usr/bin/cc", *probe.BUILD_FLAGS, str(HERE / "native.c"),
                                         "-o", str(Path(directory) / "native-unexecuted")],
                                        capture_output=True, text=True, timeout=20, check=False)
            self.assertEqual(production.returncode, 0, production.stderr)
            command = ["/usr/bin/cc", *probe.BUILD_FLAGS, "-Wl,--wrap=syscall,--wrap=fstatfs,--wrap=waitpid",
                       str(HERE / "test_native.c"), "-o", str(binary)]
            built = subprocess.run(command, capture_output=True, text=True, timeout=20, check=False)
            self.assertEqual(built.returncode, 0, built.stderr)
            ran = subprocess.run([str(binary), directory], capture_output=True, text=True, timeout=5, check=False)
            self.assertEqual(ran.returncode, 0, ran.stderr)
            self.assertIn("all clone3 and waitpid calls were intercepted", ran.stdout)

    def test_accepted_dependency_bytes_are_unchanged(self):
        self.assertEqual(acquisition.digest(HERE.parent / "loredock-user-namespace-prerequisite/probe.py"), probe.ACQUISITION_SHA256)
        for name, path in (("support", "loredock-namespace-prerequisite/probe.py"),
                           ("validator", "loredock-user-service-ownership/assess.py"),
                           ("payload", "loredock-namespace-prerequisite/payload.py")):
            self.assertEqual(acquisition.digest(HERE.parent / path), acquisition.DEPENDENCIES[name])

    def test_bad_manifest_hash_cannot_load_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text("{}")
            with self.assertRaisesRegex(ValueError, "digest"):
                probe.load_manifest(path, HASH, acquisition)

    def test_external_claim_prevents_another_request(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "first"
            acquisition.retain(str(output) + ".claim", {})
            fake = Mock()
            with self.assertRaises(FileExistsError):
                probe.run_first({"output": str(output), "unit": UNIT}, "manifest", HASH, acquisition, fake)
            fake.manager_state.assert_not_called()
            self.assertFalse(output.exists())

    def test_internal_entry_prevents_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "first"
            output.mkdir()
            manifest = {"output": str(output), "unit": UNIT}
            acquisition.retain(str(output) + ".claim", {"manifestSha256": HASH, "unit": UNIT})
            fake = Mock()
            self.assertEqual(probe.service(manifest, HASH, acquisition, fake, fake, fake, fake, fake), 1)
            with self.assertRaises(FileExistsError):
                probe.service(manifest, HASH, acquisition, fake, fake, fake, fake, fake)
            fake.capture_native.assert_not_called()

    def test_terminal_requires_empty_group_not_just_child_exit(self):
        self.assertEqual(probe.terminal_leaf({"cgroup.procs": "", "cgroup.events": "populated 0\nfrozen 0\n"})["status"], "PASS")
        self.assertEqual(probe.terminal_leaf({"cgroup.procs": "", "cgroup.events": "populated 1\nfrozen 0\n"})["status"], "FAIL")
        self.assertEqual(probe.terminal_leaf({})["status"], "UNAVAILABLE")

    def test_pre_exec_retains_records_before_return(self):
        _, expected, birth, independent, _ = fixture()
        with tempfile.TemporaryDirectory() as directory:
            fake_leaf = SimpleNamespace(recheck=Mock(), fds=[17], read=Mock(return_value="321\n"),
                                        snapshot=Mock(return_value={key: expected[key] for key in ("device", "inode", "uid", "gid")}))
            inputs = {"/proc/321/" + path: independent[key].encode()
                      for path, key in (("stat", "processStatRaw"), ("cgroup", "placementRaw"), ("status", "statusRaw"))}
            with patch.object(acquisition, "read_bounded", side_effect=lambda path, *_: inputs[path]):
                probe.pre_exec(json.dumps(birth), 90, 500, expected, acquisition, protocol, fake_leaf, directory)
            row = json.loads((Path(directory) / "pre-exec-observation.json").read_text())
            self.assertTrue(row["validated"] and row["retainedBeforeAck"])
            self.assertTrue((Path(directory) / "native-birth.json").exists())
            self.assertEqual(fake_leaf.recheck.call_count, 2)

    def test_pre_exec_late_failure_preserves_known_violation(self):
        _, expected, birth, independent, _ = fixture()
        independent["statusRaw"] = independent["statusRaw"].replace("NoNewPrivs:\t1", "NoNewPrivs:\t0")
        with tempfile.TemporaryDirectory() as directory:
            fake_leaf = SimpleNamespace(recheck=Mock(), fds=[17], read=Mock(side_effect=OSError("Invented late failure")))
            inputs = {"/proc/321/" + path: independent[key].encode()
                      for path, key in (("stat", "processStatRaw"), ("cgroup", "placementRaw"), ("status", "statusRaw"))}
            with patch.object(acquisition, "read_bounded", side_effect=lambda path, *_: inputs[path]):
                with self.assertRaises(OSError):
                    probe.pre_exec(json.dumps(birth), 90, 500, expected, acquisition, protocol, fake_leaf, directory)
            self.assertEqual(json.loads((Path(directory) / "pre-exec-assessment.json").read_text())["status"], "FAIL")
            self.assertFalse(json.loads((Path(directory) / "pre-exec-observation.json").read_text())["validated"])

    def test_replaced_leaf_is_rejected_using_held_and_named_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "run").mkdir()
            unit_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            run_fd = os.open(root / "run", os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            held = SimpleNamespace(snapshot=Mock(), fds=[unit_fd] * 6)
            leaf = leaf_module.OwnedLeaf(acquisition, held, root, os.getuid(), os.getgid())
            try:
                leaf.fds.append(run_fd)
                leaf.identities.append(leaf.snapshot(run_fd))
                leaf.recheck()
                (root / "run").rename(root / "old")
                (root / "run").mkdir()
                with self.assertRaisesRegex(ValueError, "changed"):
                    leaf.recheck()
            finally:
                leaf.close()
                os.close(unit_fd)

    def test_accounting_writes_only_held_owned_boundary(self):
        before = {"cgroup.type": "domain\n", "cgroup.procs": "", "cgroup.controllers": "memory pids\n",
                  "cgroup.subtree_control": "pids\n"}
        after = {**before, "cgroup.subtree_control": "memory pids\n"}
        leaf = leaf_module.OwnedLeaf(acquisition, Mock(), "unused", 1000, 1000)
        with patch.object(leaf, "observe", side_effect=[before, after]), patch.object(leaf, "recheck") as check:
            with patch.object(os, "open", return_value=42) as opened, patch.object(os, "write", return_value=7) as write, patch.object(os, "close") as close:
                leaf.enable_memory(17, "owned")
                opened.assert_called_once_with("cgroup.subtree_control", os.O_WRONLY | os.O_CLOEXEC | os.O_NOFOLLOW, dir_fd=17)
                write.assert_called_once_with(42, b"+memory")
                close.assert_called_once_with(42)
            check.assert_called_once()

    def test_populated_internal_domain_never_enables_accounting(self):
        leaf = leaf_module.OwnedLeaf(acquisition, Mock(), "unused", 1000, 1000)
        row = {"cgroup.type": "domain\n", "cgroup.procs": "123\n", "cgroup.controllers": "memory\n", "cgroup.subtree_control": "\n"}
        with patch.object(leaf, "observe", return_value=row), patch.object(os, "open") as opened:
            with self.assertRaisesRegex(ValueError, "Empty"):
                leaf.enable_memory(17, "owned")
            opened.assert_not_called()

    def test_foreign_invocation_never_authorizes_cleanup(self):
        owner = {"unit": UNIT, "invocationId": "a" * 32, "group": "/sys/fs/cgroup/owned"}
        fields = {"Id": UNIT, "InvocationID": "b" * 32, "ControlGroup": "/owned", "ActiveState": "active"}
        self.assertFalse(acquisition.cleanup_allowed(fields, owner))
        self.assertFalse(acquisition.cleanup_allowed(fields, None))

    def outer(self, directory, native_status="PASS", terminal_status="PASS", foreign=False):
        output = Path(directory) / "first"
        manifest = {"output": str(output), "unit": UNIT, "uid": 1000,
                    "serviceCommandTemplate": ["mock-service", "MANIFEST_SHA256"], "sandboxCommand": ["mock-sandbox"]}
        invocation = "b" * 32
        owner = {"manifestSha256": HASH, "unit": UNIT, "invocationId": invocation,
                 "group": "/sys/fs/cgroup/owned", "device": 30, "inode": 123}
        absent = ({"exitCode": 0, "failure": None}, {"Id": UNIT, "LoadState": "not-found", "ActiveState": "inactive",
                  "MainPID": "0", "InvocationID": "", "ControlGroup": ""})
        final = ({"exitCode": 0, "failure": None}, {"Id": UNIT, "LoadState": "loaded", "ActiveState": "active",
                 "MainPID": "123", "InvocationID": "c" * 32, "ControlGroup": "/foreign"}) if foreign else absent
        def launch(command, **_):
            self.assertEqual(command, ["mock-service", HASH])
            acquisition.save(output, "service-entry", {"invocationId": invocation})
            acquisition.save(output, "ownership-receipt", {"mock": True})
            owner["receiptSha256"] = acquisition.digest(output / "ownership-receipt.json")
            acquisition.save(output, "ownership", owner)
            acquisition.save(output, "native-assessment", {"status": native_status, "reasons": []})
            if terminal_status:
                acquisition.save(output, "target-terminal-assessment", {"status": terminal_status, "reasons": []})
            return {"exitCode": 0, "failure": None}
        fake = SimpleNamespace(manager_state=Mock(side_effect=[absent, final]), command_env=lambda _: {},
            service_command=lambda *_: ["mock-service", HASH], sandbox_command=lambda _: ["mock-sandbox"],
            capture=Mock(side_effect=launch))
        with patch.object(probe, "load_manifest", return_value=manifest), patch.object(acquisition, "terminal_group", return_value={"empty": True, "absent": True}):
            code = probe.run_first(manifest, "mock-manifest", HASH, acquisition, fake)
        self.assertEqual(fake.capture.call_count, 1)
        return code, json.loads((output / "assessment.json").read_text())

    def test_mocked_outer_positive_path_is_only_direct_birth(self):
        with tempfile.TemporaryDirectory() as directory:
            code, row = self.outer(directory)
        self.assertEqual(code, 0)
        self.assertTrue(row["directBirthEstablished"] and row["inputsUnchanged"])
        self.assertFalse(row["executorQualified"] or row["resourceQualification"] or row["applicationExecuted"])

    def test_outer_retains_known_failure_when_terminal_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            code, row = self.outer(directory, native_status="FAIL", terminal_status=None)
        self.assertEqual(code, 1)
        self.assertEqual(row["status"], "FAIL")

    def test_outer_never_stops_a_foreign_service(self):
        with tempfile.TemporaryDirectory() as directory:
            code, row = self.outer(directory, foreign=True)
        self.assertEqual(code, 1)
        self.assertEqual(row["status"], "UNAVAILABLE")
        self.assertFalse(row["forcedCleanup"])

    def test_pinned_manifest_round_trip_and_changed_work_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            originals = {"acquisition": HERE.parent / "loredock-user-namespace-prerequisite/probe.py",
                         "support": HERE.parent / "loredock-namespace-prerequisite/probe.py",
                         "validator": HERE.parent / "loredock-user-service-ownership/assess.py",
                         "payload": HERE.parent / "loredock-namespace-prerequisite/payload.py"}
            files = {}
            for name, filename in probe.LOCAL.items():
                path = root / filename
                if name in ("canary", "native"):
                    path.write_bytes(b"unexecuted test fixture")
                else:
                    shutil.copyfile(originals.get(name, HERE / filename), path)
                files[name] = {"path": str(path), "resolved": str(path.resolve()), "sha256": acquisition.digest(path)}
            for name, filename in probe.FIXED.items():
                path = Path(filename)
                files[name] = {"path": filename, "resolved": str(path.resolve()), "sha256": acquisition.digest(path.resolve())}
            data = {"schemaVersion": "loredock-direct-birth-prerequisite/1", "contractSha256": acquisition.CONTRACT,
                    "runId": RUN, "unit": UNIT, "uid": os.getuid(), "gid": os.getgid(),
                    "output": str(root / "task155-direct-birth-first"), "files": files,
                    "bounds": dict(acquisition.BOUNDS, clone3Attempts=1, nativeWallSeconds=4, nativeCaptureSeconds=5),
                    "buildCommand": ["/usr/bin/cc", *probe.BUILD_FLAGS, str(root / "native.c"), "-o", str(root / "native")]}
            path = root / "manifest.json"
            def write():
                raw = acquisition.encode(data).encode()
                path.write_bytes(raw)
                return hashlib.sha256(raw).hexdigest()
            self.assertEqual(probe.load_manifest(path, write(), acquisition), data)
            data["bounds"]["clone3Attempts"] = 2
            with self.assertRaisesRegex(ValueError, "bounds"):
                probe.load_manifest(path, write(), acquisition)


if __name__ == "__main__":
    unittest.main(verbosity=2)
