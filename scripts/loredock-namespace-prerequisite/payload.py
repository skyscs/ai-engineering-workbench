"""Fixed synthetic namespace probe; never a resource qualification workload."""
import json
import os
from pathlib import Path

NAMESPACES = ("user", "mnt", "pid", "net", "ipc", "uts", "cgroup")


def main():
    status = {}
    for line in Path("/proc/self/status").read_text().splitlines():
        name, _, value = line.partition(":")
        if name in ("Uid", "Gid", "CapInh", "CapPrm", "CapEff", "CapAmb", "NoNewPrivs", "Seccomp"):
            status[name] = value.strip()
    descriptors = {}
    for name in os.listdir("/proc/self/fd"):
        try:
            descriptors[name] = os.readlink("/proc/self/fd/" + name)
        except FileNotFoundError:
            # listdir's own directory descriptor has already closed.
            continue
    hidden = {path: not os.path.exists(path) for path in
              ("/home", "/run/user", "/sys/fs/cgroup", "/proc/1/root/home")}
    denied = None
    try:
        fd = os.open("/probe/canary", os.O_WRONLY | os.O_CLOEXEC)
        os.close(fd)
    except OSError as error:
        denied = error.errno
    nested_userns_errno = None
    try:
        os.unshare(os.CLONE_NEWUSER)
    except OSError as error:
        nested_userns_errno = error.errno
    allocation = bytearray(1048576)
    for offset in range(0, len(allocation), 4096):
        allocation[offset] = 1
    result = {
        "schemaVersion": "loredock-namespace-payload/1",
        "uid": os.getuid(), "gid": os.getgid(), "pid": os.getpid(),
        "namespaces": {name: os.readlink("/proc/self/ns/" + name) for name in NAMESPACES},
        "status": status, "descriptors": descriptors, "hiddenPaths": hidden,
        "readOnlyErrno": denied, "nestedUsernsErrno": nested_userns_errno,
        "allocationBytes": len(allocation), "touchedPages": sum(allocation),
        "environmentKeys": sorted(os.environ),
    }
    print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
