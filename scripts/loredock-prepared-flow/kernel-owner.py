"""Linux-only external owner for retained, model-free prepared-flow evaluations.

Run in a separate interpreter with -I -S. Only kernel descendant relationships
authorize signals; files, executable names and ports never confer ownership.
"""
import argparse
import ctypes
import errno
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import time
import traceback


def identity(pid):
    try:
        text = Path(f"/proc/{pid}/stat").read_text()
        fields = text[text.rindex(")") + 2:].split()
        return {"pid": pid, "state": fields[0], "parent": int(fields[1]),
                "group": int(fields[2]), "started": fields[19]}
    except (FileNotFoundError, ProcessLookupError):
        return None


def key(row):
    return (row["pid"], row["started"])


def children(pid):
    found = set()
    try:
        # Child processes can be created by any thread, including Chrome workers.
        for task in Path(f"/proc/{pid}/task").iterdir():
            try:
                found.update(int(value) for value in (task / "children").read_text().split())
            except (FileNotFoundError, ProcessLookupError):
                pass
    except (FileNotFoundError, ProcessLookupError):
        pass
    return found


def error_record(error):
    return {"type": type(error).__name__, "message": str(error),
            "errno": getattr(error, "errno", None), "traceback": traceback.format_exc()}


class Journal:
    def __init__(self, path):
        self.file = path.open("x", encoding="utf-8")

    def append(self, value):
        self.file.write(json.dumps({"monotonic": time.monotonic(), **value}) + "\n")
        self.file.flush()
        os.fsync(self.file.fileno())

    def close(self):
        self.file.close()


def save(path, value):
    with path.open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())


