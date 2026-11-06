"""Own exactly one Docker object created by this attempt; never discover workloads."""
import http.client
import json
import os
from pathlib import Path
import re
import signal
import socket
import time
import traceback
import uuid


def save(path, value):
    with Path(path).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    descriptor = os.open(Path(path).parent, os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def error_record(error):
    return {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}


class APIError(RuntimeError):
    pass


class UnixConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


class API:
    def __init__(self, journal):
        self.journal = journal

    def request(self, method, route, body=None, accepted=(200,)):
        began = time.monotonic()
        record = {'method': method, 'route': route, 'began': began, 'status': None}
        connection = UnixConnection('localhost', timeout=5)
        def timed_out(number, frame):
            raise TimeoutError('Docker API call exceeded five seconds.')
        previous_alarm = signal.signal(signal.SIGALRM, timed_out)
        signal.setitimer(signal.ITIMER_REAL, 5)
        try:
            data = None if body is None else json.dumps(body).encode()
            connection.request(method, '/v1.55' + route, body=data,
                               headers={'Content-Type': 'application/json'} if data else {})
            response = connection.getresponse()
            raw = response.read(1024 * 1024 + 1)
            record.update(status=response.status, bytes=len(raw))
            if len(raw) > 1024 * 1024:
                raise APIError('Docker response exceeds one MiB.')
            record['response'] = json.loads(raw) if raw else None
            if response.status not in accepted:
                raise APIError(f'Docker {method} {route}: HTTP {response.status}: {raw.decode(errors="replace")}')
            return record['response']
        except Exception as error:
            record['error'] = error_record(error)
            raise
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, previous_alarm)
            connection.close()
            record['ended'] = time.monotonic()
            self.journal(record)


def specification(image, evidence, nonce, mode):
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', image):
        raise ValueError('Use the exact local image ID.')
    if mode not in ('normal', 'orphan', 'interrupt', 'browser'):
        raise ValueError('Unknown explicit control mode.')
    evidence = Path(evidence)
    if not evidence.is_absolute() or evidence.resolve() != evidence or not evidence.is_dir():
        raise ValueError('Evidence must be a fresh canonical directory.')
    return {
        'Image': image, 'User': '1000:1000', 'WorkingDir': '/opt/workbench',
        'Entrypoint': ['/usr/local/bin/python3', '-I', '-S', '-B',
                       '/opt/workbench/scripts/loredock-container-browser/init.py'],
        'Cmd': [mode], 'Env': ['PATH=/opt/node:/usr/local/bin:/usr/bin:/bin', 'LC_ALL=C',
                               'HOME=/evidence/owner/run/home'],
        'Labels': {'aew.task': '147', 'aew.attempt': nonce},
        'AttachStdin': False, 'OpenStdin': False, 'Tty': False, 'StopSignal': 'SIGTERM',
        'HostConfig': {
            'CapDrop': ['ALL'], 'CapAdd': [], 'Privileged': False,
            'SecurityOpt': ['no-new-privileges', 'apparmor=docker-default'], 'ReadonlyRootfs': True,
            'NetworkMode': 'none', 'PidMode': '', 'IpcMode': 'private', 'CgroupnsMode': 'private',
            'RestartPolicy': {'Name': 'no', 'MaximumRetryCount': 0}, 'AutoRemove': False,
            'ShmSize': 67108864, 'LogConfig': {'Type': 'none', 'Config': {}},
            'Mounts': [{'Type': 'bind', 'Source': str(evidence), 'Target': '/evidence',
                        'ReadOnly': False, 'BindOptions': {'Propagation': 'rprivate', 'CreateMountpoint': False}}],
        },
    }


