"""Staged counter checks, durable publication and receipt projection; no qualification."""
import base64
import copy
import json
import os
import re
import stat
import time

SCOPES = ("daemon", "browser", "run")
SCALARS = ("memory.current", "memory.peak", "memory.swap.current", "memory.swap.peak")
MEMORY_EVENTS = {"low", "high", "max", "oom", "oom_kill", "oom_group_kill"}
SWAP_EVENTS = {"high", "max", "fail"}
INTERFACES = (*SCALARS, "memory.events", "memory.swap.events", "cgroup.events", "cgroup.type")


class OwnedRoles:
    """Keep sibling FDs separate from the frozen leaf's run/probe descriptor list."""
    def __init__(self, leaf):
        self.leaf, self.fds, self.identities = leaf, {}, {}
        self.started = False

    def recheck(self):
        self.leaf.recheck()
        for name, fd in self.fds.items():
            named = os.stat(name, dir_fd=self.leaf.fds[0], follow_symlinks=False)
            expected = self.identities[name]
            if (self.leaf.snapshot(fd) != expected or not stat.S_ISDIR(named.st_mode)
                    or str(named.st_dev) != expected["device"] or str(named.st_ino) != expected["inode"]):
                raise ValueError("Owned role entry changed")

    def create(self):
        if self.started:
            raise ValueError("Role construction is one-shot")
        self.started = True
        for name in ("daemon", "browser"):
            self.recheck()
            os.mkdir(name, mode=0o755, dir_fd=self.leaf.fds[0])
            fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW,
                         dir_fd=self.leaf.fds[0])
            self.fds[name] = fd
            self.identities[name] = self.leaf.snapshot(fd)
            self.recheck()
            row = self.leaf.observe(fd, "owned-" + name + "-initial")
            self.recheck()
            available = row["cgroup.controllers"]
            names = available[:-1].split(" ") if type(available) is str and re.fullmatch(
                r"[a-z][a-z0-9_]*(?: [a-z][a-z0-9_]*)*\n", available) and len(available.encode()) <= 4096 else []
            if (row["cgroup.type"] != "domain\n" or row["cgroup.procs"] != ""
                    or row["cgroup.subtree_control"] != ""
                    or "memory" not in names or len(names) != len(set(names))
                    or row["cgroup.events"] != "populated 0\nfrozen 0\n"):
                raise ValueError("Empty prerequisite role unavailable")
        return {"run": self.leaf.fds[0], **self.fds}

    def close(self):
        errors = []
        while self.fds:
            _, fd = self.fds.popitem()
            try:
                os.close(fd)
            except OSError as error:
                errors.append(error)
        if errors:
            raise errors[0]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


def bindings(reader, scopes=SCOPES):
    result = {}
    for role in scopes:
        current = reader.identities[role]
        parent = reader.identities["parent" if role == "run" else "run"]
        result[role] = {"bootId": reader.boot_id, "clockId": reader.clock_id,
                        "identity": {"bootId": reader.boot_id, "mountId": current["mountId"],
                                     "device": current["device"], "inode": current["inode"],
                                     "parentInode": parent["inode"]},
                        "interfaces": {name: copy.deepcopy(reader.counters[(role, name)][1])
                                       if (role, name) in reader.counters else None for name in INTERFACES}}
    return result


def decimal(value):
    if type(value) is not str or not re.fullmatch(r"0|[1-9][0-9]{0,19}", value):
        return None
    number = int(value)
    return number if number <= 18446744073709551615 else None


def window(value, clock):
    if type(value) is not dict or set(value) != {"fromNs", "toNs", "clockId"} or value["clockId"] != clock:
        return None
    start, end = decimal(value["fromNs"]), decimal(value["toNs"])
    return (start, end) if start is not None and end is not None and start <= end else None


def zero_events(raw, required, optional=frozenset()):
    if type(raw) is not str or len(raw.encode()) > 4096 or not raw.endswith("\n"):
        return False
    names = []
    for line in raw[:-1].split("\n"):
        match = re.fullmatch(r"([a-z_]+) 0", line)
        if not match:
            return False
        names.append(match[1])
    return len(names) == len(set(names)) and required <= set(names) <= required | optional


