"""Pinned PID-1 wrapper; the frozen kernel owner must remain a non-PID-1 child."""
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import time

ROOT = Path('/opt/workbench')
EVIDENCE = Path('/evidence')


def write(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())


def snapshot():
    rows = []
    for entry in sorted(Path('/proc').iterdir(), key=lambda p: p.name):
        if not entry.name.isdigit():
            continue
        try:
            raw = (entry / 'stat').read_text()
            fields = raw[raw.rindex(')') + 2:].split()
            status = (entry / 'status').read_text()
            rss = next((int(line.split()[1]) * 1024 for line in status.splitlines() if line.startswith('VmRSS:')), None)
            rows.append({'pid': int(entry.name), 'parent': int(fields[1]), 'started': fields[19],
                         'state': fields[0], 'rssBytes': rss,
                         'argv': (entry / 'cmdline').read_bytes().decode(errors='replace').split('\0')})
        except (FileNotFoundError, ProcessLookupError) as error:
            rows.append({'pid': int(entry.name), 'unavailable': type(error).__name__})
    if len(rows) > 256:
        raise RuntimeError('Private namespace exceeds 256 observed processes.')
    return rows


def storage():
    total, entries = 0, 0
    for directory, directories, files in os.walk(EVIDENCE, followlinks=False):
        for name in files:
            path = Path(directory) / name
            try:
                value = path.lstat()
                if stat.S_ISREG(value.st_mode):
                    total += value.st_size
            except FileNotFoundError:
                pass
            entries += 1
            if entries > 200000:
                raise RuntimeError('Evidence metadata exceeds 200000 entries.')
    shm = os.statvfs('/dev/shm')
    return {'evidenceLogicalBytes': total, 'shmAllocatedBytes': (shm.f_blocks - shm.f_bfree) * shm.f_frsize,
            'metric': 'Evidence logical bytes plus private shm allocated bytes; sampled, not continuous.'}


def main(mode):
    assert os.getpid() == 1 and os.getuid() == os.getgid() == 1000
    assert sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode
    assert mode in ('normal', 'orphan', 'interrupt', 'browser')
    began = time.monotonic()
    interrupted = []
    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number, lambda number, frame: interrupted.append(number))
    target = 'observe.mjs' if mode == 'browser' else 'probe.mjs'
    command = ['/usr/local/bin/python3', '-I', '-S', '-B',
               str(ROOT / 'scripts/loredock-prepared-flow/kernel-owner.py'),
               '--node', '/opt/node/node', '--script', str(ROOT / 'scripts/loredock-container-browser' / target),
               '--cwd', str(ROOT), '--output', '/evidence/owner', '--wall-ms', '120000',
               '--storage-bytes', '2147483648', '--grace-ms', '10000', '--', mode]
    report = {'mode': mode, 'command': command, 'pid': os.getpid(), 'uid': os.getuid(),
              'ownerPid': None, 'ownerExit': None, 'errors': [], 'reason': None,
              'python': {'version': sys.version, 'sha256': hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()},
              'namespace': {name: os.readlink('/proc/self/ns/' + name) for name in ('pid', 'mnt', 'net', 'ipc', 'cgroup')},
              'resourceQualification': False}
    process = None
    descriptor = None
    try:
        with (EVIDENCE / 'inner-owner.stdout.log').open('xb') as stdout, (EVIDENCE / 'inner-owner.stderr.log').open('xb') as stderr:
            process = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr,
                                       env={'PATH': '/opt/node:/usr/local/bin:/usr/bin:/bin', 'LC_ALL': 'C',
                                            'HOME': '/evidence/owner/run/home'})
        report['ownerPid'] = process.pid
        assert process.pid > 1
        descriptor = os.pidfd_open(process.pid)
        sent = False
        with (EVIDENCE / 'namespace.jsonl').open('x') as journal:
            next_sample = 0
            while process.poll() is None:
                now = time.monotonic()
                if now >= next_sample:
                    usage = storage()
                    row = {'began': now, 'storage': usage, 'processes': snapshot(), 'ended': time.monotonic()}
                    journal.write(json.dumps(row) + '\n'); journal.flush(); os.fsync(journal.fileno())
                    next_sample = now + 0.5
                    if usage['evidenceLogicalBytes'] + usage['shmAllocatedBytes'] >= 2147483648:
                        report['reason'] = 'storage-ceiling'
                        interrupted.append(signal.SIGTERM)
                if interrupted and not sent:
                    signal.pidfd_send_signal(descriptor, signal.SIGTERM)
                    sent = True
                if now - began >= 150:
                    report['reason'] = 'wrapper-wall-ceiling'
                    raise TimeoutError('The inner owner did not exit within 150 seconds.')
                time.sleep(0.05)
        report['ownerExit'] = process.wait()
        report['interruptionForwarded'] = sent
        inner = json.loads((EVIDENCE / 'owner/result.json').read_text())
        assert inner['subreaper'] and not inner['errors'] and not inner['survivors']
        assert not report['reason'], report['reason']
        if mode in ('orphan', 'interrupt'):
            expected = 'driver-left-owned-process' if mode == 'orphan' else 'owner-SIGTERM'
            assert inner['reason'] == expected and report['ownerExit'] == 1
            leaf = json.loads((EVIDENCE / 'owner/run/leaf.json').read_text())
            assert any(row['pid'] == leaf['pid'] and row['exit'] == -9 for row in inner['reaped'])
            events = [json.loads(line) for line in (EVIDENCE / 'owner/owner.jsonl').read_text().splitlines()]
            assert any(row.get('event') == 'signal' and row.get('via') == 'pidfd'
                       and row['identity']['pid'] == leaf['pid'] for row in events)
        elif mode == 'browser' and report['ownerExit'] == 1 and inner['reason'] == 'driver-failure':
            report['reason'] = 'browser-control-failed'
        else:
            assert inner['reason'] == 'completed' and report['ownerExit'] == 0
        report['remaining'] = snapshot()
        assert all(row['pid'] == 1 for row in report['remaining'])
        report['reason'] = report['reason'] or 'completed'
    except BaseException as error:
        report['errors'].append({'type': type(error).__name__, 'message': str(error)})
        report['reason'] = report['reason'] or 'wrapper-failure'
    finally:
        if process is not None and process.poll() is None:
            # The recorded failure stays failed. PID 1 exiting closes the private namespace.
            report['ownerStillRunningAtWrapperExit'] = True
            if descriptor is not None:
                try:
                    signal.pidfd_send_signal(descriptor, signal.SIGKILL)
                    process.wait(timeout=5)
                except (OSError, subprocess.TimeoutExpired) as error:
                    report['errors'].append({'type': type(error).__name__, 'message': str(error)})
        if descriptor is not None:
            os.close(descriptor)
        report['elapsedMs'] = (time.monotonic() - began) * 1000
        write(EVIDENCE / 'wrapper-result.json', report)
    return 0 if report['reason'] == 'completed' and not report['errors'] else 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1]))