def verify_inspect(value, expected, identifier, require_created=False, require_applied=True):
    if not re.fullmatch('[0-9a-f]{64}', identifier) or value.get('Id') != identifier:
        raise ValueError('Container identity mismatch.')
    if value.get('Image') != expected['Image']:
        raise ValueError('Container image mismatch.')
    config, host = value['Config'], value['HostConfig']
    for key in ('Image', 'User', 'WorkingDir', 'Entrypoint', 'Cmd', 'Labels', 'OpenStdin', 'Tty', 'StopSignal'):
        if config.get(key) != expected[key]:
            raise ValueError('Container config mismatch: ' + key)
    actual_env = dict(item.split('=', 1) for item in config['Env'])
    for item in expected['Env']:
        key, wanted = item.split('=', 1)
        if actual_env.get(key) != wanted:
            raise ValueError('Container environment mismatch: ' + key)
    if set(actual_env) - {'PATH', 'LC_ALL', 'HOME', 'PYTHON_VERSION', 'PYTHON_SHA256'}:
        raise ValueError('Unexpected container environment.')
    if actual_env.get('PYTHON_VERSION') != '3.14.4':
        raise ValueError('Unexpected Python image version.')
    for key, wanted in expected['HostConfig'].items():
        if key == 'Mounts':
            continue
        actual = host.get(key)
        if key == 'CapAdd' and actual is None:
            actual = []
        if actual != wanted:
            raise ValueError('Container host configuration mismatch: ' + key)
    for key in ('Binds', 'VolumesFrom', 'Devices', 'DeviceRequests', 'PortBindings', 'Links', 'Tmpfs', 'CapAdd'):
        if host.get(key):
            raise ValueError('Unexpected host capability or mount: ' + key)
    for key in ('Memory', 'MemorySwap', 'MemoryReservation', 'NanoCpus', 'CpuQuota', 'CpuPeriod', 'PidsLimit'):
        if host.get(key) not in (None, 0):
            raise ValueError('Unexpected pressure limit: ' + key)
    if host.get('CpusetCpus') or host.get('CpusetMems') or host.get('Init'):
        raise ValueError('Unexpected CPU restriction or injected init.')
    if config.get('Volumes') or config.get('ExposedPorts') or config.get('Healthcheck'):
        raise ValueError('Unexpected image mounts, ports or healthcheck.')
    mounts = value.get('Mounts', [])
    if len(mounts) != 1:
        raise ValueError('Unexpected container mount count.')
    mount = mounts[0]
    if any(mount.get(key) != wanted for key, wanted in {
        'Type': 'bind', 'Source': expected['HostConfig']['Mounts'][0]['Source'],
        'Destination': '/evidence', 'RW': True, 'Propagation': 'rprivate',
    }.items()):
        raise ValueError('Container evidence mount mismatch.')
    state = value['State']
    if require_created and (state.get('Status') != 'created' or state.get('Running') or state.get('Pid') != 0):
        raise ValueError('New container was already started.')
    if require_applied:
        unstarted = (state.get('Status') == 'created' and not state.get('Running') and state.get('Pid') == 0
                     and str(state.get('StartedAt', '')).startswith('0001-'))
        allowed = ('', 'docker-default') if unstarted else ('docker-default',)
        if value.get('AppArmorProfile') not in allowed:
            raise ValueError('Unexpected applied AppArmor profile at this lifecycle state.')
    return state


