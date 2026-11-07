"""Ordinary temporary files and mocked kernel/service/native records; no live prerequisite."""
from contextlib import ExitStack
import base64
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).parent


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


probe = load(HERE / 'probe.py', 'counter_probe')
counters = load(HERE / 'counters.py', 'counter_admission')
previous = load(HERE.parent / 'loredock-empty-controller-prerequisite/test_probe.py', 'leaf_fixtures')
files = load(HERE.parent / 'loredock-held-counters/test_reader.py', 'counter_fixtures')
reader, acquisition, protocol, support = files.reader, previous.acquisition, previous.protocol, previous.support
leaf_module, prior = previous.leaf_module, previous.prior
RUN, HASH = prior.RUN, prior.HASH
UNIT = 'loredock-task159-' + RUN + '.service'


class KernelDouble(previous.KernelDouble):
    def __init__(self, *, initial=None, role=None):
        super().__init__()
        self.initial, self.role = initial or {}, role or {}

    def mkdir(self, name, mode=0o777, *, dir_fd=None):
        if dir_fd is not None and name in ('daemon', 'browser'):
            parent = Path(os.readlink('/proc/self/fd/' + str(dir_fd)))
            assert parent == self.root / 'run'
            self.original_mkdir(name, mode, dir_fd=dir_fd)
            self.populate(parent / name, {**previous.RETAINED['owned-target-initial'], **self.role})
        else:
            super().mkdir(name, mode, dir_fd=dir_fd)
        if dir_fd is not None and name in ('run', 'daemon', 'browser'):
            path = Path(os.readlink('/proc/self/fd/' + str(dir_fd))) / name
            for interface, raw in files.VALUES.items():
                if interface.startswith('memory.'):
                    (path / interface).write_bytes(raw)
            for interface, raw in self.initial.get(name, {}).items():
                if raw is None:
                    (path / interface).unlink()
                else:
                    (path / interface).write_bytes(raw)


def exercise(kernel, *, final=None, failed_wait=False, fail_save=None, replaced=False, bad_mount=False):
    output = kernel.output
    manifest = {'runId': RUN, 'output': str(output), 'unit': UNIT, 'uid': os.getuid(), 'gid': os.getgid(),
                'files': {'native': {'path': '/sealed/native'}}}
    acquisition.retain(str(output) + '.claim', {'manifestSha256': HASH, 'unit': UNIT})
    acquisition.save(output, 'manager-initial', {'command': {'exitCode': 0, 'failure': None},
        'properties': {'Id': UNIT, 'LoadState': 'not-found', 'ActiveState': 'inactive',
                       'MainPID': '0', 'InvocationID': '', 'ControlGroup': ''}})
    acquisition.save(output, 'expected-subject', {'bootId': files.BOOT, 'clockId': files.CLOCK})
    _, _, _, _, owner = prior.fixture()
    owner = {**owner, 'group': '/sys/fs/cgroup/owned'}
    fake_support = SimpleNamespace(sandbox_command=lambda _: ['/usr/bin/bwrap', 'fixed'],
                                   assess_payload=support.assess_payload)
    original_read, original_save = acquisition.read_bounded, acquisition.save
    proc_inputs, calls = {}, []
    mount = reader.descriptor_identity(kernel.unit_fd)
    def read(path, maximum=acquisition.MAX_RECORD, **kwargs):
        if str(path).startswith('/proc/321/'):
            return proc_inputs[str(path)].encode()
        if str(path) == '/proc/self/mountinfo':
            options = 'rw,nsdelegate' + ('' if bad_mount else ',memory_hugetlb_accounting')
            return f"{mount['mountId']} 1 {mount['device']} / /sys/fs/cgroup rw - cgroup2 cgroup2 {options}\n".encode()
        return original_read(path, maximum, **kwargs)
    def save(path, name, value):
        if name == fail_save:
            raise OSError('Invented durable publication failure')
        original_save(path, name, value)
    def native(command, fd, callback, *, timeout, env):
        assert json.loads((output / 'counter-initial-assessment.json').read_text())['status'] == 'PASS'
        assert (output / 'counter-initial.json').exists()
        assert timeout == 5 and env == {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}
        assert command[1] == str(fd) and command[4:7] == ['/owned/run/probe', '/owned/attestor', '--']
        assert Path(os.readlink('/proc/self/fd/' + str(fd))).name == 'probe'
        calls.append(command)
        info = os.fstat(fd)
        result, _, birth, independent, _ = prior.fixture()
        start = time.monotonic_ns()
        birth.update(uid=os.getuid(), gid=os.getgid(), device=str(info.st_dev), inode=str(info.st_ino),
                     fromNs=str(start), observedNs=str(start + 1))
        target = kernel.root / 'run/probe'
        (target / 'cgroup.procs').write_text('321\n')
        proc_inputs['/proc/321/stat'] = independent['processStatRaw']
        proc_inputs['/proc/321/cgroup'] = independent['placementRaw']
        proc_inputs['/proc/321/status'] = independent['statusRaw'].replace(
            'Uid:\t1000\t1000\t1000\t1000', 'Uid:\t' + '\t'.join([str(os.getuid())] * 4)).replace(
            'Gid:\t1000\t1000\t1000\t1000', 'Gid:\t' + '\t'.join([str(os.getgid())] * 4))
        callback(json.dumps(birth), start, time.monotonic_ns())
        assert json.loads((output / 'pre-exec-observation.json').read_text())['retainedBeforeAck']
        _, payload = prior.fixtures.fixture()
        payload.update(uid=os.getuid(), gid=os.getgid())
        end = json.loads(result['stdout'].splitlines()[-1])
        end['toNs'] = str(time.monotonic_ns())
        if failed_wait:
            end.update(exitCode=1, waited=False)
        (target / 'cgroup.procs').write_text('')
        (kernel.root / 'run/memory.peak').write_bytes(b'500\n')
        for role, changes in (final or {}).items():
            for interface, raw in changes.items():
                path = kernel.root / 'run' / (role if role != 'run' else '') / interface
                if raw is None:
                    path.unlink()
                else:
                    path.write_bytes(raw)
        if replaced:
            (kernel.root / 'run/browser').rename(kernel.root / 'run/old-browser')
            kernel.original_mkdir(kernel.root / 'run/browser')
        result.update(stdout='\n'.join(json.dumps(row) for row in (birth, payload, end)) + '\n',
                      startedAtNs=str(start), endedAtNs=str(time.monotonic_ns()))
        return result
    class HeldContext:
        def __enter__(self):
            return kernel.held
        def __exit__(self, *_):
            pass
    with patch.object(acquisition, 'HeldDirectories', return_value=HeldContext()), patch.object(
            probe, 'acquire', return_value=owner), patch.object(acquisition, 'read_bounded', side_effect=read), patch.object(
            acquisition, 'save', side_effect=save):
        code = probe.service(manifest, HASH, acquisition, fake_support, Mock(), protocol,
                             SimpleNamespace(capture_native=native), leaf_module, reader, counters)
    records = {path.name: path.read_text() for path in output.iterdir()}
    return code, calls, manifest, records


