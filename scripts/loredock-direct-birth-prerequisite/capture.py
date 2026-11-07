"""Bounded native capture with a durable collector callback before the execution permit."""
import os
import selectors
import subprocess
import time

MAX_STREAM = 65536
MAX_BIRTH_LINE = 4096


def capture_native(command, target_fd, acknowledge, *, timeout=5, env=None):
    start = time.monotonic_ns()
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               env=env, close_fds=True, pass_fds=(target_fd,), start_new_session=True)
    outputs = {"stdout": bytearray(), "stderr": bytearray()}
    failure, acknowledged, first_line_done = None, False, False
    def close_input():
        try:
            process.stdin.close()
        except OSError:
            # A failed permit write is already recorded; a dead reader needs no retry.
            pass
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
                    if key.data == "stdout" and not first_line_done and not failure:
                        pending = bytes(outputs["stdout"])
                        newline = pending.find(b"\n")
                        if (newline < 0 and len(pending) > MAX_BIRTH_LINE) or newline > MAX_BIRTH_LINE:
                            failure = "BIRTH_RECORD_BOUND"
                            first_line_done = True
                            close_input()
                        elif newline >= 0:
                            first_line_done = True
                            try:
                                acknowledge(pending[:newline].decode("utf-8"), start, time.monotonic_ns())
                                # The callback must return only after validation and durable publication.
                                process.stdin.write(b"A")
                                process.stdin.flush()
                                acknowledged = True
                            except Exception as error:
                                failure = "BIRTH_NOT_ACKNOWLEDGED:" + type(error).__name__
                            finally:
                                close_input()
                if failure and time.monotonic_ns() - start > (timeout + 2) * 1000000000:
                    for key in list(selector.get_map().values()):
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                    break
    except (Exception, KeyboardInterrupt) as error:
        failure = failure or "COLLECTOR_INTERRUPTED:" + type(error).__name__
    finally:
        if not process.stdin.closed:
            close_input()
        if process.poll() is None:
            process.kill()
        code = process.wait(timeout=2)
        process.stdout.close()
        process.stderr.close()
    return {"command": command, "exitCode": code, "failure": failure, "acknowledged": acknowledged,
            "startedAtNs": str(start), "endedAtNs": str(time.monotonic_ns()),
            **{name: bytes(value).decode("utf-8", errors="replace") for name, value in outputs.items()}}
