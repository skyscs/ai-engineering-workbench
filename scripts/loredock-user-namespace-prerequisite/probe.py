"""One separately sealed user-service prerequisite; importing this module executes nothing."""
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import time

MAX_RECORD = 1048576
MAX_OUTPUT = 2097152
CONTRACT = "759dc70e2d3b86043278b8378148785dd061cf29c06fa6f96c3a5bdf00be8e5b"
DEPENDENCIES = {
    "support": "c80a52ee64a84d4ca93436a55d02b24bdaf1fbee6834d2c2f17f230f6fa17c24",
    "validator": "f44932b3c33b997a55cd5693f7435c458cc40dd59ab15deb8da51162d636affd",
    "payload": "497dee9e852e861451ba7c2e321f77457ee18a30c1d1f392dc06f85fcb47107f",
}
BOUNDS = {"serviceRequests": 1, "sandboxInvocations": 1, "payloadInvocations": 1,
          "explicitPayloadAllocationBytes": 1048576, "serviceRuntimeSeconds": 10,
          "startTimeoutSeconds": 5, "stopTimeoutSeconds": 2, "outerLaunchTimeoutSeconds": 25,
          "capturedStreamBytes": 65536, "recordBytes": MAX_RECORD, "retainedFirstOutputBytes": MAX_OUTPUT}


def encode(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def read_bounded(path, maximum=MAX_RECORD, *, dir_fd=None):
    fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW, dir_fd=dir_fd)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError("Expected regular input")
        chunks, size = [], 0
        while size <= maximum:
            chunk = os.read(fd, min(8192, maximum + 1 - size))
            if not chunk:
                return b"".join(chunks)
            chunks.append(chunk)
            size += len(chunk)
        raise ValueError("Input exceeds bound")
    finally:
        os.close(fd)


def digest(path):
    return hashlib.sha256(read_bounded(path, 16777216)).hexdigest()


def retain(path, value, *, first_output=False):
    path = Path(path)
    raw = encode(value).encode()
    if len(raw) > MAX_RECORD:
        raise ValueError("Receipt exceeds bound")
    if first_output:
        total = 0
        for item in path.parent.iterdir():
            info = item.lstat()
            if not stat.S_ISREG(info.st_mode):
                raise ValueError("Unexpected first-output entry")
            total += info.st_size
        if total + len(raw) > MAX_OUTPUT:
            raise ValueError("First output exceeds bound")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def save(output, name, value):
    retain(Path(output) / (name + ".json"), value, first_output=True)


def load_manifest(path, expected):
    path = Path(path)
    raw = read_bounded(path, 65536)
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Manifest digest mismatch")
    data = json.loads(raw)
    if type(data) is not dict or encode(data).encode() != raw or data.get("schemaVersion") != "loredock-user-namespace-prerequisite/1" or data.get("contractSha256") != CONTRACT:
        raise ValueError("Unsupported manifest encoding or binding")
    run_id = data.get("runId")
    if not isinstance(run_id, str) or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", run_id):
        raise ValueError("Invalid run identity")
    if data.get("unit") != "loredock-task154-" + run_id + ".service":
        raise ValueError("Invalid dedicated service name")
    if (type(data.get("uid")) is not int or type(data.get("gid")) is not int
            or data["uid"] != os.getuid() or data["gid"] != os.getgid() or min(os.getuid(), os.getgid()) == 0):
        raise ValueError("Non-root identity mismatch")
    output = Path(data["output"])
    if not output.is_absolute() or output.parent.resolve() != output.parent or output.name != "task154-user-namespace-first":
        raise ValueError("Invalid first-output destination")
    if data.get("bounds") != BOUNDS or any(type(data["bounds"][key]) is not int for key in BOUNDS):
        raise ValueError("Changed work bounds")
    fixed = {"python": "/usr/bin/python3", "bwrap": "/usr/bin/bwrap",
             "systemdRun": "/usr/bin/systemd-run", "systemctl": "/usr/bin/systemctl"}
    local = {"helper": "probe.py", "support": "support.py", "validator": "assess.py", "payload": "payload.py", "canary": "canary"}
    if set(data.get("files", {})) != set(fixed) | set(local):
        raise ValueError("Incomplete pinned inputs")
    for name, row in data["files"].items():
        source = Path(row["path"])
        target = Path(fixed[name]) if name in fixed else path.parent / local[name]
        if not source.is_absolute() or source != target:
            raise ValueError("Unexpected input path")
        resolved = source.resolve(strict=True)
        if str(resolved) != row["resolved"] or digest(resolved) != row["sha256"]:
            raise ValueError("Changed pinned input")
        info = resolved.stat()
        if name in fixed and (info.st_uid != 0 or info.st_mode & 0o6022):
            raise ValueError("Unsafe runtime permissions")
        if name in DEPENDENCIES and row["sha256"] != DEPENDENCIES[name]:
            raise ValueError("Changed accepted dependency")
    return data


