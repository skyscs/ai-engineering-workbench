"""Consume one declared Task 146 blank lifetime only after exact successful prerequisites."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
BASE = Path('/home/toshiba/aew')
OUTPUT = BASE / 'task146-container-browser-first'
PREFLIGHT = BASE / 'task146-container-preflight-first'
INPUTS = BASE / 'task146-image-inputs-first'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked(root, rows):
    names = set()
    for row in rows:
        relative = Path(row['path'])
        assert not relative.is_absolute() and '..' not in relative.parts and relative.as_posix() == row['path']
        assert row['path'] not in names
        names.add(row['path'])
        file = root / relative
        assert file.resolve() == file and file.is_file() and not file.is_symlink()
        assert file.stat().st_size == row['bytes'] and digest(file) == row['sha256'], file


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


def main():
    assert sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode
    assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT)
    manifest_path = Path(__file__).with_name('manifest.json')
    manifest = json.loads(manifest_path.read_text())
    assert manifest['task'] == 146 and manifest['output'] == str(OUTPUT)
    assert manifest['hostPython']['executable'] == sys.executable
    assert digest(Path(sys.executable)) == manifest['hostPython']['sha256']
    checked(ROOT, manifest['hostFiles']); checked(INPUTS / 'context', manifest['stagedFiles'])
    checked(PREFLIGHT, manifest['preflightFiles'])
    source = json.loads((PREFLIGHT / 'result.json').read_text())
    assert source['image'] == manifest['image']['Id'] and source['failure'] is None
    assert [case['mode'] for case in source['cases']] == ['normal', 'orphan', 'interrupt']
    security = module('security')
    for case in source['cases']:
        assert case['passed'] and case['host']['stoppedConfirmed'] and case['host']['startAttempts'] == 1
        assert case['host']['terminal']['State']['ExitCode'] == 0
        wrapper = case['wrapper']
        assert wrapper['reason'] == 'completed' and not wrapper['errors']
        raw = json.loads((PREFLIGHT / case['mode'] / 'evidence/applied-security.json').read_text())
        assert wrapper['appliedSecurity'] == security.validate(**raw)
    owner = module('owner')
    image_records = []
    api = owner.API(image_records.append)
    image = api.request('GET', '/images/' + manifest['image']['Id'] + '/json')
    for key in ['Id', 'Architecture', 'Os', 'Config', 'RootFS']:
        assert image[key] == manifest['image'][key], key
    # A durable exclusive claim prevents a second attempt even if create/start becomes ambiguous.
    owner.save(BASE / 'task146-container-browser-first.claim', {
        'manifestSha256': digest(manifest_path), 'image': image['Id'],
        'candidate': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    })
    began = time.monotonic()
    report = {'image': image['Id'], 'failure': None, 'host': None, 'wrapper': None,
              'browser': None, 'inputsUnchanged': False, 'eligible': False, 'resourceQualification': False}
    try:
        report['host'] = owner.launch(image['Id'], OUTPUT, 'browser')
        assert report['host']['stoppedConfirmed'] and not report['host']['errors']
        report['wrapper'] = json.loads((OUTPUT / 'evidence/wrapper-result.json').read_text())
        raw = json.loads((OUTPUT / 'evidence/applied-security.json').read_text())
        assert report['wrapper']['appliedSecurity'] == security.validate(**raw)
        report['browser'] = json.loads((OUTPUT / 'evidence/owner/run/result.json').read_text())
        inner = json.loads((OUTPUT / 'evidence/owner/result.json').read_text())
        assert not inner['errors'] and not inner['survivors'] and inner['subreaper']
        report['eligible'] = (report['host']['terminal']['State']['ExitCode'] == 0
                              and report['wrapper']['reason'] == 'completed' and not report['wrapper']['errors']
                              and report['browser']['failure'] is None and report['browser']['inputsUnchanged']
                              and report['browser']['assessment']['eligible'])
    except BaseException as error:
        report['failure'] = owner.error_record(error)
    finally:
        try:
            checked(ROOT, manifest['hostFiles']); checked(INPUTS / 'context', manifest['stagedFiles'])
            checked(PREFLIGHT, manifest['preflightFiles'])
            assert digest(Path(sys.executable)) == manifest['hostPython']['sha256']
            report['inputsUnchanged'] = True
        except BaseException as error:
            report['failure'] = report['failure'] or owner.error_record(error)
        report['eligible'] = report['eligible'] and report['inputsUnchanged'] and report['failure'] is None
        report['elapsedMs'] = (time.monotonic() - began) * 1000
        report['imageInspectRequests'] = image_records
        owner.save(BASE / 'task146-browser-launch-first.json', report)
    print(json.dumps(report, indent=2))
    return 0 if report['eligible'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
