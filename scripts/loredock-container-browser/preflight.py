"""One exclusive set of actual non-browser container lifecycle prerequisites."""
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path('/home/toshiba/aew/task147-container-preflight-first')
INPUTS = Path('/home/toshiba/aew/task147-image-inputs-first/context/workbench/control-inputs.json')
spec = importlib.util.spec_from_file_location('container_owner', Path(__file__).with_name('owner.py'))
owner = importlib.util.module_from_spec(spec); spec.loader.exec_module(owner)
spec = importlib.util.spec_from_file_location('applied_security', Path(__file__).with_name('security.py'))
security = importlib.util.module_from_spec(spec); spec.loader.exec_module(security)


def validate_inputs(receipt, raw):
    manifest = json.loads(raw)
    assert receipt['verified'] is True and receipt['version'] == manifest['version'] == 'container-runtime-inputs/1'
    assert receipt['manifestSha256'] == hashlib.sha256(raw).hexdigest()
    assert receipt['uid'] == receipt['gid'] == 1000 and receipt['nodeVersion'] == '22.23.2'
    assert receipt['browserFiles'] == len(manifest['browserFiles']) and receipt['scriptFiles'] == len(manifest['scripts'])
    assert sorted(receipt['browserDirectories'], key=lambda row: row['path']) == manifest['browserDirectories']
    assert receipt['browserParents'] == manifest['browserParents']


def main(image):
    assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT)
    OUTPUT.mkdir(mode=0o700)
    report = {'image': image, 'candidate': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'cases': [], 'failure': None, 'browserRuns': 0, 'resourceQualification': False}
    try:
        for mode in ['normal', 'orphan', 'interrupt']:
            directory = OUTPUT / mode
            if mode == 'interrupt':
                with (OUTPUT / 'interrupt-controller.stdout.log').open('xb') as stdout, (OUTPUT / 'interrupt-controller.stderr.log').open('xb') as stderr:
                    child = subprocess.Popen([sys.executable, '-I', '-S', '-B', str(Path(__file__).with_name('owner.py')),
                                              '--image', image, '--output', str(directory), '--mode', mode],
                                             cwd=ROOT, stdout=stdout, stderr=stderr, stdin=subprocess.DEVNULL,
                                             env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'LC_ALL': 'C'})
                deadline = time.monotonic() + 30
                try:
                    while not (directory / 'evidence/owner/run/ready').exists():
                        if child.poll() is not None or time.monotonic() > deadline:
                            raise RuntimeError('Interruption probe did not become ready.')
                        time.sleep(0.05)
                    child.send_signal(signal.SIGTERM)
                    assert child.wait(timeout=45) == 1
                finally:
                    if child.poll() is None:
                        child.send_signal(signal.SIGTERM)
                        child.wait(timeout=180)
                result = json.loads((directory / 'host-result.json').read_text())
                assert len(result['errors']) == 1 and result['errors'][0]['type'] == 'InterruptedError'
            else:
                result = owner.launch(image, directory, mode)
                assert not result['errors'], result['errors']
            wrapper = json.loads((directory / 'evidence/wrapper-result.json').read_text())
            assert result['verifiedBeforeStart'] and result['startAttempts'] == 1 and result['stoppedConfirmed']
            assert result['terminal']['State']['ExitCode'] == 0
            assert wrapper['reason'] == 'completed' and not wrapper['errors']
            applied = json.loads((directory / 'evidence/applied-security.json').read_text())
            assert wrapper['appliedSecurity'] == security.validate(**applied)
            inputs = json.loads((directory / 'evidence/owner/run/input-verification.json').read_text())
            validate_inputs(inputs, INPUTS.read_bytes())
            if mode == 'interrupt':
                assert wrapper['interruptionForwarded']
            report['cases'].append({'mode': mode, 'containerId': result['createdId'], 'passed': True,
                                    'host': result, 'wrapper': wrapper})
    except BaseException as error:
        report['failure'] = owner.error_record(error)
    finally:
        owner.save(OUTPUT / 'result.json', report)
    print(json.dumps(report, indent=2))
    return 0 if not report['failure'] and len(report['cases']) == 3 else 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1]))
