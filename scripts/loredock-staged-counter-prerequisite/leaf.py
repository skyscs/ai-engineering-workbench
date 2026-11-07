"""Separate exclusive root/probe construction under a verified service boundary.

The service owner durably publishes root counters between these two operations.
Task 156's consumed combined constructor remains unchanged.
"""
import os
import re
import stat
import time


def controllers(raw):
    """Preserve the kernel's zero-byte empty form; never normalize whitespace."""
    if type(raw) is not str or len(raw.encode("utf-8")) > 4096:
        raise ValueError("Unbounded controller list")
    if raw == "":
        return ()
    if not re.fullmatch(r"[a-z][a-z0-9_]*(?: [a-z][a-z0-9_]*)*\n", raw):
        raise ValueError("Malformed controller list")
    names = tuple(raw[:-1].split(" "))
    if len(set(names)) != len(names):
        raise ValueError("Duplicate controller")
    return names


class OwnedLeaf:
    def __init__(self, acquisition, held, output, uid, gid):
        self.acquisition, self.held, self.output = acquisition, held, output
        self.uid, self.gid, self.fds, self.identities = uid, gid, [], []
        self.state = "new"

    def read(self, fd, name):
        return self.acquisition.read_bounded(name, 4096, dir_fd=fd).decode()

    def snapshot(self, fd):
        info = os.fstat(fd)
        if (not stat.S_ISDIR(info.st_mode) or info.st_uid != self.uid or info.st_gid != self.gid
                or os.get_inheritable(fd)):
            raise ValueError("Owned directory identity unavailable")
        return {"device": str(info.st_dev), "inode": str(info.st_ino), "uid": info.st_uid, "gid": info.st_gid}

    def recheck(self):
        self.held.snapshot()
        parent = self.held.fds[5]
        for name, fd, original in zip(("run", "probe"), self.fds, self.identities):
            named = os.stat(name, dir_fd=parent, follow_symlinks=False)
            if (self.snapshot(fd) != original or not stat.S_ISDIR(named.st_mode)
                    or str(named.st_dev) != original["device"] or str(named.st_ino) != original["inode"]):
                raise ValueError("Owned leaf entry changed")
            parent = fd

    def observe(self, fd, phase):
        self.recheck()
        start = time.monotonic_ns()
        row = {"identity": self.snapshot(fd), "fromNs": str(start)}
        for name in ("cgroup.type", "cgroup.controllers", "cgroup.subtree_control", "cgroup.procs", "cgroup.events"):
            row[name] = self.read(fd, name)
            # Preserve earlier reads if a subsequent read fails.
            self.acquisition.save(self.output, phase + "-" + name.replace(".", "-"), {"raw": row[name]})
        row["toNs"] = str(time.monotonic_ns())
        self.acquisition.save(self.output, phase, row)
        return row

    def enable_memory(self, fd, phase):
        row = self.observe(fd, phase + "-before")
        available, enabled = controllers(row["cgroup.controllers"]), controllers(row["cgroup.subtree_control"])
        if (row["cgroup.type"] != "domain\n" or row["cgroup.procs"] != ""
                or "memory" not in available or not set(enabled) <= set(available)):
            raise ValueError("Empty delegated domain unavailable")
        if "memory" not in enabled:
            self.recheck()
            control = os.open("cgroup.subtree_control", os.O_WRONLY | os.O_CLOEXEC | os.O_NOFOLLOW, dir_fd=fd)
            try:
                if os.write(control, b"+memory") != 7:
                    raise ValueError("Incomplete accounting enable")
            finally:
                os.close(control)
        after = self.observe(fd, phase + "-after")
        if (after["cgroup.type"] != "domain\n" or after["cgroup.procs"] != ""
                or controllers(after["cgroup.controllers"]) != available
                or set(controllers(after["cgroup.subtree_control"])) != set(enabled) | {"memory"}):
            raise ValueError("Accounting enable not observed")

    def create_root(self):
        if self.state != "new":
            raise ValueError("Root construction is one-shot")
        self.state = "failed"
        self.enable_memory(self.held.fds[5], "owned-unit")
        self.create_directory("run", self.held.fds[5])
        self.state = "root"

    def create_directory(self, name, parent):
        self.recheck()
        os.mkdir(name, mode=0o755, dir_fd=parent)
        fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW, dir_fd=parent)
        self.fds.append(fd)
        self.identities.append(self.snapshot(fd))
        self.recheck()

    def create_probe(self):
        if self.state != "root":
            raise ValueError("Probe construction requires the original root and is one-shot")
        self.state = "failed"
        self.enable_memory(self.fds[0], "owned-run")
        self.create_directory("probe", self.fds[0])
        row = self.observe(self.fds[-1], "owned-target-initial")
        if (row["cgroup.type"] != "domain\n" or row["cgroup.procs"] != ""
                or "memory" not in controllers(row["cgroup.controllers"])
                or controllers(row["cgroup.subtree_control"])
                or row["cgroup.events"] != "populated 0\nfrozen 0\n"):
            raise ValueError("Fresh empty target unavailable")
        self.state = "complete"
        return row

    def close(self):
        self.state = "closed"
        errors = []
        while self.fds:
            try:
                os.close(self.fds.pop())
            except OSError as error:
                errors.append(error)
        self.identities.clear()
        if errors:
            raise errors[0]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
