"""Single-attempt namespace prerequisite. Importing this module executes nothing."""
import errno
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import stat
import subprocess
import sys
import time

MAX_RECORD = 1048576
MAX_STREAM = 65536
NAMESPACES = ("user", "mnt", "pid", "net", "ipc", "uts", "cgroup")
CONTRACT_SHA256 = "759dc70e2d3b86043278b8378148785dd061cf29c06fa6f96c3a5bdf00be8e5b"
UNIT = re.compile(r"loredock-task152-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.service\Z")
INVOCATION = re.compile(r"[a-f0-9]{32}\Z")


def read_bounded(path, maximum=MAX_RECORD):
    fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError("Expected regular input")
        data = b""
        while len(data) <= maximum:
            chunk = os.read(fd, min(8192, maximum + 1 - len(data)))
            if not chunk:
                return data
            data += chunk
        raise ValueError("Input exceeds bound")
    finally:
        os.close(fd)


def digest(path):
    return hashlib.sha256(read_bounded(path, 16777216)).hexdigest()


def retain(path, value):
    raw = json.dumps(value, separators=(",", ":")).encode()
    if len(raw) > MAX_RECORD:
        raise ValueError("Receipt exceeds bound")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(raw)
            output.flush()
            os.fsync(output.fileno())
    finally:
        directory = os.open(Path(path).parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)


def command_env(uid):
    return {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "XDG_RUNTIME_DIR": f"/run/user/{uid}",
            "DBUS_SESSION_BUS_ADDRESS": f"unix:path=/run/user/{uid}/bus"}


def capture(command, *, timeout, env):
    """Bound both streams while draining; always reap the direct child."""
    start = time.monotonic_ns()
    process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, env=env, close_fds=True, start_new_session=True)
    outputs = {"stdout": bytearray(), "stderr": bytearray()}
    failure = None
    try:
        with selectors.DefaultSelector() as selector:
            for name in outputs:
                selector.register(getattr(process, name), selectors.EVENT_READ, name)
            while selector.get_map() or process.poll() is None:
                if time.monotonic_ns() - start > timeout * 1000000000:
                    failure = failure or "TIMEOUT"
                    process.kill()
                for key, _ in selector.select(0.025):
                    chunk = os.read(key.fileobj.fileno(), 8192)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                        continue
                    remaining = MAX_STREAM - len(outputs[key.data])
                    outputs[key.data].extend(chunk[:remaining])
                    if len(chunk) > remaining:
                        failure = failure or "OUTPUT_BOUND"
                        process.kill()
                if failure and time.monotonic_ns() - start > (timeout + 2) * 1000000000:
                    # A separately owned service may still hold a pipe. Its manager watchdog
                    # remains active; the caller verifies that exact invocation afterward.
                    for key in list(selector.get_map().values()):
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                    break
    finally:
        if process.poll() is None:
            process.kill()
        code = process.wait(timeout=2)
        process.stdout.close()
        process.stderr.close()
    return {"command": command, "exitCode": code, "failure": failure,
            "durationNs": str(time.monotonic_ns() - start),
            **{name: bytes(data).decode("utf-8", errors="replace") for name, data in outputs.items()}}


def load_manifest(path, expected):
    raw = read_bounded(path, 65536)
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Manifest digest mismatch")
    manifest = json.loads(raw)
    if manifest.get("schemaVersion") != "loredock-namespace-prerequisite/1" or manifest.get("contractSha256") != CONTRACT_SHA256:
        raise ValueError("Unsupported prerequisite binding")
    if not isinstance(manifest.get("unit"), str) or not UNIT.fullmatch(manifest["unit"]):
        raise ValueError("Invalid dedicated service name")
    if manifest.get("uid") != os.getuid() or manifest.get("gid") != os.getgid() or os.getuid() == 0:
        raise ValueError("Non-root identity mismatch")
    output = Path(manifest["output"])
    if not output.is_absolute() or output.parent.resolve() != output.parent or output.name != "task152-namespace-first":
        raise ValueError("Invalid first-output destination")
    expected_files = {"helper", "payload", "canary", "python", "bwrap", "systemdRun", "systemctl"}
    if set(manifest.get("files", {})) != expected_files:
        raise ValueError("Incomplete pinned inputs")
    fixed = {"python": "/usr/bin/python3", "bwrap": "/usr/bin/bwrap",
             "systemdRun": "/usr/bin/systemd-run", "systemctl": "/usr/bin/systemctl"}
    for name, row in manifest["files"].items():
        path = Path(row["path"])
        if not path.is_absolute() or (name in fixed and str(path) != fixed[name]):
            raise ValueError("Unexpected input path")
        # Resolve the pinned system Python symlink; hash the final regular file.
        resolved = path.resolve(strict=True)
        if str(resolved) != row["resolved"] or digest(resolved) != row["sha256"]:
            raise ValueError("Changed input")
        if name in fixed and (resolved.stat().st_uid != 0 or resolved.stat().st_mode & 0o6022):
            raise ValueError("Unsafe runtime permissions")
    return manifest


