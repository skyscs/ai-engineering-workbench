"""Invented ownership transcripts only; no process, manager, namespace or cgroup calls."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("ownership_assess", Path(__file__).with_name("assess.py"))
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
EXPECTED = {"runId": "11111111-1111-4111-8111-111111111111", "candidateSha256": "a" * 64,
            "unit": "loredock-observer-11111111-1111-4111-8111-111111111111.service", "uid": 1000, "gid": 1000,
            "invocationId": "b" * 32, "bootId": "22222222-2222-4222-8222-222222222222", "clockId": "c" * 64}
ROOT = "/user.slice/user-1000.slice/user@1000.service"


def fixture():
    group = ROOT + "/app.slice/" + EXPECTED["unit"]
    unit = {"Id": EXPECTED["unit"], "LoadState": "loaded", "ActiveState": "active", "SubState": "running",
            "Result": "success", "InvocationID": "b" * 32, "MainPID": "1234", "ControlGroup": group,
            "Delegate": "yes", "DelegateControllers": "memory", "DelegateSubgroup": "attestor",
            "NoNewPrivileges": "yes", "RuntimeMaxUSec": "10s", "TimeoutStartUSec": "5s",
            "TimeoutStopUSec": "2s", "KillMode": "control-group", "Restart": "no"}
    directories = {}
    for name, path, inode, parent in [("parent", ROOT + "/app.slice", "10", "9"),
                                      ("unit", group, "11", "10"), ("attestor", group + "/attestor", "12", "11")]:
        directories[name] = {"path": path, "device": "0:30", "mountId": "48", "inode": inode,
                             "parentInode": parent, "uid": 1000, "gid": 1000, "held": True}
    before = {"window": {"fromNs": "20", "toNs": "30", "clockId": "c" * 64},
              "manager": {"kind": "user", "uid": 1000, "controlGroup": ROOT},
              "unitRaw": "".join(key + "=" + value + "\n" for key, value in unit.items()),
              "placementRaw": "0::" + group + "/attestor\n",
              "process": {"pid": "1234", "startTimeTicks": "5678", "uid": 1000, "gid": 1000,
                          "bootId": EXPECTED["bootId"], "invocationId": "b" * 32},
              "directories": directories, "marker": {"state": "missing", "errno": 61}}
    after = copy.deepcopy(before)
    after["window"] = {"fromNs": "40", "toNs": "50", "clockId": "c" * 64}
    return {"schemaVersion": "loredock-user-service-ownership/1",
            "contractSha256": "759dc70e2d3b86043278b8378148785dd061cf29c06fa6f96c3a5bdf00be8e5b",
            "subject": dict(EXPECTED), "acquisition": {"unitAbsentBeforeRequest": True,
            "exclusiveClaim": True, "attempt": 1, "openedAtNs": "10", "retainedAtNs": "60",
            "recordsRetained": True, "descriptorsHeld": True}, "before": before, "after": after}


def encode(data):
    return json.dumps(data, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def assess(data, expected=EXPECTED):
    return module.assess_ownership_receipt(encode(data), expected)


def replace_property(data, phase, key, value):
    lines = data[phase]["unitRaw"].splitlines()
    data[phase]["unitRaw"] = "".join((key + "=" + value if line.startswith(key + "=") else line) + "\n" for line in lines)


class OwnershipTests(unittest.TestCase):
    def test_u01_absent_marker_does_not_erase_complete_user_manager_records(self):
        result = assess(fixture())
        self.assertEqual(result["status"], "PASS")
        self.assertEqual([row["state"] for row in result["markerDiagnostics"]], ["missing", "missing"])

    def test_u02_positive_marker_does_not_grant_live_authority(self):
        data = fixture()
        for phase in ("before", "after"):
            data[phase]["marker"] = {"state": "value", "value": "1"}
        result = assess(data)
        self.assertEqual(result["status"], "PASS")
        self.assertTrue(result["offlineOnly"])
        for key in ("ownershipEstablished", "executorQualified", "resourceQualification"):
            self.assertFalse(result[key])
        self.assertIn("write-permission", result["notAssessed"])

    def test_u03_marker_and_writable_paths_cannot_replace_manager_delegation(self):
        for key, value in [("Delegate", "no"), ("DelegateControllers", ""), ("DelegateSubgroup", "")]:
            data = fixture()
            data["before"]["marker"] = {"state": "value", "value": "1"}
            replace_property(data, "before", key, value)
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u04_stale_or_mixed_invocations_are_unavailable(self):
        data = fixture()
        replace_property(data, "before", "InvocationID", "d" * 32)
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        data["after"]["process"]["invocationId"] = "d" * 32
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u05_process_pid_must_match_the_live_main_pid(self):
        for pid in ("0", "1235", "2147483648", "18446744073709551616", 1234):
            data = fixture()
            data["before"]["process"]["pid"] = pid
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u06_process_start_identity_cannot_change(self):
        data = fixture()
        data["after"]["process"]["startTimeTicks"] = "5679"
        result = assess(data)
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertIn("OBSERVATION_IDENTITY_CHANGED", [row["code"] for row in result["reasons"]])

    def test_u07_foreign_managers_terminal_scopes_and_placements_are_rejected(self):
        edits = [lambda r: r["manager"].update(kind="system"), lambda r: r["manager"].update(uid=1001),
                 lambda r: r["manager"].update(controlGroup="/user.slice"),
                 lambda r: r.update(placementRaw="0::" + ROOT + "/app.slice/terminal.scope\n"),
                 lambda r: r.update(placementRaw=r["placementRaw"] + "0::/other\n")]
        for edit in edits:
            data = fixture()
            edit(data["before"])
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u08_directory_parent_and_mount_identities_are_stable(self):
        for name, key, value in [("unit", "inode", "99"), ("unit", "parentInode", "9"),
                                 ("attestor", "mountId", "49"), ("parent", "device", "0:31"),
                                 ("attestor", "uid", 1001), ("unit", "path", "/sys/fs/cgroup"),
                                 ("unit", "inode", "10")]:
            data = fixture()
            data["after"]["directories"][name][key] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        for phase in ("before", "after"):
            data[phase]["directories"]["parent"]["parentInode"] = "11"
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u09_duplicate_missing_unknown_and_truncated_properties_are_unavailable(self):
        raw = fixture()["before"]["unitRaw"]
        for value in (raw + "Delegate=yes\n", raw + "NewProperty=yes\n", raw.replace("Delegate=yes\n", ""), raw[:-1], ""):
            data = fixture()
            data["before"]["unitRaw"] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u10_disabled_no_new_privileges_is_a_known_profile_violation(self):
        data = fixture()
        replace_property(data, "before", "NoNewPrivileges", "no")
        self.assertEqual(assess(data)["status"], "FAIL")

    def test_u11_changed_watchdog_cleanup_and_restart_settings_fail(self):
        for key, value in [("RuntimeMaxUSec", "infinity"), ("TimeoutStartUSec", "1min 30s"),
                           ("TimeoutStopUSec", "10s"), ("KillMode", "process"), ("Restart", "always")]:
            data = fixture()
            replace_property(data, "before", key, value)
            self.assertEqual(assess(data)["status"], "FAIL")
        for key, value in [("RuntimeMaxUSec", "unknown"), ("NoNewPrivileges", "garbage"),
                           ("Restart", "maybe"), ("TimeoutStopUSec", "18446744073709551615w"),
                           ("RuntimeMaxUSec", "1s 1s")]:
            data = fixture()
            replace_property(data, "before", key, value)
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        for phase in ("before", "after"):
            replace_property(data, phase, "RuntimeMaxUSec", "10000ms")
        self.assertEqual(assess(data)["status"], "PASS")

    def test_u12_missing_retention_freshness_or_descriptor_continuity_is_unavailable(self):
        for key in ("recordsRetained", "descriptorsHeld", "unitAbsentBeforeRequest", "exclusiveClaim"):
            data = fixture()
            data["acquisition"][key] = False
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        for value in (2, True, "1"):
            data = fixture()
            data["acquisition"]["attempt"] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        data["before"]["directories"]["unit"]["held"] = False
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u13_explicit_marker_conflicts_remain_visible(self):
        data = fixture()
        data["after"]["marker"] = {"state": "value", "value": "0"}
        result = assess(data)
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertEqual(result["markerDiagnostics"][1]["value"], "0")

    def test_u14_known_marker_gaps_are_diagnostic_unexpected_errors_are_unavailable(self):
        for marker in ({"state": "not-read"}, {"state": "missing", "errno": 61},
                       {"state": "unreadable", "errno": 1}, {"state": "unreadable", "errno": 13},
                       {"state": "unreadable", "errno": 95}):
            data = fixture()
            data["before"]["marker"] = marker
            self.assertEqual(assess(data)["status"], "PASS")
        data = fixture()
        del data["before"]["marker"]
        self.assertEqual(assess(data)["status"], "PASS")
        for marker in (None, {"state": "missing", "errno": 5}, {"state": "unreadable", "errno": True}):
            data = fixture()
            data["before"]["marker"] = marker
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u15_reversed_windows_and_mixed_boot_or_clock_cannot_pass(self):
        for key, value in [("fromNs", "31"), ("toNs", "61"), ("clockId", "d" * 64), ("fromNs", "-1")]:
            data = fixture()
            data["before"]["window"][key] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        data["after"]["window"]["fromNs"] = "29"
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        data["before"]["process"]["bootId"] = EXPECTED["runId"]
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u16_terminal_manager_data_is_not_live_acquisition(self):
        data = fixture()
        replace_property(data, "before", "ActiveState", "failed")
        replace_property(data, "before", "SubState", "failed")
        replace_property(data, "before", "MainPID", "0")
        replace_property(data, "before", "ControlGroup", "")
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u17_asserted_qualification_and_unknown_schema_fields_are_rejected(self):
        for field in ("ownershipEstablished", "executorQualified", "resourceQualification"):
            data = fixture()
            data[field] = True
            result = assess(data)
            self.assertEqual(result["status"], "UNAVAILABLE")
            self.assertFalse(result[field])
        data = fixture()
        data["before"]["writePermission"] = True
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u18_malformed_noncanonical_and_oversized_input_never_throws(self):
        serialized = encode(fixture())
        inputs = [None, "", "{", " " * 1048577, "[" * 10000 + "0" + "]" * 10000,
                  "\ud800", "NaN", json.dumps(fixture(), indent=2), serialized.replace('"uid":1000', '"uid":1001,"uid":1000', 1)]
        for value in inputs:
            self.assertEqual(module.assess_ownership_receipt(value, EXPECTED)["status"], "UNAVAILABLE")
        for value in ("18446744073709551616", "00", 20, None):
            data = fixture()
            data["before"]["window"]["fromNs"] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        for part in ("acquisition", "before", "after"):
            data = fixture()
            data[part] = None
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        for part in ("window", "manager", "process", "directories", "unitRaw", "placementRaw"):
            for value in (None, [], {"unexpected": True}):
                data = fixture()
                data["before"][part] = value
                self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        data = fixture()
        data["before"]["unitRaw"] = "x" * 4097
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u19_external_subject_and_contract_binding_are_exact(self):
        for key, value in [("runId", EXPECTED["bootId"]), ("uid", 1001), ("uid", 1000.0),
                           ("candidateSha256", "d" * 64), ("unit", "terminal.scope")]:
            data = fixture()
            data["subject"][key] = value
            self.assertEqual(assess(data)["status"], "UNAVAILABLE")
        for binding in ({}, None, {**EXPECTED, "uid": True}, {**EXPECTED, "unit": "../escape"}):
            self.assertEqual(assess(fixture(), binding)["status"], "UNAVAILABLE")
        data = fixture()
        data["contractSha256"] = "0" * 64
        self.assertEqual(assess(data)["status"], "UNAVAILABLE")

    def test_u20_known_security_violation_survives_separately_missing_evidence(self):
        data = fixture()
        replace_property(data, "before", "NoNewPrivileges", "no")
        data["after"] = None
        result = assess(data)
        self.assertEqual(result["status"], "FAIL")
        self.assertEqual({row["status"] for row in result["reasons"]}, {"FAIL", "UNAVAILABLE"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
