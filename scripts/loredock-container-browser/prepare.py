"""Stage an exclusive, explicit public-runtime build context without host configuration."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path('/home/toshiba/aew/task145-image-inputs-first')
BROWSER = Path('/home/toshiba/aew/toolchain/task143-chrome-for-testing-157.0.8103.38/chrome-linux64')
NODE = Path('/home/toshiba/aew/toolchain/node-v22.23.2-linux-x64/bin/node')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT)
    previous = json.loads((ROOT / 'scripts/loredock-browser-eligibility/manifest.json').read_text())
    assert digest(NODE) == '3517c2df0b2f8cd7f422b4b8450ef81c6889f08eb03e281d6de9079b15e6a327'
    files = previous['installedFiles']
    assert sorted(row['path'] for row in files) == sorted(str(path.relative_to(BROWSER)) for path in BROWSER.rglob('*') if path.is_file())
    for row in files:
        assert digest(BROWSER / row['path']) == row['sha256']
    OUTPUT.mkdir(mode=0o700)
    context = OUTPUT / 'context'; context.mkdir()
    shutil.copytree(BROWSER, context / 'chrome', symlinks=False)
    shutil.copy2(NODE, context / 'node')
    names = ['scripts/loredock-prepared-flow/' + name for name in
             ['browser.mjs', 'io.mjs', 'ownership.mjs', 'process-tree.mjs', 'browser-evidence.mjs', 'kernel-owner.py', 'browser-lifetime.py']]
    names += ['scripts/loredock-browser-eligibility/' + name for name in ['verify.mjs', 'assess.mjs', 'plan.mjs']]
    names += [str(path.relative_to(ROOT)) for path in sorted((ROOT / 'scripts/loredock-container-browser').iterdir()) if path.is_file()]
    inputs = []
    for name in names:
        source = ROOT / name; target = context / 'workbench' / name
        target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(source, target)
        inputs.append({'path': name, 'bytes': source.stat().st_size, 'sha256': digest(source)})
    manifest = {'candidate': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'nodeSha256': digest(NODE), 'browserFiles': files, 'scripts': inputs,
                'browserVersion': '157.0.8103.38', 'nominalCadenceMs': 50, 'actualMaximumGapMs': 100,
                'rssLimitBytes': 1073741824, 'resourceQualification': False}
    (context / 'workbench/control-inputs.json').write_text(json.dumps(manifest, indent=2) + '\n')
    shutil.copy2(ROOT / 'scripts/loredock-container-browser/Dockerfile', context / 'Dockerfile')
    inventory = []
    for path in sorted(context.rglob('*')):
        if path.is_file():
            assert not path.is_symlink()
            inventory.append({'path': str(path.relative_to(context)), 'bytes': path.stat().st_size, 'sha256': digest(path)})
    (OUTPUT / 'inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
    print(json.dumps({'output': str(OUTPUT), 'files': len(inventory), 'bytes': sum(row['bytes'] for row in inventory), 'candidate': manifest['candidate']}))


if __name__ == '__main__':
    main()
