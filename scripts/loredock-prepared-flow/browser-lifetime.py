"""Attribute one browser lifetime through a dedicated kernel child-subreaper.

The outer evaluation owner remains the only wall/storage watchdog. This collector
retains browser/adopted-child wait4 records and reuses the owner's scoped cleanup.
"""
import argparse
import importlib.util
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import types

spec = importlib.util.spec_from_file_location("kernel_owner", Path(__file__).with_name("kernel-owner.py"))
kernel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kernel)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--executable", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--parent-pid", type=int, required=True)
    parser.add_argument("--grace-ms", type=int, default=10000)
    parser.add_argument("browser_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
        parser.error("Use python3 -I -S -B for the isolated lifetime collector.")
    if not args.output.is_absolute() or args.output != args.output.resolve():
        parser.error("Choose a canonical absolute output path.")
    if not args.executable.is_absolute() or not args.executable.is_file() or not os.access(args.executable, os.X_OK):
        parser.error("Choose an existing absolute browser executable.")
    if not 0 < args.grace_ms <= 10000:
        parser.error("Cleanup grace must be positive and at most 10000 ms.")
    if args.parent_pid <= 0:
        parser.error("Choose the actual positive launcher PID.")
    if args.browser_args[:1] == ["--"]:
        args.browser_args.pop(0)
    args.output.mkdir(mode=0o700)
    return args


def run(args):
    # Owner.run/sample are not used: only the outer evaluation owns global limits.
    owner = kernel.Owner(types.SimpleNamespace(output=args.output, wall_ms=2400000,
                                               storage_bytes=2147483648, grace_ms=args.grace_ms))
    report = owner.report
    report["schemaVersion"] = "prepared-flow-browser-lifetime/1"
    report["role"] = "browser-lifetime-collector"
    report["globalLimitsOwner"] = "external-evaluation-watchdog"
    report["cleanupLimits"] = {"graceMs": args.grace_ms, "forcedExitWaitMs": 5000}
    del report["limits"], report["peakSampledStorageBytes"]
    parent = kernel.identity(os.getppid())
    report["parent"] = parent
    report["expectedParentPid"] = args.parent_pid

    def interrupt(number, _frame):
        owner.interruption = "collector-" + signal.Signals(number).name

    signal.signal(signal.SIGINT, interrupt)
    signal.signal(signal.SIGTERM, interrupt)
    try:
        owner.bootstrap()
        current_parent = kernel.identity(os.getppid())
        if parent is None or parent["pid"] != args.parent_pid or current_parent is None or kernel.key(parent) != kernel.key(current_parent):
            report["reason"] = "parent-exited-before-launch"
            return report
        env = {name: os.environ[name] for name in ["PATH", "LC_ALL", "HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"] if name in os.environ}
        env["LC_ALL"] = "C"
        command = [str(args.executable), *args.browser_args]
        kernel.save(args.output / "command.json", {"args": command, "env": env,
                    "resolvedExecutable": str(args.executable.resolve()), "cwd": str(Path.cwd())})
        with (args.output / "stdout.log").open("xb") as stdout, (args.output / "stderr.log").open("xb") as stderr:
            owner.driver = subprocess.Popen(command, env=env, stdin=subprocess.DEVNULL,
                                            stdout=stdout, stderr=stderr, start_new_session=True)
        owner.log.append({"event": "browser-started", "pid": owner.driver.pid})
        while report["reason"] is None:
            owner.descendants()
            owner.reap()
            current_parent = kernel.identity(os.getppid())
            if owner.interruption:
                report["reason"] = owner.interruption
            elif current_parent is None or kernel.key(parent) != kernel.key(current_parent):
                report["reason"] = "parent-exited"
            elif report["driverExit"] is not None:
                report["remainingAtBrowserExit"] = owner.descendants()
                report["reason"] = "completed" if report["driverExit"]["exit"] == 0 else "browser-failure"
            if report["reason"] is None:
                time.sleep(0.05)
    except Exception as error:
        report["errors"].append(kernel.error_record(error))
        report["reason"] = "collector-failure"
    finally:
        try:
            owner.cleanup()
            owner.reap()
            report["survivors"] = owner.descendants()
        except Exception as error:
            report["errors"].append(kernel.error_record(error))
        report["elapsedMs"] = (time.monotonic() - owner.began) * 1000
        report["peakMeaning"] = "OS wait4 child resource counters for the browser and adopted children reaped here; no exclusive per-PID usage or simultaneous whole-tree peak is inferred. Other descendants remain subject to passive sampling."
        owner.log.append({"event": "finished", "reason": report["reason"], "survivors": report["survivors"]})
        owner.log.close()
        owner.samples.close()
        kernel.save(args.output / "result.json", report)
    return report


if __name__ == "__main__":
    outcome = run(arguments())
    sys.exit(0 if outcome["reason"] == "completed" and not outcome["errors"] and not outcome["survivors"] else 1)
