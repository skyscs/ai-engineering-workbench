"""Capability admission regressions without real privilege or clone3 operations."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

HERE = Path(__file__).parent
ROOT = HERE.parent.parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


probe = load(HERE / "probe.py", "capability_probe")
acquisition = load(HERE.parent / "loredock-user-namespace-prerequisite/probe.py", "acquisition")
protocol = load(HERE.parent / "loredock-direct-birth-prerequisite/protocol.py", "protocol")
support = load(HERE.parent / "loredock-namespace-prerequisite/probe.py", "support")
ARCHIVE = ROOT / "docs/fixtures/loredock-empty-controller-prerequisite/first.tar.gz"


class CapabilityTests(unittest.TestCase):
    def test_native_reduction_and_creation_calls_are_intercepted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for source, output, flags in (("native.c", "native-unexecuted", []), ("test_native.c", "native-test",
                    ["-Wl,--wrap=syscall,--wrap=fstatfs,--wrap=waitpid,--wrap=prctl"])):
                sources = [str(HERE / source)]
                if source == "test_native.c":
                    sources.append(str(HERE / "test_native_hooks.c"))
                command = ["/usr/bin/cc", *probe.BUILD_FLAGS, *flags, *sources, "-o", str(root / output)]
                result = subprocess.run(command, capture_output=True, text=True, timeout=20, check=False)
                self.assertEqual(result.returncode, 0, result.stderr)
            result = subprocess.run([str(root / "native-test"), directory], capture_output=True, text=True,
                                    timeout=5, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("Capability boundary cases passed: 26", result.stdout)
            self.assertIn("capability, prctl, clone3 and waitpid calls were intercepted", result.stdout)
            print(result.stdout, end="")

    def test_original_retained_capability_failure_still_fails_the_guard(self):
        with tarfile.open(ARCHIVE) as archive:
            def record(name):
                return json.load(archive.extractfile("first/" + name + ".json"))
            assessment = protocol.assess_native(record("native-capture"), record("expected-birth"),
                record("native-birth"), record("pre-exec-observation"), record("ownership"), support)
            self.assertEqual(assessment["status"], "FAIL")
            self.assertIn("KERNEL_SECURITY_VIOLATION:CapInh", assessment["reasons"])
            self.assertIn("FORCED_NATIVE_CLEANUP", assessment["reasons"])
            self.assertFalse(assessment["directBirthEstablished"] or assessment["executorQualified"])

    def test_reused_admission_capture_protocol_and_first_evidence_are_exact(self):
        paths = {"leaf": "loredock-empty-controller-prerequisite/leaf.py",
                 "capture": "loredock-direct-birth-prerequisite/capture.py",
                 "protocol": "loredock-direct-birth-prerequisite/protocol.py"}
        for name, path in paths.items():
            self.assertEqual(acquisition.digest(HERE.parent / path), probe.SHARED[name])
        self.assertEqual(hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
                         "9e176fe67dc3a280db0cf9f49e5944a5c1a05ff260391f4e473d0dd61c2b67a1")

    def test_previous_manifest_cannot_be_reused_by_the_new_entry(self):
        with tarfile.open(ARCHIVE) as archive:
            raw = archive.extractfile("inputs/manifest.json").read()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "Unsupported manifest"):
                probe.load_manifest(path, hashlib.sha256(raw).hexdigest(), acquisition)


if __name__ == "__main__":
    unittest.main(verbosity=2)
