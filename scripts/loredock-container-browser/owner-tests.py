"""Synthetic Docker API failures: no Docker socket or workload is accessed."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('container_owner', Path(__file__).with_name('owner.py'))
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)
spec = importlib.util.spec_from_file_location('applied_security', Path(__file__).with_name('security.py'))
security = importlib.util.module_from_spec(spec)
spec.loader.exec_module(security)
IDENTIFIER = 'a' * 64


class FakeAPI:
    def __init__(self, expected, directory, failure=None):
        self.expected, self.directory, self.failure = expected, directory, failure
        self.calls, self.running, self.started, self.signals = [], False, False, []

    def request(self, method, route, body=None, accepted=(200,)):
        self.calls.append((method, route))
        if route.startswith('/containers/create?'):
            if self.failure == 'create':
                raise TimeoutError('Create response was lost.')
            return {'Id': IDENTIFIER, 'Warnings': []}
        assert route.startswith('/containers/' + IDENTIFIER + '/')
        if route.endswith('/start'):
            assert (self.directory / 'created.json').is_file()
            assert (self.directory / 'verified-before-start.json').is_file()
            self.running = self.started = True
            if self.failure == 'start':
                raise TimeoutError('Start response was lost after execution began.')
            if self.failure not in ('interrupt', 'unavailable', 'runtime-profile', 'missing-runtime-profile'):
                self.running = False
            return None
        if '/kill?' in route:
            self.signals.append(route.split('signal=')[1])
            if self.failure == 'unavailable':
                raise ConnectionError('Daemon is unavailable.')
            if self.signals[-1] == 'SIGKILL' or self.failure == 'start':
                self.running = False
            return None
        assert route.endswith('/json')
        if self.failure == 'unavailable' and self.started:
            raise ConnectionError('Daemon is unavailable.')
        config = {key: copy.deepcopy(value) for key, value in self.expected.items() if key != 'HostConfig'}
        config['Env'].append('PYTHON_VERSION=3.14.4')
        if self.failure == 'config':
            config['User'] = '0:0'
        mount = self.expected['HostConfig']['Mounts'][0]
        status = 'running' if self.running else 'exited' if self.started else 'created'
        if self.failure == 'not-started':
            status = 'created'
        return {'Id': IDENTIFIER, 'Image': self.expected['Image'], 'Config': config,
                'HostConfig': copy.deepcopy(self.expected['HostConfig']),
                'AppArmorProfile': ('unconfined' if self.failure == 'created-profile' or self.started and self.failure == 'runtime-profile'
                                    else None if self.started and self.failure == 'missing-runtime-profile'
                                    else 'docker-default' if self.started else ''),
                'Mounts': [{'Type': 'bind', 'Source': mount['Source'], 'Destination': '/evidence', 'RW': True, 'Propagation': 'rprivate'}],
                'State': {'Status': status, 'Running': self.running, 'Pid': 42 if self.running else 0,
                          'ExitCode': 0, 'StartedAt': '2026-11-06T00:00:00Z' if self.started else '0001-01-01T00:00:00Z',
                          'OOMKilled': False, 'Error': ''}}


class Ownership(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp(prefix='aew-container-owner-'))
        print('Retained synthetic owner fixture:', self.directory)
        evidence = self.directory / 'evidence'; evidence.mkdir()
        self.expected = owner.specification('sha256:' + 'b' * 64, evidence, 'owned-nonce', 'normal')
        self.now = 0

    def run_case(self, failure=None):
        api = FakeAPI(self.expected, self.directory, failure)
        def sleep(seconds):
            self.now += seconds
        result = owner.Owner(api, self.directory, self.expected, clock=lambda: self.now, sleep=sleep,
                             interrupted=lambda: failure == 'interrupt' and api.started,
                             wall_seconds=1, cleanup_seconds=0.2).run()
        return api, result

    def test_normal(self):
        api, result = self.run_case()
        self.assertEqual(self.expected['HostConfig']['SecurityOpt'], ['no-new-privileges', 'apparmor=docker-default'])
        self.assertTrue(result['stoppedConfirmed']); self.assertEqual(result['errors'], [])
        self.assertEqual(result['startAttempts'], 1); self.assertFalse(api.signals)

    def test_ambiguous_create(self):
        api, result = self.run_case('create')
        self.assertEqual(len(api.calls), 1); self.assertIsNone(result['createdId'])
        self.assertFalse(result['stoppedConfirmed']); self.assertTrue(result['errors'])

    def test_configuration_mismatch(self):
        api, result = self.run_case('config')
        self.assertEqual(result['startAttempts'], 0); self.assertFalse(result['verifiedBeforeStart'])
        self.assertFalse(api.signals); self.assertTrue(result['errors'])

    def test_persistence_failure(self):
        (self.directory / 'created.json').write_text('Never overwrite this receipt.')
        api, result = self.run_case()
        self.assertEqual(len(api.calls), 1); self.assertFalse(result['verifiedBeforeStart'])
        self.assertEqual((self.directory / 'created.json').read_text(), 'Never overwrite this receipt.')

    def test_ambiguous_start(self):
        api, result = self.run_case('start')
        self.assertEqual(result['startAttempts'], 1); self.assertEqual(api.signals, ['SIGTERM'])
        self.assertTrue(result['stoppedConfirmed']); self.assertTrue(result['errors'])
        self.assertEqual(sum(route.endswith('/start') for _, route in api.calls), 1)

    def test_interruption(self):
        api, result = self.run_case('interrupt')
        self.assertEqual(api.signals, ['SIGTERM', 'SIGKILL']); self.assertTrue(result['stoppedConfirmed'])
        self.assertTrue(result['errors']); self.assertLess(result['elapsedMs'], 6000)

    def test_unavailable_daemon(self):
        api, result = self.run_case('unavailable')
        self.assertFalse(result['stoppedConfirmed']); self.assertTrue(result['errors'])
        self.assertEqual(api.signals, ['SIGTERM', 'SIGKILL'])

    def test_no_execution_receipt(self):
        api, result = self.run_case('not-started')
        self.assertTrue(result['stoppedConfirmed']); self.assertTrue(result['errors'])

    def test_created_profile(self):
        api, result = self.run_case('created-profile')
        self.assertEqual(result['startAttempts'], 0); self.assertTrue(result['errors'])
        self.assertFalse(api.signals)

    def test_runtime_profile(self):
        api, result = self.run_case('runtime-profile')
        self.assertEqual(result['startAttempts'], 1); self.assertTrue(result['errors'])
        self.assertEqual(api.signals, ['SIGTERM', 'SIGKILL']); self.assertTrue(result['stoppedConfirmed'])

    def test_missing_runtime_profile(self):
        api, result = self.run_case('missing-runtime-profile')
        self.assertEqual(result['startAttempts'], 1); self.assertTrue(result['errors'])
        self.assertTrue(result['stoppedConfirmed'])


class AppliedSecurity(unittest.TestCase):
    def setUp(self):
        self.status = '\n'.join(['Uid:\t1000 1000 1000 1000', 'Gid:\t1000 1000 1000 1000',
                                 'Seccomp:\t2', 'NoNewPrivs:\t1'] +
                                [name + ':\t0000000000000000' for name in ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']])

    def test_enforced_default(self):
        value = security.validate('docker-default (enforce)\n', self.status, 1000, 1000)
        self.assertTrue(value['verified']); self.assertEqual(value['seccomp'], 2)

    def test_missing_or_wrong_profile(self):
        for label in ['', 'unconfined', 'docker-default (complain)', 'another-profile (enforce)', None]:
            with self.subTest(label=label), self.assertRaises(ValueError):
                security.validate(label, self.status, 1000, 1000)

    def test_missing_or_relaxed_restriction(self):
        for before, after in [('Seccomp:\t2', 'Seccomp:\t0'), ('NoNewPrivs:\t1', 'NoNewPrivs:\t0'),
                              ('CapEff:\t0000000000000000', 'CapEff:\t0000000000000001'),
                              ('CapBnd:\t0000000000000000', ''), ('Uid:\t1000 1000 1000 1000', 'Uid:\t1000 0 0 0')]:
            with self.subTest(field=before), self.assertRaises(ValueError):
                security.validate('docker-default (enforce)', self.status.replace(before, after), 1000, 1000)
        with self.assertRaises(ValueError):
            security.validate('docker-default (enforce)', self.status + '\nSeccomp:\t2', 1000, 1000)


class LaunchInputs(unittest.TestCase):
    def test_changed_or_redirected_inputs(self):
        spec = importlib.util.spec_from_file_location('container_launch', Path(__file__).with_name('launch.py'))
        launch = importlib.util.module_from_spec(spec); spec.loader.exec_module(launch)
        root = Path(tempfile.mkdtemp(prefix='aew-container-launch-inputs-'))
        print('Retained launch-input fixture:', root)
        file = root / 'input'; file.write_bytes(b'original')
        row = {'path': 'input', 'bytes': 8, 'sha256': hashlib.sha256(b'original').hexdigest()}
        launch.checked(root, [row])
        file.write_bytes(b'modified')
        with self.assertRaises(AssertionError): launch.checked(root, [row])
        file.write_bytes(b'original')
        with self.assertRaises(AssertionError): launch.checked(root, [row, row])
        with self.assertRaises(AssertionError): launch.checked(root, [{**row, 'path': '../input'}])
        (root / 'link').symlink_to(file)
        with self.assertRaises(AssertionError): launch.checked(root, [{**row, 'path': 'link'}])


if __name__ == '__main__':
    unittest.main()