class Owner:
    def __init__(self, args):
        self.args, self.pid, self.began = args, os.getpid(), time.monotonic()
        self.log = Journal(args.output / "owner.jsonl")
        self.samples = Journal(args.output / "storage.jsonl")
        self.driver = None
        self.known = {}
        self.interruption = None
        self.report = {"schemaVersion": "prepared-flow-kernel-owner/1", "reason": None,
                       "errors": [], "driverExit": None, "owned": [], "reaped": [],
                       "survivors": [], "peakSampledStorageBytes": 0, "subreaper": False,
                       "limits": {"wallMs": args.wall_ms, "storageBytes": args.storage_bytes,
                                  "graceMs": args.grace_ms, "forcedExitWaitMs": 5000},
                       "resourceQualification": False}

    def remember(self, row):
        token = key(row)
        if token not in self.known:
            self.known[token] = dict(row)
            self.report["owned"].append(self.known[token])
            self.log.append({"event": "discovered", "identity": row})
        return row

    def descendants(self):
        result, seen = [], set()
        pending = [identity(self.pid)]
        while pending:
            parent = pending.pop()
            if parent is None or key(parent) in seen:
                continue
            seen.add(key(parent))
            candidates = children(parent["pid"])
            current = identity(parent["pid"])
            if current is None or key(current) != key(parent):
                continue
            for pid in candidates:
                row = identity(pid)
                if row and row["parent"] in (parent["pid"], self.pid):
                    if key(row) not in seen:
                        result.append(self.remember(row))
                        pending.append(row)
        return result

    def in_scope(self, pid):
        seen = set()
        while pid > 1 and pid not in seen:
            if pid == self.pid:
                return True
            seen.add(pid)
            row = identity(pid)
            if row is None:
                return False
            pid = row["parent"]
        return False

    def send(self, row, name):
        if row["pid"] == self.pid:
            raise RuntimeError("The external owner cannot signal itself.")
        try:
            descriptor = os.pidfd_open(row["pid"], 0)
        except ProcessLookupError:
            return
        try:
            current = identity(row["pid"])
            if not current or key(current) != key(row) or current["state"] in ("Z", "X"):
                return
            if not self.in_scope(current["pid"]):
                self.log.append({"event": "signal-refused-outside-scope", "identity": current})
                return
            self.log.append({"event": "signal", "identity": current, "signal": name.name, "via": "pidfd"})
            signal.pidfd_send_signal(descriptor, name, None, 0)
        except ProcessLookupError:
            pass
        finally:
            os.close(descriptor)

    def reap(self):
        while True:
            try:
                pid, status, usage = os.wait4(-1, os.WNOHANG)
            except ChildProcessError:
                return
            if not pid:
                return
            row = {"pid": pid, "waitStatus": status, "exit": os.waitstatus_to_exitcode(status),
                   "userSeconds": usage.ru_utime, "systemSeconds": usage.ru_stime,
                   "maxRssBytes": usage.ru_maxrss * 1024}
            self.report["reaped"].append(row)
            self.log.append({"event": "reaped", **row})
            if self.driver and pid == self.driver.pid:
                self.driver.returncode = row["exit"]
                self.report["driverExit"] = row

    def storage(self):
        total, entries, raced = 0, 0, 0
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
        pending = [os.open(self.args.output, flags)]
        try:
            while pending:
                directory = pending.pop()
                try:
                    iterator = os.scandir(directory)
                    with iterator:
                        for entry in iterator:
                            entries += 1
                            if entries > 200000:
                                raise RuntimeError("Owned storage metadata exceeds 200000 entries.")
                            try:
                                value = entry.stat(follow_symlinks=False)
                                if stat.S_ISDIR(value.st_mode):
                                    pending.append(os.open(entry.name, flags, dir_fd=directory))
                                else:
                                    total += value.st_size
                            except OSError as error:
                                if error.errno not in (errno.ENOENT, errno.ENOTDIR, errno.ELOOP):
                                    raise
                                raced += 1
                            if self.interruption or time.monotonic() - self.began >= self.args.wall_ms / 1000:
                                return {"bytes": total, "entries": entries, "racedEntries": raced, "complete": False}
                finally:
                    os.close(directory)
        finally:
            for directory in pending:
                os.close(directory)
        return {"bytes": total, "entries": entries, "racedEntries": raced, "complete": True}

    def sample(self):
        value = self.storage()
        self.report["peakSampledStorageBytes"] = max(self.report["peakSampledStorageBytes"], value["bytes"])
        self.samples.append(value)
        if value["bytes"] >= self.args.storage_bytes:
            self.report["reason"] = "storage-ceiling"

    def bootstrap(self):
        if sys.platform != "linux" or not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
            raise RuntimeError("Linux with pidfd and Python 3.9+ support is required.")
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(36, ctypes.c_ulong(1), 0, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "PR_SET_CHILD_SUBREAPER failed")
        enabled = ctypes.c_int()
        if libc.prctl(37, ctypes.byref(enabled), 0, 0, 0) != 0 or enabled.value != 1:
            raise RuntimeError("The actual child-subreaper flag was not enabled.")
        descriptor = os.pidfd_open(self.pid, 0)
        try:
            signal.pidfd_send_signal(descriptor, 0, None, 0)
        finally:
            os.close(descriptor)
        self.report["subreaper"] = True
        self.log.append({"event": "subreaper-verified", "pid": self.pid, "python": sys.version,
                         "executable": sys.executable, "isolated": sys.flags.isolated, "noSite": sys.flags.no_site})

    def cleanup(self):
        began = time.monotonic()
        driver = next((row for row in self.descendants() if self.driver and row["pid"] == self.driver.pid), None)
        if driver:
            self.send(driver, signal.SIGSTOP)
        term_sent = set()
        deadline = began + self.args.grace_ms / 1000
        while True:
            rows = self.descendants()
            self.reap()
            live = [row for row in rows if row["state"] not in ("Z", "X") and (not driver or key(row) != key(driver))]
            for row in live:
                if key(row) not in term_sent:
                    self.send(row, signal.SIGTERM)
                    term_sent.add(key(row))
            if not live or time.monotonic() >= deadline:
                break
            time.sleep(0.025)
        if driver:
            self.send(driver, signal.SIGTERM)
            self.send(driver, signal.SIGCONT)
        # Keep discovery active: changed sessions and newly adopted orphans remain owned.
        force_at = deadline
        end = force_at + 5
        while True:
            rows = self.descendants()
            self.reap()
            if not rows and not children(self.pid):
                break
            for row in rows:
                if row["state"] in ("Z", "X"):
                    continue
                if time.monotonic() >= force_at:
                    self.send(row, signal.SIGKILL)
                elif key(row) not in term_sent:
                    self.send(row, signal.SIGTERM)
                    self.send(row, signal.SIGCONT)
                    term_sent.add(key(row))
            if time.monotonic() >= end:
                raise RuntimeError("Kernel-owned descendants survived bounded cleanup.")
            time.sleep(0.025)
        self.report["cleanupMs"] = (time.monotonic() - began) * 1000

    def run(self):
        def interrupt(number, _frame):
            self.interruption = "owner-" + signal.Signals(number).name

        signal.signal(signal.SIGINT, interrupt)
        signal.signal(signal.SIGTERM, interrupt)
        try:
            self.bootstrap()
            env = {"PATH": os.environ["PATH"], "LC_ALL": "C"}
            if "HOME" in os.environ:
                env["HOME"] = os.environ["HOME"]
            command = [str(self.args.node), str(self.args.script), str(self.args.output / "run"), *self.args.driver_args]
            save(self.args.output / "command.json", {"args": command, "env": env, "cwd": str(self.args.cwd)})
            self.log.append({"event": "started", "limits": self.report["limits"]})
            with (self.args.output / "stdout.log").open("xb") as stdout, (self.args.output / "stderr.log").open("xb") as stderr:
                self.driver = subprocess.Popen(command, cwd=self.args.cwd, env=env, stdin=subprocess.DEVNULL,
                                               stdout=stdout, stderr=stderr, start_new_session=True)
            self.log.append({"event": "driver-started", "pid": self.driver.pid})
            next_storage = 0
            while self.report["reason"] is None:
                rows = self.descendants()
                self.reap()
                now = time.monotonic()
                if self.interruption:
                    self.report["reason"] = self.interruption
                elif now - self.began >= self.args.wall_ms / 1000:
                    self.report["reason"] = "wall-ceiling"
                elif self.report["driverExit"] is not None:
                    live = [row for row in self.descendants() if row["state"] not in ("Z", "X")]
                    self.report["reason"] = "driver-left-owned-process" if live else (
                        "completed" if self.report["driverExit"]["exit"] == 0 else "driver-failure")
                if now >= next_storage:
                    self.sample()
                    next_storage = now + 1
                if self.report["reason"] is None:
                    time.sleep(0.05)
        except Exception as error:
            self.report["errors"].append(error_record(error))
            self.report["reason"] = "owner-failure"
        finally:
            try:
                self.cleanup()
            except Exception as error:
                self.report["errors"].append(error_record(error))
            try:
                self.reap()
                self.report["survivors"] = self.descendants()
                self.sample()
            except Exception as error:
                self.report["errors"].append(error_record(error))
            self.report["elapsedMs"] = (time.monotonic() - self.began) * 1000
            self.log.append({"event": "finished", "reason": self.report["reason"], "survivors": self.report["survivors"]})
            self.log.close()
            self.samples.close()
            save(self.args.output / "result.json", self.report)
        return self.report


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("node", "script", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--cwd", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--wall-ms", type=int, default=2400000)
    parser.add_argument("--storage-bytes", type=int, default=2147483648)
    parser.add_argument("--grace-ms", type=int, default=10000)
    parser.add_argument("driver_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if not sys.flags.isolated or not sys.flags.no_site:
        parser.error("Use python3 -I -S for the isolated external owner.")
    for name in ("node", "script", "output", "cwd"):
        value = getattr(args, name)
        if not value.is_absolute() or value != value.resolve():
            parser.error("Choose canonical absolute paths.")
    if not args.node.is_file() or not os.access(args.node, os.X_OK) or not args.script.is_file() or not args.cwd.is_dir():
        parser.error("The executable, script and working directory must exist.")
    for value, maximum in ((args.wall_ms, 2400000), (args.storage_bytes, 2147483648), (args.grace_ms, 10000)):
        if not 0 < value <= maximum:
            parser.error("Positive limits must not exceed the frozen ceilings.")
    if args.driver_args[:1] == ["--"]:
        args.driver_args.pop(0)
    args.output.mkdir(mode=0o700)
    return args


if __name__ == "__main__":
    outcome = Owner(arguments()).run()
    print(json.dumps(outcome, indent=2))
    sys.exit(0 if outcome["reason"] == "completed" and not outcome["errors"] and not outcome["survivors"] else 1)
