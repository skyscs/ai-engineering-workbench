"""Retained-byte admission regressions using ordinary temporary directories only."""
from contextlib import ExitStack
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tarfile
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).parent
ROOT = HERE.parent.parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


probe = load(HERE / "probe.py", "corrected_probe")
leaf_module = load(HERE / "leaf.py", "corrected_leaf")
prior = load(HERE.parent / "loredock-direct-birth-prerequisite/test_probe.py", "prior_fixtures")
acquisition, protocol, support = prior.acquisition, prior.protocol, prior.support
UNIT = "loredock-task156-11111111-1111-4111-8111-111111111111.service"
HASH = "a" * 64
FILES = ("cgroup.type", "cgroup.controllers", "cgroup.subtree_control", "cgroup.procs", "cgroup.events")
ARCHIVE = ROOT / "docs/fixtures/loredock-direct-birth-prerequisite/first.tar.gz"
with tarfile.open(ARCHIVE) as archive:
    RETAINED = {name: json.load(archive.extractfile("first/" + name + ".json"))
                for name in ("owned-unit-before", "owned-run-before", "owned-target-initial")}


class KernelDouble:
    """Translate only owned temporary-file writes into supplied kernel text."""
    def __init__(self, *, target=None, unit=None, fail=None, changed_available=False):
        self.target, self.unit = target or {}, unit or {}
        self.fail, self.changed_available = fail, changed_available
        self.opened, self.writes = [], []
        self.original_open, self.original_mkdir, self.original_write = os.open, os.mkdir, os.write

    def populate(self, path, row):
        for name in FILES:
            (path / name).write_bytes(row[name].encode())

    def __enter__(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.root, self.output = self.directory / "unit", self.directory / "output"
        self.root.mkdir()
        self.output.mkdir()
        self.populate(self.root, {**RETAINED["owned-unit-before"], **self.unit})
        self.unit_fd = self.original_open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        self.held = SimpleNamespace(fds=[self.unit_fd] * 7, snapshot=Mock())
        self.stack = ExitStack()
        self.stack.enter_context(patch.object(os, "mkdir", side_effect=self.mkdir))
        self.stack.enter_context(patch.object(os, "open", side_effect=self.open))
        self.stack.enter_context(patch.object(os, "write", side_effect=self.write))
        return self

    def __exit__(self, *_):
        self.stack.close()
        os.close(self.unit_fd)
        self.temporary.cleanup()

    def mkdir(self, name, mode=0o777, *, dir_fd=None):
        if dir_fd is None:
            return self.original_mkdir(name, mode)
        parent = Path(os.readlink("/proc/self/fd/" + str(dir_fd)))
        assert (name, parent) in (("run", self.root), ("probe", self.root / "run"))
        if self.fail == ("mkdir", name):
            raise OSError("Invented mkdir failure")
        self.original_mkdir(name, mode, dir_fd=dir_fd)
        source = RETAINED["owned-run-before"] if name == "run" else {**RETAINED["owned-target-initial"], **self.target}
        self.populate(parent / name, source)

    def open(self, name, flags, mode=0o777, *, dir_fd=None):
        if self.fail == ("open", name) and name in ("run", "probe"):
            raise OSError("Invented open failure")
        fd = self.original_open(name, flags, mode, dir_fd=dir_fd)
        if name in ("run", "probe"):
            assert flags & os.O_NOFOLLOW and flags & os.O_CLOEXEC
            self.opened.append(fd)
        return fd

    def write(self, fd, data):
        path = Path(os.readlink("/proc/self/fd/" + str(fd)))
        assert path in (self.root / "cgroup.subtree_control", self.root / "run/cgroup.subtree_control")
        assert data == b"+memory"
        self.writes.append((str(path.relative_to(self.root)), data))
        available = (path.parent / "cgroup.controllers").read_text().split()
        enabled = set(path.read_text().split()) | {"memory"}
        raw = " ".join(name for name in available if name in enabled) + "\n"
        os.ftruncate(fd, 0)
        assert self.original_write(fd, raw.encode()) == len(raw)
        if self.changed_available:
            (path.parent / "cgroup.controllers").write_text("pids\n")
        return len(data)

    def leaf(self):
        return leaf_module.OwnedLeaf(acquisition, self.held, self.output, os.getuid(), os.getgid())

    def assert_closed(self, test):
        for fd in self.opened:
            with test.assertRaises(OSError):
                os.fstat(fd)


class ControllerTests(unittest.TestCase):
    def test_retained_zero_bytes_are_the_empty_form(self):
        for row in RETAINED.values():
            self.assertEqual(row["cgroup.subtree_control"], "")
            self.assertEqual(leaf_module.controllers(row["cgroup.subtree_control"]), ())
        self.assertEqual(leaf_module.controllers("memory pids\n"), ("memory", "pids"))

    def test_malformed_whitespace_and_encoding_are_rejected(self):
        for raw in ("\n", " ", "memory", " memory\n", "memory \n", "memory  pids\n",
                    "memory\tpids\n", "memory\npids\n", "memory\r\n", "memory\x00\n", "MEMORY\n", [], None):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                leaf_module.controllers(raw)

    def test_duplicates_and_oversized_lists_are_rejected(self):
        for raw in ("memory memory\n", "memory pids memory\n", "x" * 4096 + "\n"):
            with self.assertRaises(ValueError):
                leaf_module.controllers(raw)

    def test_complete_leaf_creation_uses_actual_retained_empty_reads(self):
        with KernelDouble() as kernel:
            with kernel.leaf() as leaf:
                row = leaf.create()
                self.assertEqual(row["cgroup.subtree_control"], "")
                self.assertEqual(row["cgroup.procs"], "")
                self.assertEqual(row["cgroup.events"], "populated 0\nfrozen 0\n")
                self.assertEqual([name for name, _ in kernel.writes], ["cgroup.subtree_control", "run/cgroup.subtree_control"])
                retained = json.loads((kernel.output / "owned-target-initial.json").read_text())
                self.assertEqual(retained, row)
            kernel.assert_closed(self)

    def test_existing_enabled_controller_is_preserved(self):
        with KernelDouble(unit={"cgroup.subtree_control": "pids\n"}) as kernel:
            with kernel.leaf() as leaf:
                leaf.create()
                self.assertEqual((kernel.root / "cgroup.subtree_control").read_text(), "memory pids\n")
            kernel.assert_closed(self)

    def test_unknown_enabled_controller_prevents_mutation(self):
        with KernelDouble(unit={"cgroup.subtree_control": "unknown\n"}) as kernel:
            with kernel.leaf() as leaf, self.assertRaises(ValueError):
                leaf.create()
            self.assertEqual(kernel.writes, [])
            self.assertEqual(kernel.opened, [])

    def test_missing_memory_prevents_mutation(self):
        with KernelDouble(unit={"cgroup.controllers": "pids\n"}) as kernel:
            with kernel.leaf() as leaf, self.assertRaises(ValueError):
                leaf.create()
            self.assertEqual(kernel.writes, [])

    def test_available_controller_change_after_enable_stops_creation(self):
        with KernelDouble(changed_available=True) as kernel:
            with kernel.leaf() as leaf, self.assertRaisesRegex(ValueError, "not observed"):
                leaf.create()
            self.assertEqual(kernel.opened, [])
            self.assertEqual(len(kernel.writes), 1)

    def test_enabled_target_controllers_prevent_admission(self):
        for raw in ("memory\n", "unknown\n", "\n"):
            with KernelDouble(target={"cgroup.subtree_control": raw}) as kernel:
                with kernel.leaf() as leaf, self.assertRaises(ValueError):
                    leaf.create()
                kernel.assert_closed(self)

    def test_populated_invalid_or_unaccounted_target_prevents_admission(self):
        for change in ({"cgroup.procs": "321\n"}, {"cgroup.events": "populated 1\nfrozen 0\n"},
                       {"cgroup.type": "domain invalid\n"}, {"cgroup.controllers": ""}):
            with KernelDouble(target=change) as kernel:
                with kernel.leaf() as leaf, self.assertRaises(ValueError):
                    leaf.create()
                kernel.assert_closed(self)

    def test_mkdir_and_open_failures_close_prior_descriptors(self):
        for fault in (("mkdir", "run"), ("open", "run"), ("mkdir", "probe"), ("open", "probe")):
            with KernelDouble(fail=fault) as kernel:
                with kernel.leaf() as leaf, self.assertRaises(OSError):
                    leaf.create()
                kernel.assert_closed(self)
                self.assertEqual(leaf.fds, [])

    def test_snapshot_failure_closes_newly_opened_descriptor(self):
        with KernelDouble() as kernel:
            with kernel.leaf() as leaf:
                original = leaf.snapshot
                def snapshot(fd):
                    if Path(os.readlink("/proc/self/fd/" + str(fd))).name == "probe":
                        raise OSError("Invented snapshot failure")
                    return original(fd)
                with patch.object(leaf, "snapshot", side_effect=snapshot), self.assertRaises(OSError):
                    leaf.create()
            self.assertEqual(len(kernel.opened), 2)
            kernel.assert_closed(self)

    def test_replaced_target_cannot_be_rechecked(self):
        with KernelDouble() as kernel:
            with kernel.leaf() as leaf:
                leaf.create()
                (kernel.root / "run/probe").rename(kernel.root / "run/old")
                kernel.original_mkdir(kernel.root / "run/probe")
                with self.assertRaisesRegex(ValueError, "changed"):
                    leaf.recheck()
            kernel.assert_closed(self)


class ServiceTests(unittest.TestCase):
    def run_service(self, kernel):
        output = kernel.output
        manifest = {"output": str(output), "unit": UNIT, "uid": os.getuid(), "gid": os.getgid(),
                    "files": {"native": {"path": "/sealed/native"}}}
        acquisition.retain(str(output) + ".claim", {"manifestSha256": HASH, "unit": UNIT})
        initial = {"command": {"exitCode": 0, "failure": None},
                   "properties": {"Id": UNIT, "LoadState": "not-found", "ActiveState": "inactive",
                                  "MainPID": "0", "InvocationID": "", "ControlGroup": ""}}
        acquisition.save(output, "manager-initial", initial)
        _, _, _, _, owner = prior.fixture()
        owner = {**owner, "group": "/sys/fs/cgroup/owned"}
        fake_support = SimpleNamespace(sandbox_command=lambda _: ["/usr/bin/bwrap", "fixed"],
                                       assess_payload=support.assess_payload)
        original_read = acquisition.read_bounded
        proc_inputs = {}
        def read(path, maximum=acquisition.MAX_RECORD, **kwargs):
            if str(path).startswith("/proc/321/"):
                return proc_inputs[str(path)].encode()
            return original_read(path, maximum, **kwargs)
        calls = []
        def native(command, fd, callback, *, timeout, env):
            calls.append(command)
            self.assertEqual(timeout, 5)
            self.assertEqual(env, {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
            self.assertEqual(command[1], str(fd))
            self.assertEqual(command[4:7], ["/owned/run/probe", "/owned/attestor", "--"])
            info = os.fstat(fd)
            result, expected, birth, independent, _ = prior.fixture()
            start = time.monotonic_ns()
            birth.update(uid=os.getuid(), gid=os.getgid(), device=str(info.st_dev), inode=str(info.st_ino),
                         fromNs=str(start), observedNs=str(start + 1))
            for key in ("uid", "gid", "device", "inode"):
                expected[key] = birth[key]
            target = kernel.root / "run/probe"
            (target / "cgroup.procs").write_text("321\n")
            proc_inputs["/proc/321/stat"] = independent["processStatRaw"]
            proc_inputs["/proc/321/cgroup"] = independent["placementRaw"]
            proc_inputs["/proc/321/status"] = independent["statusRaw"].replace("Uid:\t1000\t1000\t1000\t1000", "Uid:\t" + "\t".join([str(os.getuid())] * 4)).replace("Gid:\t1000\t1000\t1000\t1000", "Gid:\t" + "\t".join([str(os.getgid())] * 4))
            callback(json.dumps(birth), start, time.monotonic_ns())
            # Returning from the callback is the permit boundary in the real capture.
            saved = json.loads((output / "pre-exec-observation.json").read_text())
            self.assertTrue(saved["validated"] and saved["retainedBeforeAck"])
            _, payload = prior.fixtures.fixture()
            payload.update(uid=os.getuid(), gid=os.getgid())
            end = json.loads(result["stdout"].splitlines()[-1])
            end["toNs"] = str(time.monotonic_ns())
            (target / "cgroup.procs").write_text("")
            result.update(stdout="\n".join(json.dumps(row) for row in (birth, payload, end)) + "\n",
                          startedAtNs=str(start), endedAtNs=str(time.monotonic_ns()))
            return result
        class HeldContext:
            def __enter__(self):
                return kernel.held
            def __exit__(self, *_):
                pass
        with patch.object(acquisition, "HeldDirectories", return_value=HeldContext()), patch.object(
                probe, "acquire", return_value=owner), patch.object(acquisition, "read_bounded", side_effect=read):
            code = probe.service(manifest, HASH, acquisition, fake_support, Mock(), protocol,
                                 SimpleNamespace(capture_native=native), leaf_module)
        return code, calls, manifest

    def test_complete_mocked_service_reaches_native_once_after_empty_leaf(self):
        with KernelDouble() as kernel:
            code, calls, _ = self.run_service(kernel)
            self.assertEqual(code, 0)
            self.assertEqual(len(calls), 1)
            self.assertEqual(json.loads((kernel.output / "native-assessment.json").read_text())["status"], "PASS")
            self.assertEqual(json.loads((kernel.output / "target-terminal-assessment.json").read_text())["status"], "PASS")
            kernel.assert_closed(self)

    def test_invalid_target_never_reaches_native_capture(self):
        with KernelDouble(target={"cgroup.subtree_control": "memory\n"}) as kernel:
            code, calls, _ = self.run_service(kernel)
            self.assertEqual(code, 1)
            self.assertEqual(calls, [])
            self.assertTrue((kernel.output / "service-error.json").exists())
            kernel.assert_closed(self)

    def test_consumed_internal_entry_and_external_claim_still_block_reuse(self):
        with KernelDouble() as kernel:
            code, _, manifest = self.run_service(kernel)
            self.assertEqual(code, 0)
            fake = Mock()
            with self.assertRaises(FileExistsError):
                probe.service(manifest, HASH, acquisition, fake, fake, fake, fake, fake)
            with self.assertRaises(FileExistsError):
                probe.run_first(manifest, "manifest", HASH, acquisition, fake)
            fake.capture_native.assert_not_called()
            fake.manager_state.assert_not_called()

    def test_shared_native_protocol_capture_and_old_first_stay_exact(self):
        paths = {"nativeSource": "native.c", "capture": "capture.py", "protocol": "protocol.py"}
        for name, filename in paths.items():
            self.assertEqual(acquisition.digest(HERE.parent / "loredock-direct-birth-prerequisite" / filename), probe.SHARED[name])
        self.assertEqual(hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
                         "450fab1265a9447d212cf6eff8f6d2d60c919b118585bf03d409075b4535bfdf")

    def test_known_failure_still_survives_lost_native_output(self):
        data = prior.fixture()
        data[3]["statusRaw"] = data[3]["statusRaw"].replace("NoNewPrivs:\t1", "NoNewPrivs:\t0")
        data[0]["stdout"] = ""
        self.assertEqual(protocol.assess_native(*data, support)["status"], "FAIL")


if __name__ == "__main__":
    unittest.main(verbosity=2)