def sandbox_command(manifest):
    files = manifest["files"]
    return [files["bwrap"]["path"], "--unshare-user", "--unshare-pid", "--unshare-net",
            "--unshare-ipc", "--unshare-uts", "--unshare-cgroup", "--disable-userns",
            "--assert-userns-disabled", "--new-session", "--die-with-parent", "--cap-drop", "ALL",
            "--clearenv", "--setenv", "PATH", "/usr/bin:/bin", "--setenv", "LANG", "C.UTF-8",
            "--uid", str(manifest["uid"]), "--gid", str(manifest["gid"]),
            "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin",
            "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
            "--proc", "/proc", "--dev", "/dev", "--dir", "/tmp", "--dir", "/probe",
            "--ro-bind", files["payload"]["path"], "/probe/payload.py",
            "--ro-bind", files["canary"]["path"], "/probe/canary", "--chdir", "/tmp",
            "/usr/bin/python3", "-I", "-S", "-B", "/probe/payload.py"]


PROPERTIES = ["Id", "InvocationID", "ControlGroup", "Delegate", "DelegateControllers", "DelegateSubgroup", "MainPID", "LoadState",
              "NoNewPrivileges", "RuntimeMaxUSec", "TimeoutStartUSec", "TimeoutStopUSec",
              "KillMode", "Restart", "ActiveState", "SubState", "Result"]


def manager_state(unit, uid):
    command = ["/usr/bin/systemctl", "--user", "show", unit, "--no-pager",
               "--property=" + ",".join(PROPERTIES)]
    result = capture(command, timeout=2, env=command_env(uid))
    fields = {}
    for line in result["stdout"].splitlines():
        key, separator, value = line.partition("=")
        if separator and key in PROPERTIES and key not in fields:
            fields[key] = value
        else:
            result["failure"] = result["failure"] or "MANAGER_FIELDS"
    return result, fields


def verify_owner(manifest, fields, self_group, invocation, pid):
    if not isinstance(invocation, str) or not INVOCATION.fullmatch(invocation):
        raise ValueError("Missing invocation identity")
    group = fields.get("ControlGroup", "")
    if not group.startswith(f"/user.slice/user-{manifest['uid']}.slice/user@{manifest['uid']}.service/") or not group.endswith("/" + manifest["unit"]):
        raise ValueError("Unexpected delegated group")
    if "/../" in group or "//" in group or self_group != group + "/attestor":
        raise ValueError("Unexpected service placement")
    required = {"Id": manifest["unit"], "InvocationID": invocation, "Delegate": "yes",
                "DelegateSubgroup": "attestor", "MainPID": str(pid), "NoNewPrivileges": "yes",
                "RuntimeMaxUSec": "10s", "TimeoutStartUSec": "5s", "TimeoutStopUSec": "2s",
                "KillMode": "control-group", "Restart": "no", "ActiveState": "active"}
    if any(fields.get(key) != value for key, value in required.items()) or "memory" not in fields.get("DelegateControllers", "").split():
        raise ValueError("Applied service properties do not match")
    return Path("/sys/fs/cgroup" + group)