class Owner:
    def __init__(self, api, directory, expected, clock=time.monotonic, sleep=time.sleep,
                 interrupted=lambda: False, wall_seconds=160, cleanup_seconds=15):
        self.api, self.directory, self.expected = api, Path(directory), expected
        self.clock, self.sleep, self.interrupted = clock, sleep, interrupted
        self.wall_seconds, self.cleanup_seconds = wall_seconds, cleanup_seconds
        self.identifier = None
        self.verified = False
        self.report = {'createdId': None, 'verifiedBeforeStart': False, 'startAttempts': 0,
                       'stoppedConfirmed': False, 'errors': [], 'terminal': None,
                       'removed': False, 'resourceQualification': False}

    def inspect(self, require_applied=True):
        value = self.api.request('GET', f'/containers/{self.identifier}/json')
        verify_inspect(value, self.expected, self.identifier, require_applied=require_applied)
        return value

    def terminal(self, value):
        state = value['State']
        if state.get('Status') not in ('exited', 'dead', 'created') or state.get('Running') or state.get('Pid') != 0:
            return False
        self.report.update(stoppedConfirmed=True, terminal=value)
        return True

    def cleanup(self):
        if not self.verified:
            return
        deadline = self.clock() + self.cleanup_seconds
        # Even a failed inspect cannot widen authority beyond this previously verified ID.
        try:
            if self.terminal(self.inspect(require_applied=False)):
                return
        except Exception as error:
            self.report['errors'].append(error_record(error))
        for name, until in [('SIGTERM', deadline), ('SIGKILL', deadline + 5)]:
            try:
                self.api.request('POST', f'/containers/{self.identifier}/kill?signal={name}', accepted=(204, 409))
            except Exception as error:
                self.report['errors'].append(error_record(error))
            while self.clock() < until:
                try:
                    if self.terminal(self.inspect(require_applied=False)):
                        return
                except Exception as error:
                    self.report['errors'].append(error_record(error))
                    break
                self.sleep(0.1)

    def run(self):
        began = self.clock()
        save(self.directory / 'intent.json', self.expected)
        try:
            if self.interrupted():
                raise InterruptedError('Interrupted before container creation.')
            response = self.api.request('POST', '/containers/create?platform=linux%2Famd64',
                                        self.expected, accepted=(201,))
            identifier = response.get('Id')
            if not isinstance(identifier, str) or not re.fullmatch('[0-9a-f]{64}', identifier):
                raise ValueError('Create returned no unambiguous full ID; no start is authorized.')
            self.identifier = identifier
            self.report['createdId'] = identifier
            save(self.directory / 'created.json', response)
            value = self.api.request('GET', f'/containers/{identifier}/json')
            verify_inspect(value, self.expected, identifier, require_created=True)
            save(self.directory / 'verified-before-start.json', value)
            self.verified = self.report['verifiedBeforeStart'] = True
            if response.get('Warnings'):
                raise ValueError('Create reported warnings; stop before start.')
            if self.interrupted():
                raise InterruptedError('Interrupted before container start.')
            self.report['startAttempts'] = 1
            self.api.request('POST', f'/containers/{identifier}/start', accepted=(204,))
            while True:
                value = self.inspect()
                if self.terminal(value):
                    state = value['State']
                    if state['Status'] != 'exited' or not state.get('StartedAt') or state['StartedAt'].startswith('0001-'):
                        raise RuntimeError('No actual container execution is confirmed.')
                    if state.get('OOMKilled') or state.get('Error'):
                        raise RuntimeError('Container runtime reports an execution failure.')
                    break
                if self.interrupted():
                    raise InterruptedError('Host controller interrupted.')
                if self.clock() - began >= self.wall_seconds:
                    raise TimeoutError('Container wall deadline exceeded.')
                self.sleep(0.1)
        except Exception as error:
            self.report['errors'].append(error_record(error))
        finally:
            if not self.report['stoppedConfirmed']:
                self.cleanup()
            self.report['elapsedMs'] = (self.clock() - began) * 1000
            save(self.directory / 'host-result.json', self.report)
        return self.report


def launch(image, output, mode):
    output = Path(output)
    if not output.is_absolute() or output.resolve() != output:
        raise ValueError('Choose a canonical exclusive output path.')
    output.mkdir(mode=0o700)
    evidence = output / 'evidence'
    evidence.mkdir(mode=0o700)
    interrupted = []
    previous = {}
    for number in (signal.SIGINT, signal.SIGTERM):
        previous[number] = signal.signal(number, lambda number, frame: interrupted.append(number))
    try:
        with (output / 'api.jsonl').open('x', encoding='utf-8') as stream:
            def journal(value):
                stream.write(json.dumps(value) + '\n')
                stream.flush()
                os.fsync(stream.fileno())
            expected = specification(image, evidence, str(uuid.uuid4()), mode)
            return Owner(API(journal), output, expected, interrupted=lambda: bool(interrupted)).run()
    finally:
        for number, handler in previous.items():
            signal.signal(number, handler)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--mode', choices=('normal', 'orphan', 'interrupt', 'browser'), required=True)
    args = parser.parse_args()
    result = launch(args.image, args.output, args.mode)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result['stoppedConfirmed'] and not result['errors']
                     and result['terminal']['State']['ExitCode'] == 0 else 1)