def assess_capture(observation, expected, *, phase):
    """Check acquisition and initial emptiness; the unchanged JS assessor judges memory predicates."""
    order = {"root-initial": ("run",), "roles-initial": ("daemon", "browser"), "final": SCOPES}.get(phase)
    reasons, previous_end = [], None
    initial = phase != "final"
    if (order is None or type(observation) is not dict
            or observation.get("schemaVersion") != "loredock-staged-held-counter-observation/1"
            or observation.get("phase") != phase or observation.get("scopeOrder") != list(order)
            or type(observation.get("observations")) is not dict or set(observation["observations"]) != set(order)
            or type(expected) is not dict or not set(order) <= set(expected)):
        return {"status": "UNAVAILABLE", "reasons": ["COUNTER_BATCH_SCHEMA"], "resourceQualification": False}
    acquired_at = decimal(observation.get("acquiredAtNs"))
    if (acquired_at is None or observation.get("acquisitionErrors") != []
            or observation.get("continuityErrors") != [] or observation.get("rootInitialEligible") is not True
            or phase != "root-initial" and observation.get("initialDataEligible") is not True):
        reasons.append("STAGED_INITIAL_OR_CONTINUITY_UNAVAILABLE")
    for role in order:
        row = observation["observations"][role]
        try:
            sample, reads = row["snapshot"], row["reads"]
            span = window(sample["window"], expected[role]["clockId"])
            if (row["errors"] or sample["identity"] != expected[role]["identity"] or span is None
                    or acquired_at is None or span[0] < acquired_at
                    or previous_end is not None and span[0] < previous_end):
                raise ValueError("Scope identity or window unavailable")
            previous_end = span[1]
            if set(sample["raw"]) != set(INTERFACES) or set(reads) != set(INTERFACES):
                raise ValueError("Incomplete counter interfaces")
            interface_end = span[0]
            for name in INTERFACES:
                read = reads[name]
                observed = window(read["window"], expected[role]["clockId"])
                text = sample["raw"][name]
                if (read["complete"] is not True or read["errors"] or read["identity"] is None
                        or read["identity"] != expected[role]["interfaces"][name]
                        or observed is None or not interface_end <= observed[0] <= observed[1] <= span[1]
                        or type(text) is not str or len(text.encode()) > 4096
                        or base64.b64decode(read["bytesBase64"], validate=True) != text.encode()):
                    raise ValueError("Incomplete or changed interface")
                interface_end = observed[1]
            raw = sample["raw"]
            if raw["cgroup.type"] != "domain\n" or not zero_events(raw["cgroup.events"], {"populated", "frozen"}):
                raise ValueError("Empty domain evidence unavailable")
            if initial and (any(raw[name] != "0\n" for name in SCALARS)
                    or not zero_events(raw["memory.events"], MEMORY_EVENTS, {"sock_throttled"})
                    or not zero_events(raw["memory.swap.events"], SWAP_EVENTS)):
                raise ValueError("Fresh zero counters unavailable")
            if not initial and role != "run" and any(raw[name] != "0\n" for name in SCALARS):
                raise ValueError("Unexpected charge in an unused role")
            if not initial and role == "run":
                value = raw["memory.peak"]
                peak = decimal(value[:-1]) if value.endswith("\n") else None
                if peak is None or peak == 0:
                    raise ValueError("Positive retained root peak unavailable")
        except (KeyError, TypeError, ValueError, UnicodeError) as error:
            reasons.append(role + ":" + str(error)[:256])
    return {"status": "UNAVAILABLE" if reasons else "PASS", "reasons": reasons,
            "phase": phase, "resourceQualification": False}