def service(manifest, expected):
    output = Path(manifest["output"])
    claim = json.loads(read_bounded(Path(str(output) + ".claim")))
    if claim != {"manifestSha256": expected, "unit": manifest["unit"]}:
        raise ValueError("First-attempt claim does not match")
    # Consume the internal entry before any manager query or sandbox attempt. A service
    # restarted outside this controller cannot bypass the first-attempt boundary.
    retain(output / "service-entry.json", {"manifestSha256": expected,
           "invocationId": os.environ.get("INVOCATION_ID"), "pid": os.getpid()})
    try:
        manager, fields = manager_state(manifest["unit"], manifest["uid"])
        if manager["failure"] or manager["exitCode"] != 0:
            raise ValueError("Manager ownership unavailable")
        raw = read_bounded("/proc/self/cgroup", 4096).decode()
        if len(raw.splitlines()) != 1 or not raw.startswith("0::"):
            raise ValueError("Unified placement unavailable")
        self_group = raw.strip()[3:]
        group = verify_owner(manifest, fields, self_group, os.environ.get("INVOCATION_ID"), os.getpid())
        if os.getxattr(group, "user.delegate") != b"1":
            raise ValueError("Exclusive delegation marker unavailable")
        controllers = read_bounded(group / "cgroup.controllers", 4096).decode().split()
        if "memory" not in controllers:
            raise ValueError("Memory delegation unavailable")
        st = group.stat()
        if st.st_uid != manifest["uid"] or st.st_gid != manifest["gid"]:
            raise ValueError("Delegated directory ownership unavailable")
        owner = {"unit": manifest["unit"], "invocationId": fields["InvocationID"],
                 "manager": manager, "properties": fields, "group": str(group),
                 "device": st.st_dev, "inode": st.st_ino, "selfCgroup": raw,
                 "namespaces": {name: os.readlink("/proc/self/ns/" + name) for name in NAMESPACES},
                 "acquiredAtNs": str(time.monotonic_ns()), "pid": os.getpid()}
        retain(output / "ownership.json", owner)
        result = capture(sandbox_command(manifest), timeout=5, env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
        retain(output / "sandbox.json", result)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        retain(output / "service-error.json", {"type": type(error).__name__, "message": str(error)[:4096]})
        return 1
    return 0


def assess_payload(result, owner, uid, gid):
    if result.get("failure") or result.get("exitCode") != 0:
        return {"status": "UNAVAILABLE", "reasons": ["SANDBOX_EXECUTION_UNAVAILABLE"]}
    try:
        row = json.loads(result["stdout"])
        if row["schemaVersion"] != "loredock-namespace-payload/1":
            raise ValueError("Payload version")
        expected_hidden = {"/home", "/run/user", "/sys/fs/cgroup", "/proc/1/root/home"}
        checks = {
            "identity": row["uid"] == uid and row["gid"] == gid and uid != 0,
            "namespaces": set(row["namespaces"]) == set(NAMESPACES) and all(
                re.fullmatch(name + r":\[\d+\]", row["namespaces"][name]) and
                row["namespaces"][name] != owner["namespaces"][name] for name in NAMESPACES),
            "no-new-privileges": row["status"]["NoNewPrivs"] == "1",
            "capabilities": all(row["status"][key] == "0000000000000000"
                                for key in ("CapInh", "CapPrm", "CapEff", "CapAmb")),
            "descriptors": set(row["descriptors"]) == {"0", "1", "2"},
            "hidden-paths": set(row["hiddenPaths"]) == expected_hidden and all(value is True for value in row["hiddenPaths"].values()),
            "read-only-input": row["readOnlyErrno"] in (errno.EROFS, errno.EACCES, errno.EPERM),
            "nested-userns": row["nestedUsernsErrno"] in (errno.EPERM, errno.EACCES, errno.ENOSPC),
            "fixed-work": row["allocationBytes"] == 1048576 and row["touchedPages"] == 256,
            "environment": set(row["environmentKeys"]) <= {"PATH", "LANG", "PWD", "LC_CTYPE"},
        }
        return {"status": "PASS" if all(checks.values()) else "FAIL", "checks": checks,
                "reasons": [name for name, passed in checks.items() if not passed]}
    except (KeyError, ValueError, TypeError):
        return {"status": "UNAVAILABLE", "reasons": ["PAYLOAD_EVIDENCE_UNAVAILABLE"]}


def service_command(manifest, manifest_path, expected):
    return ["/usr/bin/systemd-run", "--user", "--wait", "--pipe", "--no-ask-password",
            "--expand-environment=no", "--unit=" + manifest["unit"], "--property=Type=exec",
            "--property=Delegate=memory", "--property=DelegateSubgroup=attestor",
            "--property=NoNewPrivileges=yes", "--property=RuntimeMaxSec=10s",
            "--property=TimeoutStartSec=5s", "--property=TimeoutStopSec=2s",
            "--property=KillMode=control-group", "--property=Restart=no",
            "/usr/bin/python3", "-I", "-S", "-B", manifest["files"]["helper"]["path"],
            "--service", str(manifest_path), expected]


def terminal_manager_valid(result, fields, owner):
    if not owner or result.get("failure") or fields.get("Id") != owner["unit"]:
        return False
    if fields.get("LoadState") == "not-found":
        return result.get("exitCode") in (0, 1) and fields.get("ActiveState") == "inactive"
    return (result.get("exitCode") == 0 and fields.get("InvocationID") == owner["invocationId"]
            and fields.get("ActiveState") in ("inactive", "failed") and fields.get("MainPID") == "0")


def run_first(manifest, manifest_path, expected):
    output = Path(manifest["output"])
    # The durable claim precedes directory creation and all service-manager mutation.
    retain(Path(str(output) + ".claim"), {"manifestSha256": expected, "unit": manifest["unit"]})
    output.mkdir(mode=0o700)
    retain(output / "launch.json", {"manifestSha256": expected, "command": service_command(manifest, manifest_path, expected)})
    launched = capture(service_command(manifest, manifest_path, expected), timeout=25, env=command_env(manifest["uid"]))
    retain(output / "launcher.json", launched)
    owner_path = output / "ownership.json"
    owner = json.loads(read_bounded(owner_path)) if owner_path.exists() else None
    final, fields = manager_state(manifest["unit"], manifest["uid"])
    retain(output / "manager-final.json", {"command": final, "properties": fields})
    forced = False
    if owner and fields.get("InvocationID") == owner["invocationId"] and fields.get("ActiveState") in ("active", "activating", "deactivating"):
        forced = True
        cleanup = capture(["/usr/bin/systemctl", "--user", "stop", manifest["unit"]], timeout=5, env=command_env(manifest["uid"]))
        retain(output / "cleanup.json", cleanup)
        final, fields = manager_state(manifest["unit"], manifest["uid"])
        retain(output / "manager-after-cleanup.json", {"command": final, "properties": fields})
    empty = False
    if owner:
        group = Path(owner["group"])
        if not group.exists():
            empty = True
        else:
            st = group.stat()
            if st.st_dev == owner["device"] and st.st_ino == owner["inode"]:
                events = read_bounded(group / "cgroup.events", 4096).decode()
                retain(output / "terminal-group.json", {"raw": events, "device": st.st_dev, "inode": st.st_ino})
                empty = "populated 0\n" in events
    sandbox_path = output / "sandbox.json"
    result = assess_payload(json.loads(read_bounded(sandbox_path)), owner, manifest["uid"], manifest["gid"]) if owner and sandbox_path.exists() else {"status": "UNAVAILABLE", "reasons": ["PREREQUISITE_NOT_REACHED"]}
    if launched["failure"] or launched["exitCode"] != 0 or not empty or not terminal_manager_valid(final, fields, owner):
        if result["status"] != "FAIL":
            result["status"] = "UNAVAILABLE"
        result["reasons"].append("CLOSURE_OR_LAUNCH_UNAVAILABLE")
    if forced:
        result["status"] = "FAIL"
        result["reasons"].append("FORCED_CLEANUP")
    try:
        load_manifest(manifest_path, expected)
        inputs_unchanged = True
    except (OSError, ValueError):
        inputs_unchanged = False
        if result["status"] != "FAIL":
            result["status"] = "UNAVAILABLE"
        result["reasons"].append("PINNED_INPUT_CHANGED")
    result.update(executorQualified=False, resourceQualification=False, applicationExecuted=False,
                  forcedCleanup=forced, ownedGroupEmpty=empty, manifestSha256=expected,
                  inputsUnchanged=inputs_unchanged,
                  notAssessed=["direct-cgroup-birth", "counter-ownership", "ancestor-controls",
                               "terminal-memory-peaks", "orphans", "interrupted-collector", "application-resources"])
    retain(output / "assessment.json", result)
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("--run-first", "--service"):
        raise SystemExit("Usage: probe.py --run-first|--service MANIFEST SHA256")
    data = load_manifest(Path(sys.argv[2]), sys.argv[3])
    raise SystemExit(service(data, sys.argv[3]) if sys.argv[1] == "--service" else run_first(data, Path(sys.argv[2]), sys.argv[3]))
