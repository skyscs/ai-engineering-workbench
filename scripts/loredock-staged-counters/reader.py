"""Staged, one-shot counter observations; supplied handles establish no live authority.

Byte/descriptor algorithms derive from the frozen Task 158 reader. This standalone
copy changes acquisition order without changing that consumed implementation.
"""
import base64
import fcntl
import json
import os
import re
import stat
import time

ORDER = ("daemon", "browser", "run")
INTERFACES = ("memory.current", "memory.peak", "memory.swap.current", "memory.swap.peak",
              "memory.events", "memory.swap.events", "cgroup.events", "cgroup.type")
MAX_READ, MAX_RECORD = 4096, 1048576
FLAGS = os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK
SCALARS = INTERFACES[:4]
MEMORY_EVENTS = {"low", "high", "max", "oom", "oom_kill", "oom_group_kill"}


def zero_events(raw, required, optional=frozenset()):
    if not raw.endswith("\n"):
        return False
    names = []
    for line in raw[:-1].split("\n"):
        match = re.fullmatch(r"([a-z_]+) 0", line)
        if not match:
            return False
        names.append(match[1])
    return len(names) == len(set(names)) and required <= set(names) <= required | optional


def initial_eligible(row):
    """Internal consistency only; no process, construction or durability authority."""
    raw = row["snapshot"]["raw"]
    return (not row["errors"] and row["snapshot"]["identity"] is not None
            and set(raw) == set(INTERFACES)
            and all(read["complete"] and not read["errors"] for read in row["reads"].values())
            and all(raw[name] == "0\n" for name in SCALARS)
            and zero_events(raw["memory.events"], MEMORY_EVENTS, {"sock_throttled"})
            and zero_events(raw["memory.swap.events"], {"high", "max", "fail"})
            and zero_events(raw["cgroup.events"], {"populated", "frozen"})
            and raw["cgroup.type"] == "domain\n")


def error_record(error, stage):
    return {"stage": stage, "type": type(error).__name__, "errno": getattr(error, "errno", None),
            "message": str(error)[:256]}


def bounded_read(fd):
    """Retain at most one overflow byte; never turn a partial read into a complete value."""
    raw = bytearray()
    try:
        while len(raw) <= MAX_READ:
            chunk = os.pread(fd, min(MAX_READ, MAX_READ + 1 - len(raw)), len(raw))
            if not chunk:
                return bytes(raw), None
            raw.extend(chunk)
        raise ValueError("Interface exceeds 4096 bytes")
    except (OSError, ValueError) as error:
        return bytes(raw[:MAX_READ + 1]), error_record(error, "read")


def signature(info):
    return {"device": f"{os.major(info.st_dev)}:{os.minor(info.st_dev)}", "inode": str(info.st_ino),
            "type": stat.S_IFMT(info.st_mode), "uid": info.st_uid, "gid": info.st_gid}


def descriptor_identity(fd):
    info = signature(os.fstat(fd))
    if os.get_inheritable(fd) or fcntl.fcntl(fd, fcntl.F_GETFL) & (os.O_ACCMODE | os.O_PATH):
        raise ValueError("Expected a read-only, non-inheritable descriptor")
    metadata = os.open(f"/proc/self/fdinfo/{fd}", FLAGS)
    try:
        raw, error = bounded_read(metadata)
        if error:
            if error["errno"] is not None:
                raise OSError(error["errno"], "Descriptor mount metadata unavailable: " + error["message"])
            raise ValueError("Descriptor mount metadata unavailable: " + error["message"])
        values = re.findall(rb"^mnt_id:\s*([1-9][0-9]*)$", raw, re.MULTILINE)
        if len(values) != 1:
            raise ValueError("Descriptor mount identity unavailable")
        info["mountId"] = values[0].decode("ascii")
    finally:
        os.close(metadata)
    return info