class IntegrationTests(unittest.TestCase):
    def test_complete_mocked_service_retains_two_batches_after_wait(self):
        with KernelDouble() as kernel:
            before = files.fds()
            code, calls, _, records = exercise(kernel)
            self.assertEqual(code, 0, records.get('service-error.json'))
            self.assertEqual(len(calls), 1)
            self.assertEqual(files.fds(), before)
            receipt = json.loads(records['memory-receipt.json'])
            lifetime = json.loads(records['counter-lifetime.json'])
            self.assertTrue(receipt['run']['allExited'])
            self.assertEqual(receipt['run']['firstChildAtNs'], lifetime['creationLowerBoundNs'])
            self.assertEqual(receipt['run']['lastExitAtNs'], lifetime['waitUpperBoundNs'])
            self.assertEqual(receipt['scopes']['run']['final']['raw']['memory.peak'], '500\n')
            self.assertEqual(receipt['scopes']['daemon']['final']['raw']['memory.peak'], '0\n')
            self.assertLessEqual(int(receipt['run']['lastExitAtNs']),
                                 int(receipt['scopes']['daemon']['final']['window']['fromNs']))
            self.assertLessEqual(int(receipt['scopes']['run']['final']['window']['toNs']),
                                 int(receipt['run']['retainedAtNs']))
            retention = json.loads(records['counter-retention.json'])
            self.assertEqual(retention['memoryReceiptSha256'], hashlib.sha256(records['memory-receipt.json'].encode()).hexdigest())
            for row in json.loads(records['counter-raw-inventory.json']):
                self.assertTrue(row['present'])
                self.assertEqual(row['sha256'], hashlib.sha256(records[row['path']].encode()).hexdigest())
            self.assertFalse(json.loads(records['outside-attestor-observation.json'])['applicationMeasurement'])
            kernel.assert_closed(self)

    def test_missing_nonzero_or_malformed_initial_counter_prevents_native(self):
        for change in ({'memory.peak': None}, {'memory.current': b'1\n'}, {'memory.events': b'oom 0\n'},
                       {'memory.swap.peak': b'01\n'}, {'cgroup.events': b'populated 1\nfrozen 0\n'}):
            with self.subTest(change=change), KernelDouble(initial={'run': change}) as kernel:
                code, calls, _, records = exercise(kernel)
                self.assertEqual(code, 1)
                self.assertEqual(calls, [])
                self.assertNotIn('native-command.json', records)

    def test_role_admission_rejects_malformed_available_or_populated_scope(self):
        for change in ({'cgroup.controllers': 'memory memory\n'}, {'cgroup.controllers': 'memory\tpids\n'},
                       {'cgroup.controllers': ''}, {'cgroup.procs': '321\n'}, {'cgroup.subtree_control': 'memory\n'}):
            with self.subTest(change=change), KernelDouble(role=change) as kernel:
                before = files.fds()
                code, calls, _, records = exercise(kernel)
                self.assertEqual((code, calls), (1, []))
                self.assertIn('service-error.json', records)
                self.assertEqual(files.fds(), before)

    def test_missing_existing_mount_mode_prevents_native(self):
        with KernelDouble() as kernel:
            code, calls, _, records = exercise(kernel, bad_mount=True)
            self.assertEqual((code, calls), (1, []))
            self.assertIn('counter-initial-mount.json', records)

    def test_initial_retention_failure_never_creates_child(self):
        for name in ('counter-initial', 'counter-initial-assessment', 'native-command'):
            with self.subTest(name=name), KernelDouble() as kernel:
                code, calls, _, records = exercise(kernel, fail_save=name)
                self.assertEqual((code, calls), (1, []))
                self.assertIn('service-error.json', records)

    def test_partial_final_preserves_other_fields_and_prevents_complete_exit_claim(self):
        with KernelDouble() as kernel:
            code, calls, _, records = exercise(kernel, final={'browser': {'memory.swap.peak': None}})
            self.assertEqual((code, len(calls)), (1, 1))
            row = json.loads(records['counter-final.json'])['observations']['browser']
            self.assertNotIn('memory.swap.peak', row['snapshot']['raw'])
            self.assertEqual(row['snapshot']['raw']['memory.peak'], '0\n')
            self.assertTrue(row['reads']['memory.swap.peak']['errors'])
            self.assertFalse(json.loads(records['memory-receipt.json'])['run']['allExited'])

    def test_replaced_role_retains_final_errors_and_other_scope_bytes(self):
        with KernelDouble() as kernel:
            code, calls, _, records = exercise(kernel, replaced=True)
            self.assertEqual((code, len(calls)), (1, 1))
            row = json.loads(records['counter-final.json'])
            self.assertTrue(row['observations']['browser']['errors'])
            self.assertEqual(row['observations']['run']['snapshot']['raw']['memory.peak'], '500\n')

    def test_failed_wait_cannot_supply_last_exit(self):
        with KernelDouble() as kernel:
            code, calls, _, records = exercise(kernel, failed_wait=True)
            self.assertEqual((code, len(calls)), (1, 1))
            run = json.loads(records['memory-receipt.json'])['run']
            self.assertFalse(run['allExited'])
            self.assertIsNone(run['lastExitAtNs'])

    def test_late_retention_failure_keeps_raw_receipt_for_offline_diagnosis(self):
        with KernelDouble() as kernel:
            code, calls, _, records = exercise(kernel, fail_save='counter-retention')
            self.assertEqual((code, len(calls)), (1, 1))
            self.assertIn('memory-receipt.json', records)
            self.assertIn('counter-raw-inventory.json', records)
            self.assertNotIn('counter-retention.json', records)

    def test_claim_and_entry_prevent_reuse(self):
        with KernelDouble() as kernel:
            code, _, manifest, _ = exercise(kernel)
            self.assertEqual(code, 0)
            fake = Mock()
            with self.assertRaises(FileExistsError):
                probe.service(manifest, HASH, acquisition, fake, fake, fake, fake, fake, fake, fake)
            with self.assertRaises(FileExistsError):
                probe.run_first(manifest, 'manifest', HASH, acquisition, fake)
            fake.manager_state.assert_not_called()


