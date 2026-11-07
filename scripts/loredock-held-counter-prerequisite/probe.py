"""Hold real counters around one separately sealed direct-born synthetic child."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import resource
import sys
import time

ACQUISITION_SHA256 = "b367bc71459ea966413d4955e018f38ecb4c4df6622e804a9cfb54352ac27b70"
SHARED = {"leaf": "01da8fb7401fc9dd5bfc5b9c076116bde09da7f06e07bbb9b2dcb6df2418d851",
          "capture": "99647e9466101cef1abe65d62d2d996d77b17f58251bef0a92cf0d91b2f47a4d",
          "protocol": "b371780718a1133e0dc27d7d98d665c3fb20934dbbf0ea7a2dd35af89dffd2d9",
          "nativeSource": "cceb7d0fb49d5e18373d5511dcae2193b431bc2559721d9388940d45bf6fdc04",
          "counterReader": "efb2849488984f4228a80ecff27018a2e8d711672322f6c00f9317ecde169f07"}
FIXED = {"python": "/usr/bin/python3", "bwrap": "/usr/bin/bwrap", "systemdRun": "/usr/bin/systemd-run",
         "systemctl": "/usr/bin/systemctl", "compiler": "/usr/bin/cc"}
LOCAL = {"helper": "probe.py", "acquisition": "acquisition.py", "support": "support.py",
         "validator": "assess.py", "payload": "payload.py", "canary": "canary", "protocol": "protocol.py",
         "capture": "capture.py", "leaf": "leaf.py", "nativeSource": "native.c", "native": "native",
         "counterReader": "reader.py", "counters": "counters.py"}
BUILD_FLAGS = ["-std=c17", "-O2", "-Wall", "-Wextra", "-Werror", "-fPIE", "-pie",
               "-D_FORTIFY_SOURCE=3", "-fstack-protector-strong", "-Wl,-z,relro,-z,now"]


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def bootstrap(manifest_path, manifest_hash):
    # The only module imported before the complete manifest check is independently pinned.
    path = Path(manifest_path).parent / "acquisition.py"
    with path.open("rb") as stream:
        raw = stream.read(1048577)
    if hashlib.sha256(raw).hexdigest() != ACQUISITION_SHA256:
        raise ValueError("Accepted acquisition source changed")
    acquisition = load_module(path, "accepted_acquisition")
    return acquisition, load_manifest(manifest_path, manifest_hash, acquisition)


def load_manifest(path, expected, acquisition):
    path = Path(path)
    raw = acquisition.read_bounded(path, 65536)
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Manifest digest mismatch")
    data = json.loads(raw)
    if (type(data) is not dict or acquisition.encode(data).encode() != raw
            or data.get("schemaVersion") != "loredock-held-counter-prerequisite/1"
            or data.get("contractSha256") != acquisition.CONTRACT):
        raise ValueError("Unsupported manifest encoding or binding")
    run_id = data.get("runId")
    if not isinstance(run_id, str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", run_id):
        raise ValueError("Invalid run identity")
    if data.get("unit") != "loredock-task159-" + run_id + ".service":
        raise ValueError("Invalid dedicated service")
    if (any(type(data.get(key)) is not int for key in ("uid", "gid"))
            or data["uid"] != os.getuid() or data["gid"] != os.getgid() or min(os.getuid(), os.getgid()) == 0):
        raise ValueError("Non-root identity mismatch")
    output = Path(data["output"])
    if not output.is_absolute() or output.parent.resolve() != output.parent or output.name != "task159-held-counter-first":
        raise ValueError("Invalid first-output destination")
    bounds = dict(acquisition.BOUNDS, clone3Attempts=1, nativeWallSeconds=4, nativeCaptureSeconds=5,
                  counterBatches=2, counterScopes=3, interfacesPerScope=8)
    if data.get("bounds") != bounds or any(type(data["bounds"][key]) is not int for key in bounds):
        raise ValueError("Changed work bounds")
    if set(data.get("files", {})) != set(FIXED) | set(LOCAL):
        raise ValueError("Incomplete pinned inputs")
    for name, row in data["files"].items():
        source = Path(row["path"])
        target = Path(FIXED[name]) if name in FIXED else path.parent / LOCAL[name]
        if not source.is_absolute() or source != target:
            raise ValueError("Unexpected input path")
        resolved = source.resolve(strict=True)
        if str(resolved) != row["resolved"] or acquisition.digest(resolved) != row["sha256"]:
            raise ValueError("Changed pinned input")
        info = resolved.stat()
        if name in FIXED and (info.st_uid != 0 or info.st_mode & 0o6022):
            raise ValueError("Unsafe runtime permissions")
        dependencies = dict(acquisition.DEPENDENCIES, **SHARED, acquisition=ACQUISITION_SHA256)
        if name in dependencies and row["sha256"] != dependencies[name]:
            raise ValueError("Changed accepted dependency")
    if data.get("buildCommand") != ["/usr/bin/cc", *BUILD_FLAGS, data["files"]["nativeSource"]["path"], "-o", data["files"]["native"]["path"]]:
        raise ValueError("Changed native build command")
    return data


def acquire(manifest, manifest_hash, acquisition, support, validator, held, entry):
    output = manifest["output"]
    opened = time.monotonic_ns()
    boot = acquisition.read_bounded("/proc/sys/kernel/random/boot_id", 4096).decode().strip()
    expected = acquisition.expected_subject(manifest, manifest_hash, entry, boot)
    acquisition.save(output, "expected-subject", expected)
    observations, failed = {}, False
    try:
        for phase in ("before", "after"):
            observations[phase] = acquisition.collect_observation(manifest, expected, support, held, phase)
    except (Exception, KeyboardInterrupt) as error:
        failed = True
        acquisition.save(output, "acquisition-error", {"type": type(error).__name__, "message": str(error)[:4096]})
    for phase in ("before", "after"):
        partial = Path(output) / (phase + "-required.json")
        if phase not in observations and partial.exists():
            observations[phase] = json.loads(acquisition.read_bounded(partial))
    receipt = {"schemaVersion": "loredock-user-service-ownership/1", "contractSha256": acquisition.CONTRACT,
               "subject": expected, "acquisition": {"unitAbsentBeforeRequest": True, "exclusiveClaim": True,
               "attempt": 1, "openedAtNs": str(opened), "retainedAtNs": str(time.monotonic_ns()),
               "recordsRetained": True, "descriptorsHeld": True},
               "before": observations.get("before"), "after": observations.get("after")}
    acquisition.save(output, "ownership-receipt", receipt)
    assessed = validator.assess_ownership_receipt(acquisition.encode(receipt), expected)
    acquisition.save(output, "ownership-assessment", assessed)
    if failed or assessed["status"] != "PASS":
        raise ValueError("Service ownership unavailable")
    info = os.fstat(held.fds[5])
    owner = {"manifestSha256": manifest_hash, "unit": manifest["unit"], "invocationId": expected["invocationId"],
             "receiptSha256": acquisition.digest(Path(output) / "ownership-receipt.json"),
             "group": "/sys/fs/cgroup" + observations["before"]["directories"]["unit"]["path"],
             "device": info.st_dev, "inode": info.st_ino,
             "namespaces": {name: os.readlink("/proc/self/ns/" + name) for name in support.NAMESPACES},
             "executorQualified": False, "resourceQualification": False}
    acquisition.save(output, "ownership", owner)
    return owner


def pre_exec(line, started, observed, expected, acquisition, protocol, leaf, output):
    birth = protocol.decode_line(line)
    acquisition.save(output, "native-birth", birth)
    if not protocol.valid_birth(birth, expected, started, observed):
        raise ValueError("Native birth binding unavailable")
    record = {"birth": birth, "fromNs": str(time.monotonic_ns()), "validated": False, "retainedBeforeAck": False}
    try:
        leaf.recheck()
        for key, path in (("processStatRaw", "stat"), ("placementRaw", "cgroup"), ("statusRaw", "status")):
            record[key] = acquisition.read_bounded("/proc/" + birth["pid"] + "/" + path, 4096).decode()
            acquisition.save(output, "pre-exec-" + path, {"raw": record[key]})
        record["targetProcsRaw"] = leaf.read(leaf.fds[-1], "cgroup.procs")
        acquisition.save(output, "pre-exec-target-procs", {"raw": record["targetProcsRaw"]})
        leaf.recheck()
        record["targetIdentity"] = leaf.snapshot(leaf.fds[-1])
        record["toNs"] = str(time.monotonic_ns())
        assessment = protocol.assess_pre_exec(record, birth, expected)
        if assessment["status"] != "PASS":
            raise ValueError("Independent birth observation unavailable")
        record.update(validated=True, retainedBeforeAck=True)
    finally:
        record.setdefault("toNs", str(time.monotonic_ns()))
        acquisition.save(output, "pre-exec-assessment", protocol.assess_pre_exec(record, birth, expected))
        # save fsyncs the file and parent directory before capture can issue A.
        acquisition.save(output, "pre-exec-observation", record)


def terminal_leaf(row):
    if row.get("cgroup.procs") == "" and row.get("cgroup.events") == "populated 0\nfrozen 0\n":
        return {"status": "PASS", "reasons": []}
    events = row.get("cgroup.events", "").splitlines()
    processes = row.get("cgroup.procs", "")
    populated = ("populated 1" in events or type(processes) is str
                 and re.fullmatch(r"(?:[1-9][0-9]*\n)+", processes) is not None)
    return {"status": "FAIL" if populated else "UNAVAILABLE",
            "reasons": ["TARGET_REMAINS_POPULATED" if populated else "TARGET_TERMINAL_UNAVAILABLE"]}


def observe_counter_mount(output, phase, acquisition, counters, expected):
    started = time.monotonic_ns()
    lines = acquisition.read_bounded('/proc/self/mountinfo').decode().splitlines()
    records = [line for line in lines if len(line.split(' ')) >= 5 and line.split(' ')[4] == '/sys/fs/cgroup']
    acquisition.save(output, 'counter-' + phase + '-mount',
                     {'records': records, 'fromNs': str(started), 'toNs': str(time.monotonic_ns())})
    return counters.mount_environment(records, expected)


def counted_execution(manifest, manifest_hash, acquisition, support, protocol, capture,
                      reader_module, counters, held, leaf, owner, initial_leaf):
    output = Path(manifest['output'])
    subject = read_optional(output, 'expected-subject', acquisition)
    with counters.OwnedRoles(leaf) as roles:
        scope_fds = roles.create()
        with reader_module.HeldCounters(held.fds[5], scope_fds, boot_id=subject['bootId'],
                                       clock_id=subject['clockId']) as reader:
            expected_counters = counters.bindings(reader)
            acquisition.save(output, 'counter-bindings', expected_counters)
            initial_environment = observe_counter_mount(output, 'initial', acquisition, counters,
                                                       expected_counters['run']['identity'])
            acquisition.save(output, 'counter-initial-environment', initial_environment)
            initial = reader.capture()
            acquisition.save(output, 'counter-initial', initial)
            admitted = counters.assess_capture(initial, expected_counters, initial=True)
            acquisition.save(output, 'counter-initial-assessment', admitted)
            if admitted['status'] != 'PASS':
                return 1
            roles.recheck()
            group = owner['group'].removeprefix('/sys/fs/cgroup')
            expected = dict(initial_leaf['identity'], placement=group + '/run/probe')
            acquisition.save(output, 'expected-birth', expected)
            command = [manifest['files']['native']['path'], str(leaf.fds[-1]), expected['device'],
                       expected['inode'], expected['placement'], group + '/attestor', '--',
                       *support.sandbox_command(manifest)]
            acquisition.save(output, 'native-command', {'command': command})
            result = capture.capture_native(command, leaf.fds[-1],
                lambda line, start, end: pre_exec(line, start, end, expected, acquisition, protocol, leaf, output),
                timeout=5, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
            acquisition.save(output, 'native-capture', result)
            birth = read_optional(output, 'native-birth', acquisition)
            independent = read_optional(output, 'pre-exec-observation', acquisition)
            assessed = protocol.assess_native(result, expected, birth, independent, owner, support)
            acquisition.save(output, 'native-assessment', assessed)
            try:
                terminal = leaf.observe(leaf.fds[-1], 'owned-target-terminal')
                closed = terminal_leaf(terminal)
            except (Exception, KeyboardInterrupt) as error:
                closed = {'status': 'UNAVAILABLE', 'reasons': ['TARGET_TERMINAL_UNAVAILABLE']}
                acquisition.save(output, 'target-terminal-error',
                                 {'type': type(error).__name__, 'message': str(error)[:4096]})
            acquisition.save(output, 'target-terminal-assessment', closed)
            # Final bytes remain useful on a failed native path; they do not establish a normal exit.
            final = reader.capture()
            acquisition.save(output, 'counter-final', final)
            final_assessment = counters.assess_capture(final, expected_counters, initial=False)
            final_environment = None
            try:
                final_environment = observe_counter_mount(output, 'final', acquisition, counters,
                                                         expected_counters['run']['identity'])
                if final_environment != initial_environment:
                    raise ValueError('Counter mount environment changed')
            except (Exception, KeyboardInterrupt) as error:
                final_assessment['status'] = 'UNAVAILABLE'
                final_assessment['reasons'].append('FINAL_MOUNT_UNAVAILABLE')
                acquisition.save(output, 'counter-final-mount-error',
                                 {'type': type(error).__name__, 'message': str(error)[:4096]})
            acquisition.save(output, 'counter-final-environment', final_environment)
            acquisition.save(output, 'counter-final-assessment', final_assessment)
            lifetime = dict(assessed, creationLowerBoundNs=None, waitUpperBoundNs=None)
            if protocol.valid_birth(birth, expected, int(result['startedAtNs']), int(result['endedAtNs'])):
                lifetime['creationLowerBoundNs'] = birth['fromNs']
            if assessed['status'] == 'PASS':
                exited = protocol.decode_line(result['stdout'].splitlines()[-1])
                if protocol.valid_exit(exited, birth, int(result['endedAtNs'])):
                    lifetime['waitUpperBoundNs'] = exited['toNs']
            names = ('counter-bindings', 'counter-initial-mount', 'counter-initial-environment',
                     'counter-initial', 'counter-initial-assessment',
                     'native-capture', 'native-assessment', 'owned-target-terminal', 'target-terminal-assessment',
                     'counter-final', 'counter-final-mount', 'counter-final-environment', 'counter-final-assessment')
            inventory = []
            for name in names:
                path = output / (name + '.json')
                inventory.append({'path': path.name, 'present': path.exists(),
                                  'bytes': path.stat().st_size if path.exists() else None,
                                  'sha256': acquisition.digest(path) if path.exists() else None})
            acquisition.save(output, 'counter-raw-inventory', inventory)
            retained_at = str(time.monotonic_ns())
            acquisition.save(output, 'counter-lifetime', {
                **lifetime, 'rawRetainedAtNs': retained_at,
                'timeSemantics': 'Pre-creation lower bound and post-normal-wait upper bound; not exact kernel event times.',
                'rawInventorySha256': acquisition.digest(output / 'counter-raw-inventory.json'),
                'emptyPrerequisiteRoles': ['daemon', 'browser'], 'onlyWorkloadLeaf': 'run/probe',
                'executorQualified': False, 'resourceQualification': False})
            memory = counters.receipt(manifest, manifest_hash, subject, initial, final, lifetime, closed,
                                      final_assessment, retained_at, acquisition.CONTRACT,
                                      initial_environment, final_environment)
            counters.retain_receipt(output / 'memory-receipt.json', memory, acquisition)
            acquisition.save(output, 'counter-retention', {
                'rawInventorySha256': acquisition.digest(output / 'counter-raw-inventory.json'),
                'lifetimeSha256': acquisition.digest(output / 'counter-lifetime.json'),
                'memoryReceiptSha256': acquisition.digest(output / 'memory-receipt.json'),
                'receiptRetainedAtNs': str(time.monotonic_ns()), 'beforeOwnedServiceReturn': True,
                'executorQualified': False, 'resourceQualification': False})
            usage = resource.getrusage(resource.RUSAGE_SELF)
            acquisition.save(output, 'outside-attestor-observation', {
                'pid': os.getpid(), 'observedAtNs': str(time.monotonic_ns()), 'clockId': subject['clockId'],
                'selfMaxRssBytes': usage.ru_maxrss * 1024, 'selfUserCpuSeconds': usage.ru_utime,
                'selfSystemCpuSeconds': usage.ru_stime, 'applicationMeasurement': False,
                'limitation': 'Outside Python attestor snapshot before return; excludes complete helper lifetime and other processes.'})
            return 0 if assessed['status'] == closed['status'] == final_assessment['status'] == 'PASS' else 1


def service(manifest, manifest_hash, acquisition, support, validator, protocol, capture, leaf_module,
            reader_module, counters):
    output = Path(manifest["output"])
    claim = json.loads(acquisition.read_bounded(Path(str(output) + ".claim")))
    if claim != {"manifestSha256": manifest_hash, "unit": manifest["unit"]}:
        raise ValueError("First claim mismatch")
    entry = {"manifestSha256": manifest_hash, "unit": manifest["unit"],
             "invocationId": os.environ.get("INVOCATION_ID"), "pid": os.getpid()}
    acquisition.save(output, "service-entry", entry)
    try:
        initial = json.loads(acquisition.read_bounded(output / "manager-initial.json"))
        if not acquisition.unit_absent(initial["command"], initial["properties"], manifest["unit"]):
            raise ValueError("Fresh request unavailable")
        with acquisition.HeldDirectories(manifest["uid"], manifest["unit"]) as held:
            owner = acquire(manifest, manifest_hash, acquisition, support, validator, held, entry)
            with leaf_module.OwnedLeaf(acquisition, held, output, manifest["uid"], manifest["gid"]) as leaf:
                initial_leaf = leaf.create()
                return counted_execution(manifest, manifest_hash, acquisition, support, protocol, capture,
                                         reader_module, counters, held, leaf, owner, initial_leaf)
    except (Exception, KeyboardInterrupt) as error:
        acquisition.save(output, "service-error", {"type": type(error).__name__, "message": str(error)[:4096]})
        return 1


def read_optional(output, name, acquisition):
    path = Path(output) / (name + ".json")
    return json.loads(acquisition.read_bounded(path)) if path.exists() else None


def run_first(manifest, manifest_path, manifest_hash, acquisition, support):
    output = Path(manifest["output"])
    acquisition.retain(Path(str(output) + ".claim"), {"manifestSha256": manifest_hash, "unit": manifest["unit"]})
    output.mkdir(mode=0o700)
    result = {"status": "UNAVAILABLE", "reasons": ["PREREQUISITE_NOT_REACHED"]}
    forced, empty, unchanged = False, False, False
    try:
        initial, fields = support.manager_state(manifest["unit"], manifest["uid"])
        acquisition.save(output, "manager-initial", {"command": initial, "properties": fields})
        if not acquisition.unit_absent(initial, fields, manifest["unit"]):
            raise ValueError("Fresh unit absence unavailable")
        command = support.service_command(manifest, manifest_path, manifest_hash)
        if (command != [manifest_hash if part == "MANIFEST_SHA256" else part for part in manifest["serviceCommandTemplate"]]
                or support.sandbox_command(manifest) != manifest["sandboxCommand"]):
            raise ValueError("Sealed command mismatch")
        acquisition.save(output, "launch", {"manifestSha256": manifest_hash, "command": command})
        try:
            launched = support.capture(command, timeout=25, env=support.command_env(manifest["uid"]))
            acquisition.save(output, "launcher", launched)
        except (Exception, KeyboardInterrupt) as error:
            launched = {"failure": type(error).__name__, "exitCode": None}
            acquisition.save(output, "launch-error", {**launched, "message": str(error)[:4096]})
        owner = read_optional(output, "ownership", acquisition)
        if owner:
            entry = read_optional(output, "service-entry", acquisition)
            if (owner["manifestSha256"] != manifest_hash or owner["unit"] != manifest["unit"]
                    or owner["invocationId"] != entry["invocationId"]
                    or owner["receiptSha256"] != acquisition.digest(output / "ownership-receipt.json")):
                raise ValueError("Retained ownership binding mismatch")
        final, fields = support.manager_state(manifest["unit"], manifest["uid"])
        acquisition.save(output, "manager-final", {"command": final, "properties": fields})
        if not final["failure"] and final["exitCode"] == 0 and acquisition.cleanup_allowed(fields, owner):
            forced = True
            cleanup = support.capture(["/usr/bin/systemctl", "--user", "stop", manifest["unit"]], timeout=5,
                                      env=support.command_env(manifest["uid"]))
            acquisition.save(output, "cleanup", cleanup)
            final, fields = support.manager_state(manifest["unit"], manifest["uid"])
            acquisition.save(output, "manager-after-cleanup", {"command": final, "properties": fields})
        if owner:
            group = acquisition.terminal_group(owner)
            acquisition.save(output, "terminal-group", group)
            empty = group["empty"]
        native = read_optional(output, "native-assessment", acquisition)
        terminal = read_optional(output, "target-terminal-assessment", acquisition)
        if native:
            result = {"status": native["status"], "reasons": list(native["reasons"])}
        initial_counters = read_optional(output, 'counter-initial-assessment', acquisition)
        final_counters = read_optional(output, 'counter-final-assessment', acquisition)
        retention = read_optional(output, 'counter-retention', acquisition)
        if (not initial_counters or initial_counters.get('status') != 'PASS'
                or not final_counters or final_counters.get('status') != 'PASS' or not retention
                or retention.get('memoryReceiptSha256') != acquisition.digest(output / 'memory-receipt.json')):
            if result['status'] != 'FAIL':
                result['status'] = 'UNAVAILABLE'
            result['reasons'].append('COUNTER_ACQUISITION_OR_RETENTION_UNAVAILABLE')
        if not terminal or terminal["status"] != "PASS":
            if result["status"] != "FAIL":
                result["status"] = "UNAVAILABLE"
            result["reasons"].append("TARGET_TERMINAL_UNAVAILABLE")
        if launched["failure"] or launched["exitCode"] != 0 or not empty or not acquisition.terminal_valid(final, fields, owner):
            if result["status"] != "FAIL":
                result["status"] = "UNAVAILABLE"
            result["reasons"].append("CLOSURE_OR_LAUNCH_UNAVAILABLE")
        load_manifest(manifest_path, manifest_hash, acquisition)
        unchanged = True
    except (Exception, KeyboardInterrupt) as error:
        acquisition.save(output, "outer-error", {"type": type(error).__name__, "message": str(error)[:4096]})
        if result["status"] != "FAIL":
            result["status"] = "UNAVAILABLE"
        result["reasons"].append("COLLECTION_OR_INPUT_UNAVAILABLE")
    for name in ("ownership-assessment", "pre-exec-assessment", "native-assessment", "target-terminal-assessment"):
        assessed = read_optional(output, name, acquisition)
        if assessed and assessed.get("status") == "FAIL":
            result["status"] = "FAIL"
            result["reasons"].append("RETAINED_VIOLATION:" + name)
    if forced:
        result["status"] = "FAIL"
        result["reasons"].append("FORCED_CLEANUP")
    result.update(executorQualified=False, resourceQualification=False, applicationExecuted=False,
                  counterAcquisitionEstablished=result['status'] == 'PASS', offlineMemoryAssessmentPending=True,
                  directBirthEstablished=result["status"] == "PASS", forcedCleanup=forced,
                  ownedGroupEmpty=empty, inputsUnchanged=unchanged, manifestSha256=manifest_hash,
                  notAssessed=["complete-counter-lifetime", "ancestor-controls", "offline-memory-predicates", "orphans",
                               "interrupted-collector", "application-resources", "semantic-quality"])
    acquisition.save(output, "assessment", result)
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("--run-first", "--service"):
        raise SystemExit("Usage: probe.py --run-first|--service MANIFEST SHA256")
    manifest_path, manifest_hash = Path(sys.argv[2]), sys.argv[3]
    acquisition, manifest = bootstrap(manifest_path, manifest_hash)
    modules = {name: load_module(manifest["files"][name]["path"], "direct_birth_" + name)
               for name in ("support", "validator", "protocol", "capture", "leaf", "counterReader", "counters")}
    raise SystemExit(service(manifest, manifest_hash, acquisition, modules["support"], modules["validator"],
                             modules["protocol"], modules["capture"], modules["leaf"],
                             modules['counterReader'], modules['counters']) if sys.argv[1] == "--service"
                     else run_first(manifest, manifest_path, manifest_hash, acquisition, modules["support"]))