class StagedCounters:
    """Own duplicates and fixed counter FDs, but never create or remove a hierarchy."""
    def __init__(self, parent_fd, run_fd, *, boot_id, clock_id, clock=time.monotonic_ns):
        self.owned, self.directories, self.identities, self.counters, self.open_errors = [], {}, {}, {}, {}
        self.invalid_scopes, self.invalid_counters = set(), {}
        self.closed, self.busy, self.previous_tick = False, False, None
        self.state, self.clock_failed = "root-ready", False
        self.root_eligible, self.roles_eligible = False, False
        self.acquisition_errors = []
        self.boot_id, self.clock_id, self.clock = boot_id, clock_id, clock
        if (type(boot_id) is not str or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", boot_id)
                or type(clock_id) is not str or not re.fullmatch(r"[a-f0-9]{64}", clock_id)):
            raise ValueError("Invalid supplied clock context")
        try:
            self.acquired_at = self.tick(self.acquisition_errors)
            self._acquire_directory("parent", parent_fd)
            self._acquire_directory("run", run_fd)
            self._acquire_counters("run")
        except BaseException:
            self._close()
            raise

    def _acquire_directory(self, name, original):
        if type(original) is not int or original < 3:
            raise ValueError("Invalid caller directory handle")
        before = descriptor_identity(original)
        if before["type"] != stat.S_IFDIR:
            raise ValueError("Expected caller directory")
        fd = fcntl.fcntl(original, fcntl.F_DUPFD_CLOEXEC, 3)
        self.owned.append(fd)
        current = descriptor_identity(fd)
        if current != before:
            raise ValueError("Directory changed while duplicating")
        if any((row["device"], row["inode"]) == (current["device"], current["inode"])
               for row in self.identities.values()):
            raise ValueError("Scope identities must be distinct")
        if name != "parent" and any(current[key] != self.identities["parent"][key]
                                     for key in ("device", "mountId", "uid", "gid")):
            raise ValueError("Directory owner or mount mismatch")
        self.directories[name], self.identities[name] = fd, current
        if name != "parent":
            self.check_scope(name)

    def _acquire_counters(self, scope):
        self.check_scope(scope)
        for name in INTERFACES:
            key = (scope, name)
            try:
                named = os.stat(name, dir_fd=self.directories[scope], follow_symlinks=False)
                if not stat.S_ISREG(named.st_mode):
                    raise ValueError("Expected regular counter interface")
                fd = os.open(name, FLAGS, dir_fd=self.directories[scope])
                self.owned.append(fd)
                identity = descriptor_identity(fd)
                if signature(named) != {key: value for key, value in identity.items() if key != "mountId"}:
                    raise ValueError("Counter changed while opening")
                self.counters[key] = (fd, identity)
                self.check_counter(scope, name)
            except (OSError, ValueError) as error:
                self.open_errors[key] = error_record(error, "open")
        self.check_scope(scope)

    def _begin(self, expected):
        if self.closed or self.busy or self.state != expected:
            raise ValueError("Invalid staged reader transition: " + self.state)
        self.busy, self.state = True, "failed"

    def attach_roles(self, role_fds):
        """One attachment attempt; invalid directories close all owned handles."""
        self._begin("root-captured")
        try:
            if not self.root_eligible or type(role_fds) is not dict or set(role_fds) != {"daemon", "browser"}:
                raise ValueError("Complete root initial and exactly two role handles required")
            self.check_scope("run")
            for name in INTERFACES:
                self.check_counter("run", name)
            for scope in ("daemon", "browser"):
                self._acquire_directory(scope, role_fds[scope])
                self._acquire_counters(scope)
            for scope in ORDER:
                self.check_scope(scope)
            for name in INTERFACES:
                self.check_counter("run", name)
            self.state = "roles-ready"
        except BaseException:
            self._close()
            raise
        finally:
            self.busy = False

    def check_scope(self, scope):
        if scope in self.invalid_scopes:
            raise ValueError("Scope identity previously changed")
        try:
            if descriptor_identity(self.directories["parent"]) != self.identities["parent"]:
                raise ValueError("Parent handle identity changed")
            for name in ("run",) if scope == "run" else ("run", scope):
                parent = "parent" if name == "run" else "run"
                fd, parent_fd = self.directories[name], self.directories[parent]
                expected = self.identities[name]
                if descriptor_identity(fd) != expected:
                    raise ValueError("Held directory identity changed")
                named = signature(os.stat(name, dir_fd=parent_fd, follow_symlinks=False))
                if named != {key: value for key, value in expected.items() if key != "mountId"}:
                    raise ValueError("Named directory identity changed")
                actual_parent = signature(os.stat("..", dir_fd=fd, follow_symlinks=False))
                if actual_parent != {key: value for key, value in self.identities[parent].items() if key != "mountId"}:
                    raise ValueError("Directory parent changed")
        except (OSError, ValueError):
            self.invalid_scopes.add(scope)
            raise

    def check_counter(self, scope, name):
        key = (scope, name)
        if key in self.invalid_counters:
            raise ValueError("Counter identity previously changed")
        try:
            fd, expected = self.counters[key]
            named = signature(os.stat(name, dir_fd=self.directories[scope], follow_symlinks=False))
            if (descriptor_identity(fd) != expected or expected["type"] != stat.S_IFREG
                    or named != {key: value for key, value in expected.items() if key != "mountId"}
                    or any(expected[key] != self.identities[scope][key] for key in ("device", "mountId"))):
                raise ValueError("Counter identity changed or mismatched")
        except (OSError, ValueError) as error:
            self.invalid_counters[key] = error_record(error, "identity")
            raise

    def tick(self, errors):
        try:
            if self.clock_failed:
                raise ValueError("Monotonic clock previously failed")
            value = self.clock()
            if (type(value) is not int or not 0 <= value <= 18446744073709551615
                    or self.previous_tick is not None and value < self.previous_tick):
                raise ValueError("Invalid or reversed monotonic clock")
            self.previous_tick = value
            return str(value)
        except Exception as error:
            self.clock_failed = True
            errors.append(error_record(error, "clock"))
            return None

    def observe_scope(self, scope):
        errors, raw, reads = [], {}, {}
        start = self.tick(errors)
        for name in INTERFACES:
            key, data, failures = (scope, name), b"", []
            before = self.tick(failures)
            identity = dict(self.counters[key][1]) if key in self.counters else None
            if key in self.open_errors:
                failures.append(dict(self.open_errors[key]))
            else:
                try:
                    self.check_scope(scope)
                    self.check_counter(scope, name)
                    data, failure = bounded_read(self.counters[key][0])
                    if failure:
                        failures.append(failure)
                    self.check_counter(scope, name)
                    self.check_scope(scope)
                except (OSError, ValueError) as error:
                    failures.append(error_record(error, "identity"))
            after = self.tick(failures)
            # Timing failure does not erase independently read bytes, but invalidates the window.
            complete = not any(failure["stage"] != "clock" for failure in failures)
            if complete:
                try:
                    raw[name] = data.decode("utf-8", errors="strict")
                except UnicodeError as error:
                    complete = False
                    failures.append(error_record(error, "encoding"))
            reads[name] = {"identity": identity, "window": {"fromNs": before, "toNs": after, "clockId": self.clock_id},
                           "bytesBase64": base64.b64encode(data).decode("ascii"), "complete": complete, "errors": failures}
        identity = None
        try:
            self.check_scope(scope)
            current = self.identities[scope]
            parent = self.identities["parent" if scope == "run" else "run"]
            identity = {"bootId": self.boot_id, "mountId": current["mountId"], "device": current["device"],
                        "inode": current["inode"], "parentInode": parent["inode"]}
        except (OSError, ValueError) as error:
            errors.append(error_record(error, "scope"))
        end = self.tick(errors)
        if any(failure["stage"] == "clock" for read in reads.values() for failure in read["errors"]):
            errors.append({"stage": "clock", "type": "InvalidWindow", "errno": None,
                           "message": "At least one interface read has an invalid clock window"})
        window = {"fromNs": start, "toNs": end, "clockId": self.clock_id}
        if any(failure["stage"] == "clock" for failure in errors):
            window["toNs"] = None
        return {"snapshot": {"identity": identity, "window": window, "raw": raw}, "reads": reads, "errors": errors}

    def capture_root_initial(self):
        return self._capture("root-ready", "root-initial", ("run",), "root-captured")

    def capture_roles_initial(self):
        return self._capture("roles-ready", "roles-initial", ("daemon", "browser"), "roles-captured")

    def capture_final(self):
        return self._capture("roles-captured", "final", ORDER, "complete")

    def _capture(self, expected, phase, order, next_state):
        self._begin(expected)
        try:
            continuity_errors = self._root_continuity() if phase == "roles-initial" else []
            observations = {scope: self.observe_scope(scope) for scope in order}
            if phase == "roles-initial":
                continuity_errors.extend(self._root_continuity())
            if phase == "root-initial":
                self.root_eligible = not self.acquisition_errors and initial_eligible(observations["run"])
            elif phase == "roles-initial":
                self.roles_eligible = not continuity_errors and all(initial_eligible(row) for row in observations.values())
            result = {"schemaVersion": "loredock-staged-held-counter-observation/1", "phase": phase,
                      "scopeOrder": list(order), "acquiredAtNs": self.acquired_at,
                      "acquisitionErrors": [dict(row) for row in self.acquisition_errors],
                      "continuityErrors": continuity_errors,
                      "rootInitialEligible": self.root_eligible,
                      "initialDataEligible": self.root_eligible and self.roles_eligible and not self.clock_failed,
                      "observations": observations,
                      "offlineOnly": True, "ownershipEstablished": False, "executorQualified": False,
                      "resourceQualification": False, "terminalEstablished": False}
            if len(json.dumps(result, ensure_ascii=True, allow_nan=False).encode()) > MAX_RECORD:
                raise ValueError("Observation exceeds 1-MiB bound")
            self.state = next_state
            return result
        finally:
            self.busy = False

    def _root_continuity(self):
        errors = []
        for name in INTERFACES:
            try:
                self.check_scope("run")
                self.check_counter("run", name)
            except (OSError, ValueError) as error:
                errors.append({"scope": "run", "interface": name, **error_record(error, "identity")})
        return errors

    def close(self):
        if self.busy:
            raise ValueError("Cannot close during an active staged operation")
        self._close()

    def _close(self):
        self.closed = True
        errors = []
        while self.owned:
            try:
                os.close(self.owned.pop())
            except OSError as error:
                errors.append(error)
        if errors:
            raise errors[0]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