class BoundaryTests(unittest.TestCase):
    def test_admission_rejects_changed_identity_bytes_order_and_incomplete_read(self):
        with files.Fixture() as fixture, fixture.open() as held:
            original, expected = held.capture(), counters.bindings(held)
            self.assertEqual(counters.assess_capture(original, expected, initial=True)['status'], 'PASS')
            mutations = [lambda row: row['snapshot']['identity'].update(inode='999'),
                         lambda row: row['snapshot']['window'].update(fromNs='999999'),
                         lambda row: row['reads']['memory.peak'].update(complete=False),
                         lambda row: row['reads']['memory.peak'].update(bytesBase64='MQo='),
                         lambda row: row['reads']['memory.peak']['identity'].update(inode='999'),
                         lambda row: row['errors'].append({'kind': 'fixture'})]
            for mutate in mutations:
                changed = copy.deepcopy(original)
                mutate(changed['observations']['daemon'])
                self.assertEqual(counters.assess_capture(changed, expected, initial=True)['status'], 'UNAVAILABLE')

    def test_held_counter_descriptors_are_excluded_from_native_capture_child(self):
        with files.Fixture() as fixture, fixture.open() as held:
            target = fixture.fds['run']
            command = ['/usr/bin/python3', '-I', '-B', '-c',
                'import os,sys,json; print("{}",flush=True); sys.stdin.read(1); f=[]\n'
                'for n in os.listdir("/proc/self/fd"):\n'
                ' try: os.fstat(int(n)); f.append(int(n))\n'
                ' except OSError: pass\n'
                'print(json.dumps(sorted(f)),flush=True)']
            result = prior.capture.capture_native(command, target, lambda *_: None)
            self.assertIsNone(result['failure'])
            self.assertEqual(json.loads(result['stdout'].splitlines()[1]), sorted([0, 1, 2, target]))
            for fd in held.owned:
                os.fstat(fd)

    def test_mount_binding_and_existing_modes_are_strict(self):
        expected = {'mountId': '48', 'device': '0:30'}
        raw = '48 46 0:30 / /sys/fs/cgroup rw - cgroup2 cgroup2 rw,memory_hugetlb_accounting'
        self.assertEqual(counters.mount_environment([raw], expected)['eventsMode'], 'hierarchical')
        for records in ([], [raw, raw], [raw.replace('48 ', '49 ', 1)], [raw.replace('0:30', '0:31')],
                        [raw + ',memory_localevents'], [raw + ',rw'], [raw.replace('rw -', 'ro -')],
                        [raw.replace(',memory_hugetlb_accounting', '')]):
            with self.assertRaises(ValueError):
                counters.mount_environment(records, expected)

    def test_canonical_unicode_receipt_is_exclusive_bounded_and_fsynced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'receipt.json'
            value = {'raw': 'oom 1\ninvalidé 0\n'}
            original = os.fsync
            with patch.object(os, 'fsync', wraps=original) as synced:
                counters.retain_receipt(path, value, acquisition)
            self.assertEqual(synced.call_count, 2)
            self.assertEqual(path.read_bytes(), json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode())
            with self.assertRaises(FileExistsError):
                counters.retain_receipt(path, value, acquisition)
            with self.assertRaises(ValueError):
                counters.retain_receipt(Path(directory) / 'large.json', {'x': 'x' * acquisition.MAX_RECORD}, acquisition)

    def test_receipt_fsync_failure_is_not_reported_as_success(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(os, 'fsync', side_effect=OSError('Invented fsync failure')), self.assertRaises(OSError):
                counters.retain_receipt(Path(directory) / 'receipt.json', {'raw': '0\n'}, acquisition)

    def test_accepted_inputs_stay_exact(self):
        originals = {'leaf': 'loredock-empty-controller-prerequisite/leaf.py',
                     'nativeSource': 'loredock-native-capability-prerequisite/native.c',
                     'capture': 'loredock-direct-birth-prerequisite/capture.py',
                     'protocol': 'loredock-direct-birth-prerequisite/protocol.py',
                     'counterReader': 'loredock-held-counters/reader.py'}
        for key, path in originals.items():
            self.assertEqual(acquisition.digest(HERE.parent / path), probe.SHARED[key])


def emit_fixtures():
    output = {}
    scenarios = {'valid': {}, 'missing-final': {'final': {'browser': {'memory.swap.peak': None}}},
        'breach-and-missing': {'final': {'run': {'memory.peak': b'1476395009\n'}, 'browser': {'memory.swap.peak': None}}},
        'unicode-and-breach': {'final': {'run': {'memory.events': files.VALUES['memory.events'].replace(b'oom 0', b'oom 1') + 'invalidé 0\n'.encode()}}},
        'failed-wait': {'failed_wait': True}, 'lost-retention': {'fail_save': 'counter-retention'},
        'breach-lost-retention': {'final': {'run': {'memory.peak': b'1476395009\n'}}, 'fail_save': 'counter-retention'}}
    for name, options in scenarios.items():
        with KernelDouble() as kernel:
            code, calls, _, records = exercise(kernel, **options)
            output[name] = {'code': code, 'calls': len(calls), 'records': records, 'syntheticLifecycle': True}
    print(json.dumps(output, separators=(',', ':'), ensure_ascii=False))


if __name__ == '__main__':
    if sys.argv[1:] == ['--emit-fixtures']:
        emit_fixtures()
    else:
        unittest.main(verbosity=2)