def receipt(manifest, manifest_hash, subject, root_initial, roles_initial, final, native, terminal, final_assessment, retained_at,
            contract, initial_environment, final_environment):
    """Project preserved observations; lifetime bounds are documented separately by the caller."""
    good_exit = native.get("status") == terminal.get("status") == final_assessment.get("status") == "PASS"
    return {"schemaVersion": "loredock-memory-receipt/1",
            "contract": {"id": "loredock-observable-resources/2", "sha256": contract},
            "run": {"id": manifest["runId"], "candidateSha256": manifest_hash,
                    "bootId": subject["bootId"], "clockId": subject["clockId"],
                    "acquiredAtNs": root_initial["acquiredAtNs"],
                    "firstChildAtNs": native.get("creationLowerBoundNs"),
                    "lastExitAtNs": native.get("waitUpperBoundNs") if good_exit else None,
                    "retainedAtNs": retained_at, "allExited": good_exit,
                    "forcedCleanup": "FORCED_NATIVE_CLEANUP" in native.get("reasons", []),
                    "fsynced": True, "delegation": "exclusive", "counterMode": "read-only-never-reset"},
            "environment": {"initial": initial_environment, "final": final_environment},
            "scopes": {role: {"initial": copy.deepcopy((root_initial if role == "run" else roles_initial)["observations"][role]["snapshot"]),
                              "checkpoints": [], "final": copy.deepcopy(final["observations"][role]["snapshot"])}
                       for role in ("run", "daemon", "browser")},
            "diagnostics": {"heap": {"coverage": "unavailable", "aggregateHeapPeakBytes": None,
                                      "completeIsolateCoverage": False},
                            "rss": {"coverage": "unavailable", "unavailableSamples": 1}}}


def publish_initial(output, phase, rows, subject, identity, acquisition):
    """Return only after every referenced file and the publication record are fsynced."""
    started = time.monotonic_ns()
    inventory = []
    for name, value in rows:
        acquisition.save(output, name, value)
        path = output / (name + ".json")
        inventory.append({"path": path.name, "bytes": path.stat().st_size,
                          "sha256": acquisition.digest(path)})
    publication = {"phase": phase, "manifestSha256": subject["candidateSha256"],
                   "clockId": subject["clockId"], "identity": identity,
                   "fromNs": str(started), "dataRetainedAtNs": str(time.monotonic_ns()),
                   "records": inventory, "executorQualified": False, "resourceQualification": False}
    acquisition.save(output, "counter-" + phase + "-publication", publication)
    return publication


def mount_environment(records, expected):
    if type(records) is not list or len(records) != 1 or type(records[0]) is not str or len(records[0].encode()) > 4096:
        raise ValueError("Unique bounded cgroup mount record unavailable")
    halves = records[0].split(" - ")
    if len(halves) != 2:
        raise ValueError("Malformed mount record")
    left, right = halves[0].split(" "), halves[1].split(" ")
    if (len(left) < 6 or len(right) != 3 or left[0] != expected["mountId"]
            or left[2] != expected["device"] or left[3:5] != ["/", "/sys/fs/cgroup"] or right[0] != "cgroup2"):
        raise ValueError("Held cgroup mount binding mismatch")
    mount_options, super_options = left[5].split(","), right[2].split(",")
    if len(set(mount_options)) != len(mount_options) or len(set(super_options)) != len(super_options):
        raise ValueError("Duplicate mount option")
    options = sorted(set(mount_options) | set(super_options))
    if (len(options) > 32 or any(not re.fullmatch(r"[a-z_]+", name) for name in options)
            or "rw" not in options or "ro" in options or "memory_hugetlb_accounting" not in options
            or "memory_localevents" in options):
        raise ValueError("Required existing accounting mount mode unavailable")
    return {"mountId": left[0], "options": options, "eventsMode": "hierarchical"}


def retain_receipt(path, value, acquisition):
    """The JS assessor requires canonical UTF-8 JSON, including non-ASCII raw evidence."""
    raw = json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(raw) > acquisition.MAX_RECORD:
        raise ValueError("Memory receipt exceeds bound")
    total = 0
    for item in path.parent.iterdir():
        info = item.lstat()
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("Unexpected output entry")
        total += info.st_size
    if total + len(raw) > acquisition.MAX_OUTPUT:
        raise ValueError("First output exceeds bound")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