def load_dependency(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expected_subject(manifest, manifest_hash, entry, boot_id):
    invocation = entry.get("invocationId")
    if not isinstance(invocation, str) or not re.fullmatch(r"[a-f0-9]{32}", invocation):
        raise ValueError("Missing independent launch invocation")
    return {"runId": manifest["runId"], "candidateSha256": manifest_hash,
            "unit": manifest["unit"], "uid": manifest["uid"], "gid": manifest["gid"],
            "invocationId": invocation, "bootId": boot_id,
            "clockId": hashlib.sha256(("CLOCK_MONOTONIC\0" + boot_id).encode()).hexdigest()}


class HeldDirectories:
    """Read-only directory chain; named-entry checks accompany held-object snapshots."""
    def __init__(self, uid, unit, root=Path("/sys/fs/cgroup")):
        self.fds = []
        self.parts = ["user.slice", f"user-{uid}.slice", f"user@{uid}.service", "app.slice", unit, "attestor"]
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW
        try:
            self.fds.append(os.open(root, flags))
            for part in self.parts:
                self.fds.append(os.open(part, flags, dir_fd=self.fds[-1]))
        except BaseException:
            self.close()
            raise

    def close(self):
        while self.fds:
            os.close(self.fds.pop())

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def snapshot(self):
        directories, details = {}, {}
        # Recheck every ancestor name, not only the three receipt directories.
        for index, part in enumerate(self.parts, 1):
            held = os.fstat(self.fds[index])
            named = os.stat(part, dir_fd=self.fds[index - 1], follow_symlinks=False)
            if not stat.S_ISDIR(named.st_mode) or (held.st_dev, held.st_ino) != (named.st_dev, named.st_ino):
                raise ValueError("Held directory name was replaced")
        for name, index in (("parent", 4), ("unit", 5), ("attestor", 6)):
            fd = self.fds[index]
            held, parent = os.fstat(fd), os.fstat(self.fds[index - 1])
            raw = read_bounded(f"/proc/self/fdinfo/{fd}", 4096).decode()
            matches = re.findall(r"^mnt_id:\s+([0-9]+)$", raw, re.M)
            if len(matches) != 1 or os.get_inheritable(fd):
                raise ValueError("Held mount identity or descriptor isolation unavailable")
            directories[name] = {"path": "/" + "/".join(self.parts[:index]),
                                 "device": f"{os.major(held.st_dev)}:{os.minor(held.st_dev)}",
                                 "mountId": matches[0], "inode": str(held.st_ino), "parentInode": str(parent.st_ino),
                                 "uid": held.st_uid, "gid": held.st_gid, "held": True}
            details[name] = raw
        return directories, details


def process_record(invocation):
    raw = read_bounded("/proc/self/stat", 4096).decode()
    tail = raw.rsplit(")", 1)[1].split()
    boot = read_bounded("/proc/sys/kernel/random/boot_id", 4096).decode().strip()
    if int(raw.split(" ", 1)[0]) != os.getpid() or len(tail) < 20:
        raise ValueError("Self process identity unavailable")
    return {"pid": str(os.getpid()), "startTimeTicks": tail[19], "uid": os.getuid(), "gid": os.getgid(),
            "bootId": boot, "invocationId": invocation}, raw


def optional_marker(fd):
    try:
        return {"state": "value", "value": os.getxattr(fd, "user.delegate").decode("utf-8", errors="replace")}
    except OSError as error:
        return {"state": "missing" if error.errno == errno.ENODATA else "unreadable", "errno": error.errno}


def collect_observation(manifest, expected, support, held, phase):
    output, uid = manifest["output"], manifest["uid"]
    start = time.monotonic_ns()
    manager = support.capture(["/usr/bin/systemctl", "--user", "show", "--property=ControlGroup"],
                              timeout=2, env=support.command_env(uid))
    save(output, phase + "-manager", manager)
    root = f"/user.slice/user-{uid}.slice/user@{uid}.service"
    if manager["failure"] or manager["exitCode"] != 0 or manager["stdout"] != "ControlGroup=" + root + "\n":
        raise ValueError("User manager identity unavailable")
    unit, _ = support.manager_state(manifest["unit"], uid)
    save(output, phase + "-unit", unit)
    if unit["failure"] or unit["exitCode"] != 0:
        raise ValueError("Unit properties unavailable")
    placement = read_bounded("/proc/self/cgroup", 4096).decode()
    save(output, phase + "-placement", {"raw": placement})
    process, raw = process_record(os.environ.get("INVOCATION_ID"))
    save(output, phase + "-process", {"record": process, "statRaw": raw})
    directories, fd_info = held.snapshot()
    save(output, phase + "-directories", {"records": directories, "fdInfo": fd_info})
    mounts = [line for line in read_bounded("/proc/self/mountinfo").decode().splitlines()
              if line.split(" ")[4] == "/sys/fs/cgroup"]
    save(output, phase + "-mount", {"records": mounts})
    if (len(mounts) != 1 or " - cgroup2 " not in mounts[0]
            or any(row["mountId"] != mounts[0].split(" ")[0] for row in directories.values())):
        raise ValueError("Held cgroup mount unavailable")
    controllers = read_bounded("cgroup.controllers", 4096, dir_fd=held.fds[5]).decode()
    save(output, phase + "-controllers", {"raw": controllers})
    if (not controllers.endswith("\n") or "memory" not in controllers.split()
            or len(set(controllers.split())) != len(controllers.split())):
        raise ValueError("Actual memory controller delegation unavailable")
    row = {"window": {"fromNs": str(start), "toNs": str(time.monotonic_ns()), "clockId": expected["clockId"]},
           "manager": {"kind": "user", "uid": uid, "controlGroup": root}, "unitRaw": unit["stdout"],
           "placementRaw": placement, "process": process, "directories": directories}
    # All required observations are durable before the optional xattr can fail.
    save(output, phase + "-required", row)
    row["marker"] = optional_marker(held.fds[5])
    save(output, phase + "-marker", row["marker"])
    row["window"]["toNs"] = str(time.monotonic_ns())
    save(output, phase, row)
    return row


def unit_absent(result, fields, unit):
    return (result.get("failure") is None and result.get("exitCode") in (0, 1)
            and all(fields.get(key) == value for key, value in {"Id": unit, "LoadState": "not-found",
                    "ActiveState": "inactive", "MainPID": "0", "InvocationID": "", "ControlGroup": ""}.items()))


def service(manifest, manifest_hash, support, validator):
    output = Path(manifest["output"])
    claim = json.loads(read_bounded(Path(str(output) + ".claim")))
    if claim != {"manifestSha256": manifest_hash, "unit": manifest["unit"]}:
        raise ValueError("First claim mismatch")
    entry = {"manifestSha256": manifest_hash, "unit": manifest["unit"],
             "invocationId": os.environ.get("INVOCATION_ID"), "pid": os.getpid()}
    save(output, "service-entry", entry)
    try:
        initial = json.loads(read_bounded(output / "manager-initial.json"))
        if not unit_absent(initial["command"], initial["properties"], manifest["unit"]):
            raise ValueError("Fresh request not established")
        opened = time.monotonic_ns()
        boot = read_bounded("/proc/sys/kernel/random/boot_id", 4096).decode().strip()
        expected = expected_subject(manifest, manifest_hash, entry, boot)
        save(output, "expected-subject", expected)
        with HeldDirectories(manifest["uid"], manifest["unit"]) as held:
            observations, collection_failed = {}, False
            try:
                for phase in ("before", "after"):
                    observations[phase] = collect_observation(manifest, expected, support, held, phase)
            except (Exception, KeyboardInterrupt) as error:
                collection_failed = True
                save(output, "acquisition-error", {"type": type(error).__name__, "message": str(error)[:4096]})
            # A later read error must not erase an already retained profile violation.
            for phase in ("before", "after"):
                partial = output / (phase + "-required.json")
                if phase not in observations and partial.exists():
                    observations[phase] = json.loads(read_bounded(partial))
            receipt = {"schemaVersion": "loredock-user-service-ownership/1", "contractSha256": CONTRACT,
                       "subject": expected, "acquisition": {"unitAbsentBeforeRequest": True, "exclusiveClaim": True,
                       "attempt": 1, "openedAtNs": str(opened), "retainedAtNs": str(time.monotonic_ns()),
                       "recordsRetained": True, "descriptorsHeld": True},
                       "before": observations.get("before"), "after": observations.get("after")}
            save(output, "ownership-receipt", receipt)
            assessment = validator.assess_ownership_receipt(encode(receipt), expected)
            save(output, "ownership-assessment", assessment)
            if collection_failed or assessment["status"] != "PASS":
                return 1
            info = os.fstat(held.fds[5])
            owner = {"manifestSha256": manifest_hash, "unit": manifest["unit"], "invocationId": expected["invocationId"],
                     "receiptSha256": digest(output / "ownership-receipt.json"),
                     "group": "/sys/fs/cgroup" + observations["before"]["directories"]["unit"]["path"],
                     "device": info.st_dev, "inode": info.st_ino,
                     "namespaces": {name: os.readlink("/proc/self/ns/" + name) for name in support.NAMESPACES},
                     "executorQualified": False, "resourceQualification": False}
            save(output, "ownership", owner)
            result = support.capture(support.sandbox_command(manifest), timeout=5, env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
            save(output, "sandbox", result)
            return 0 if result["failure"] is None and result["exitCode"] == 0 else 1
    except (Exception, KeyboardInterrupt) as error:
        save(output, "service-error", {"type": type(error).__name__, "message": str(error)[:4096]})
        return 1


def terminal_valid(result, fields, owner):
    if not owner:
        return False
    if unit_absent(result, fields, owner["unit"]):
        return True
    return (result.get("failure") is None and result.get("exitCode") == 0
            and fields.get("LoadState") == "loaded"
            and fields.get("Id") == owner["unit"] and fields.get("InvocationID") == owner["invocationId"]
            and fields.get("ControlGroup") in ("", owner["group"].removeprefix("/sys/fs/cgroup"))
            and fields.get("ActiveState") in ("inactive", "failed") and fields.get("MainPID") == "0")


def cleanup_allowed(fields, owner):
    return (owner is not None and fields.get("Id") == owner["unit"]
            and fields.get("InvocationID") == owner["invocationId"]
            and fields.get("ControlGroup") == owner["group"].removeprefix("/sys/fs/cgroup")
            and fields.get("ActiveState") in ("active", "activating", "deactivating"))


def terminal_group(owner):
    group = Path(owner["group"])
    try:
        info = group.stat(follow_symlinks=False)
    except FileNotFoundError:
        return {"absent": True, "empty": True}
    if not stat.S_ISDIR(info.st_mode) or (info.st_dev, info.st_ino) != (owner["device"], owner["inode"]):
        return {"absent": False, "empty": False, "identityChanged": True}
    raw = read_bounded(group / "cgroup.events", 4096).decode()
    lines = raw.splitlines()
    values = dict(line.split(" ") for line in lines)
    empty = len(values) == len(lines) and set(values) == {"populated", "frozen"} and all(value == "0" for value in values.values())
    return {"absent": False, "empty": empty, "raw": raw, "device": info.st_dev, "inode": info.st_ino}


def run_first(manifest, manifest_path, manifest_hash, support):
    output = Path(manifest["output"])
    retain(Path(str(output) + ".claim"), {"manifestSha256": manifest_hash, "unit": manifest["unit"]})
    output.mkdir(mode=0o700)
    result = {"status": "UNAVAILABLE", "reasons": ["PREREQUISITE_NOT_REACHED"]}
    forced, empty, unchanged = False, False, False
    try:
        initial, fields = support.manager_state(manifest["unit"], manifest["uid"])
        save(output, "manager-initial", {"command": initial, "properties": fields})
        if not unit_absent(initial, fields, manifest["unit"]):
            raise ValueError("Fresh unit absence unavailable")
        command = support.service_command(manifest, manifest_path, manifest_hash)
        if (command != [manifest_hash if part == "MANIFEST_SHA256" else part for part in manifest["serviceCommandTemplate"]]
                or support.sandbox_command(manifest) != manifest["sandboxCommand"]):
            raise ValueError("Sealed command mismatch")
        save(output, "launch", {"manifestSha256": manifest_hash, "command": command})
        try:
            launched = support.capture(command, timeout=25, env=support.command_env(manifest["uid"]))
            save(output, "launcher", launched)
        except (Exception, KeyboardInterrupt) as error:
            launched = {"failure": type(error).__name__, "exitCode": None}
            save(output, "launch-error", {**launched, "message": str(error)[:4096]})
        owner = json.loads(read_bounded(output / "ownership.json")) if (output / "ownership.json").exists() else None
        if owner:
            entry = json.loads(read_bounded(output / "service-entry.json"))
            if (owner["manifestSha256"] != manifest_hash or owner["unit"] != manifest["unit"]
                    or owner["invocationId"] != entry["invocationId"] or owner["receiptSha256"] != digest(output / "ownership-receipt.json")):
                raise ValueError("Retained ownership binding mismatch")
        final, fields = support.manager_state(manifest["unit"], manifest["uid"])
        save(output, "manager-final", {"command": final, "properties": fields})
        if not final["failure"] and final["exitCode"] == 0 and cleanup_allowed(fields, owner):
            forced = True
            cleanup = support.capture(["/usr/bin/systemctl", "--user", "stop", manifest["unit"]], timeout=5, env=support.command_env(manifest["uid"]))
            save(output, "cleanup", cleanup)
            final, fields = support.manager_state(manifest["unit"], manifest["uid"])
            save(output, "manager-after-cleanup", {"command": final, "properties": fields})
        if owner:
            group = terminal_group(owner)
            save(output, "terminal-group", group)
            empty = group["empty"]
        if owner and (output / "sandbox.json").exists():
            result = support.assess_payload(json.loads(read_bounded(output / "sandbox.json")), owner, manifest["uid"], manifest["gid"])
        if launched["failure"] or launched["exitCode"] != 0 or not empty or not terminal_valid(final, fields, owner):
            if result["status"] != "FAIL":
                result["status"] = "UNAVAILABLE"
            result["reasons"].append("CLOSURE_OR_LAUNCH_UNAVAILABLE")
        load_manifest(manifest_path, manifest_hash)
        unchanged = True
    except (Exception, KeyboardInterrupt) as error:
        save(output, "outer-error", {"type": type(error).__name__, "message": str(error)[:4096]})
        if result["status"] != "FAIL":
            result["status"] = "UNAVAILABLE"
        result["reasons"].append("COLLECTION_OR_INPUT_UNAVAILABLE")
    ownership_assessment = output / "ownership-assessment.json"
    if ownership_assessment.exists() and json.loads(read_bounded(ownership_assessment)).get("status") == "FAIL":
        result["status"] = "FAIL"
        result["reasons"].append("APPLIED_OWNERSHIP_PROFILE_VIOLATION")
    if forced:
        result["status"] = "FAIL"
        result["reasons"].append("FORCED_CLEANUP")
    result.update(executorQualified=False, resourceQualification=False, applicationExecuted=False,
                  forcedCleanup=forced, ownedGroupEmpty=empty, inputsUnchanged=unchanged,
                  manifestSha256=manifest_hash, notAssessed=["direct-cgroup-birth", "counter-ownership",
                  "ancestor-controls", "terminal-memory-peaks", "orphans", "interrupted-collector", "application-resources"])
    save(output, "assessment", result)
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("--run-first", "--service"):
        raise SystemExit("Usage: probe.py --run-first|--service MANIFEST SHA256")
    manifest_path, manifest_hash = Path(sys.argv[2]), sys.argv[3]
    manifest = load_manifest(manifest_path, manifest_hash)
    support = load_dependency(manifest["files"]["support"]["path"], "namespace_support")
    validator = load_dependency(manifest["files"]["validator"]["path"], "ownership_validator")
    raise SystemExit(service(manifest, manifest_hash, support, validator) if sys.argv[1] == "--service"
                     else run_first(manifest, manifest_path, manifest_hash, support))
