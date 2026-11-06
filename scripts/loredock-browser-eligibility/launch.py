"""Freeze exact inputs and launch the one prospective ordinary browser owner."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

repo = Path(__file__).resolve().parents[2]
inputs = Path('/home/toshiba/aew/task143-browser-inputs-first')
output = Path('/home/toshiba/aew/task143-browser-first')
assert not output.exists()
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=repo, text=True)
subprocess.run(['git', 'diff', '--exit-code', '98dc39ec6f407a929e1b46219bf45905950c87eb', '--',
    'apps', 'packages', 'fixtures', 'scripts/loredock-prepared-flow', 'scripts/loredock-browser-memory', 'pnpm-lock.yaml'], cwd=repo, check=True)
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
manifest = json.loads((repo / 'scripts/loredock-browser-eligibility/manifest.json').read_text())


def digest(file):
    with file.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def inventory(directory):
    return [{'path': str(file.relative_to(directory)), 'bytes': file.stat().st_size, 'sha256': digest(file)}
            for file in sorted(directory.rglob('*')) if file.is_file()]


def save(file, value):
    with file.open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')


for row in manifest['scripts']:
    assert digest(repo / row['path']) == row['sha256']
assert digest(Path(manifest['node']['executable'])) == manifest['node']['sha256']
assert digest(Path(manifest['browser']['archive'])) == manifest['browser']['archiveSha256']
browser_root = Path(manifest['browser']['executable']).parent
for row in manifest['installedFiles']:
    assert digest(browser_root / row['path']) == row['sha256']
inputs.mkdir()
names = [row['path'] for row in manifest['scripts']] + ['scripts/loredock-browser-eligibility/manifest.json',
    'scripts/tests/loredock-browser-eligibility.test.mjs', 'docs/loredock/PINNED_BROWSER_ELIGIBILITY.md',
    'tasks/143-loredock-pinned-browser-eligibility.md', 'package.json', 'pnpm-lock.yaml']
for name in names:
    target = inputs / 'repository' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(repo / name, target)
installed = browser_root.parent
for file in installed.iterdir():
    if file.is_file() and file.name != 'chrome-linux64.zip':
        target = inputs / 'installation' / file.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
shutil.copyfile('/home/toshiba/aew/task143-install-browser.py', inputs / 'installation/installer.py')
python = Path(sys.executable).resolve()
node = Path(manifest['node']['executable'])
args = [str(python), '-I', '-S', '-B', str(repo / 'scripts/loredock-prepared-flow/kernel-owner.py'),
    '--node', str(node), '--script', str(repo / 'scripts/loredock-browser-eligibility/observe.mjs'),
    '--output', str(output), '--cwd', str(repo), '--wall-ms', '120000', '--storage-bytes', '2147483648', '--grace-ms', '10000']
environment = {'PATH': str(node.parent) + ':/usr/bin:/bin', 'LC_ALL': 'C'}
save(inputs / 'launch.json', {'candidate': head, 'args': args, 'environment': environment,
    'python': {'executable': str(python), 'sha256': digest(python), 'version': sys.version},
    'browserBinaryRetention': 'The immutable local vendor archive and installation remain at manifest paths; committed records retain their full hashes/inventory, not duplicate binary payloads.',
    'resourceQualification': False})
before = inventory(inputs)
save(Path('/home/toshiba/aew/task143-first-input-inventory.json'), before)
began = time.monotonic()
with Path('/home/toshiba/aew/task143-owner-first.stdout.log').open('xb') as stdout, Path('/home/toshiba/aew/task143-owner-first.stderr.log').open('xb') as stderr:
    result = subprocess.run(args, cwd=repo, env=environment, stdout=stdout, stderr=stderr)
after = inventory(inputs)
assert before == after
record = {'candidate': head, 'ownerExit': result.returncode, 'wallMs': (time.monotonic() - began) * 1000,
    'inputFiles': len(before), 'inputsUnchanged': True, 'resourceQualification': False}
save(Path('/home/toshiba/aew/task143-first-launch-result.json'), record)
print(json.dumps(record))
sys.exit(result.returncode)
