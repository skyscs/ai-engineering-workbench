"""Data-only executable seal. Never imports the application or executes reserved sources.

create writes a new manifest and complete byte inventory after the code commit.
verify requires both committed artifacts and unchanged code, installation and host.
run verifies first, then execs exactly the externally owned command in that manifest.
"""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import stat
import subprocess
import sys

REPOSITORY = Path(__file__).resolve().parents[2]
WORKSPACE = Path('/home/toshiba/aew')
NODE = WORKSPACE / 'toolchain/node-v22.23.2-linux-x64/bin/node'
PYTHON = Path('/usr/bin/python3').resolve()
OUTPUT = WORKSPACE / 'task128-kiln-first'
CLAIM = WORKSPACE / 'task128-kiln-first.claim.json'
ENVIRONMENT = {'PATH': str(NODE.parent) + ':/usr/bin:/bin', 'LC_ALL': 'C', 'HOME': str(OUTPUT / 'home')}
LIMITS = {'wallMs': 2400000, 'storageBytes': 2147483648, 'catalogBytes': 536870912,
          'graceMs': 10000, 'forcedExitWaitMs': 5000}
SYSTEM_ROOTS = ['/usr/lib/x86_64-linux-gnu', '/usr/lib/python3.14', '/usr/lib/git-core',
                '/opt/google/chrome', '/usr/share/fonts', '/etc/fonts', '/etc/ld.so.cache',
                '/etc/os-release', '/usr/bin/python3', '/usr/bin/git', '/usr/bin/google-chrome',
                '/usr/bin/bash', '/usr/bin/sh', '/usr/bin/readlink', '/usr/bin/dirname',
                '/usr/bin/mkdir', '/usr/bin/touch', '/usr/bin/cat', '/usr/bin/env', '/lib64/ld-linux-x86-64.so.2']


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def execute(args):
    return subprocess.check_output([str(value) for value in args], cwd=REPOSITORY,
                                   env=ENVIRONMENT, stderr=subprocess.PIPE, timeout=180)


def git(*args):
    return execute(['/usr/bin/git', '-c', 'core.hooksPath=/dev/null', *args]).decode().strip()


def file_record(path):
    """Hash a stable regular file through a no-follow descriptor."""
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        before = os.fstat(descriptor)
        assert stat.S_ISREG(before.st_mode), str(path)
        digest, size = hashlib.sha256(), 0
        while chunk := os.read(descriptor, 1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
        after = os.fstat(descriptor)
        assert (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) == (
            after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns), str(path)
        assert size == before.st_size
        return {'kind': 'file', 'bytes': size, 'mode': stat.S_IMODE(before.st_mode), 'sha256': digest.hexdigest()}
    finally:
        os.close(descriptor)


def inventory(roots):
    """Keep directory membership and link text; include every existing resolved target."""
    result, pending = {}, [Path(value) for value in roots]
    while pending:
        path = pending.pop()
        key = str(path)
        assert path.is_absolute() and '..' not in path.parts
        if key in result:
            continue
        value = path.lstat()
        if stat.S_ISLNK(value.st_mode):
            target = path.resolve()
            allowed = (str(target).startswith(str(REPOSITORY) + '/') or
                       any(str(target).startswith(prefix) for prefix in ['/usr/', '/opt/google/chrome/', '/etc/fonts/', '/etc/alternatives/']) or
                       str(target) == '/etc/python3.14/sitecustomize.py')
            # The distro's standard-library link is inventoried, but -S prevents its execution.
            assert allowed, 'Unexpected external link target: ' + str(path)
            exists = target.exists()
            result[key] = {'kind': 'symlink', 'target': os.readlink(path), 'resolved': str(target), 'exists': exists}
            if exists:
                pending.append(target)
        elif stat.S_ISDIR(value.st_mode):
            names = sorted(os.listdir(path))
            result[key] = {'kind': 'directory', 'names': names}
            pending.extend(path / name for name in names)
        else:
            result[key] = file_record(path)
    return dict(sorted(result.items()))


def source_paths():
    tracked = git('ls-files', '-z').split('\0')
    freeze = json.loads((REPOSITORY / 'fixtures/loredock-prepared-flow/freeze.json').read_bytes())
    selected = set(freeze['application']) | set(freeze['frozenFiles'])
    selected.add(freeze['acceptedRuntimeAudit']['path'])
    selected.update(name for name in tracked if name.startswith(('scripts/', 'fixtures/loredock-prepared-flow/')))
    assert not git('ls-files', '--others', '--exclude-standard', '--', 'scripts', 'fixtures/loredock-prepared-flow'), 'Commit final code before creating the seal.'
    git('diff', '--exit-code', 'HEAD', '--', *sorted(selected))
    return sorted(selected)


def host():
    cpu = Path('/proc/cpuinfo').read_text().split('\n\n')
    models = sorted({line.split(':', 1)[1].strip() for block in cpu for line in block.splitlines() if line.startswith('model name')})
    flags = sorted({line.split(':', 1)[1].strip() for block in cpu for line in block.splitlines() if line.startswith('flags')})
    memory = next(line for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:'))
    uname = os.uname()
    return {'kernel': {'system': uname.sysname, 'release': uname.release, 'version': uname.version, 'machine': uname.machine},
            'cpuModels': models, 'cpuFlags': flags, 'logicalCpus': os.cpu_count(), 'affinity': sorted(os.sched_getaffinity(0)),
            'physicalMemoryBytes': int(memory.split()[1]) * 1024,
            'node': json.loads(execute([NODE, '-p', 'JSON.stringify({versions:process.versions,execPath:process.execPath})'])),
            'python': {'version': sys.version, 'executable': str(PYTHON), 'prefix': sys.prefix,
                       'isolatedPath': [value for value in sys.path if value != str(REPOSITORY)]},
            'chrome': execute(['/opt/google/chrome/chrome', '--version']).decode().strip(),
            'git': execute(['/usr/bin/git', '--version']).decode().strip()}


def absence_audit(plan):
    """Author-local provenance, not an external or universal non-observation proof."""
    assert not os.path.lexists(CLAIM), 'Any existing claim, including an empty file, consumes this family.'
    reserved_names = {'a-kiln-console', 'b-firing-gateway', 'c-batch-ledger', 't-boundary-notes'}
    records, roots, entries = [], [], 0
    for root in sorted(WORKSPACE.glob('task128-*')):
        if not root.is_dir() or root.is_symlink() or root == OUTPUT:
            continue
        roots.append(str(root))
        for directory, names, files in os.walk(root, followlinks=False):
            entries += len(names) + len(files)
            assert entries <= 2000000, 'Prior-observation audit exceeded its explicit bound.'
            assert not reserved_names.intersection(names), 'An earlier reserved source tree exists: ' + directory
            names[:] = [name for name in names if name != '.git']
            if 'sources.json' in files:
                file = Path(directory) / 'sources.json'
                raw = file.read_bytes()
                data = json.loads(raw)
                assert not any(row.get('source') in reserved_names for row in data.get('originals', [])), str(file)
                records.append({'path': str(file), 'sha256': sha(raw)})
    claims = []
    for file in sorted(WORKSPACE.glob('task128-*.claim.json')):
        raw = file.read_bytes()
        data = json.loads(raw)
        assert str(data['family']).startswith('ordinary-'), 'Unknown prior claim.'
        claims.append({'path': str(file), 'sha256': sha(raw), 'family': data['family']})
    if OUTPUT.exists():
        # The owner may already have created preflight artifacts; no source or case can exist yet.
        assert not (OUTPUT / 'run/matrix').exists()
        assert not any(OUTPUT.rglob('sources.json'))
    return {'scope': 'Author-owned Task 128 local output trees and consumption claims; supported by retained ordinary records and source review, not external/blind acceptance.',
            'roots': roots, 'entries': entries, 'sourceRecords': records, 'claims': claims,
            'candidateObservationsFound': 0, 'reservedClaimAbsent': True}


def capture():
    sources = source_paths()
    plan = json.loads(execute([NODE, '--input-type=module', '-e',
        "import {executionPlan} from './scripts/loredock-prepared-flow/execution-inputs.mjs';console.log(JSON.stringify(executionPlan));"]))
    assert plan['family'] == 'kiln-prepared-flow-127' and plan['ownerOutput'] == str(OUTPUT) and plan['claimPath'] == str(CLAIM)
    assert len(plan['catalogRoots']) == 63
    audit = json.loads(execute([NODE, '--experimental-import-meta-resolve', 'scripts/loredock-prepared-flow/import-audit.mjs']))
    roots = [REPOSITORY / name for name in sources] + [NODE, REPOSITORY / 'node_modules']
    for group in ['apps', 'packages']:
        for package in sorted((REPOSITORY / group).iterdir()):
            if package.is_dir():
                for name in ['dist', 'public', 'node_modules']:
                    if (package / name).exists():
                        roots.append(package / name)
    roots.extend(Path(value) for value in SYSTEM_ROOTS)
    # Include linked libraries even when this host resolves them outside its normal multiarch directory.
    loader = {}
    for program in [NODE, PYTHON, Path('/usr/bin/git'), Path('/usr/bin/bash'), Path('/opt/google/chrome/chrome')]:
        linked = execute(['/usr/bin/ldd', program]).decode()
        assert 'not found' not in linked, str(program)
        targets = sorted(set(re.findall(r'(?:=>\s+|^\s*)(/[^\s]+)', linked, re.MULTILINE)))
        assert targets, 'No linked-library inventory: ' + str(program)
        loader[str(program)] = targets
        roots.extend(Path(target) for target in targets)
    roots.append(Path('/usr/bin/ldd'))
    values = inventory(roots)
    for file, imports in audit['modules'].items():
        assert values[file]['kind'] == 'file', file
        for item in imports:
            if 'target' in item:
                assert values[item['target']]['kind'] == 'file', item
    frozen = execute([NODE, 'fixtures/loredock-prepared-flow/seal.mjs']).decode()
    return {'sourcePaths': sources, 'plan': plan, 'host': host(), 'importAudit': audit,
            'linkedLibraries': loader, 'pythonZip': file_record(Path('/usr/lib/python314.zip')) if Path('/usr/lib/python314.zip').exists() else None,
            'inputSealVerification': frozen, 'inventory': values, 'inventoryRoots': sorted(set(str(value) for value in roots))}


def write_new(path, raw):
    with path.open('xb') as file:
        file.write(raw)
        file.flush()
        os.fsync(file.fileno())
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def launch(plan, manifest_path):
    driver = {'args': [str(NODE), str(REPOSITORY / 'scripts/loredock-prepared-flow/execution.mjs'),
                       str(OUTPUT / 'run'), str(manifest_path)], 'env': ENVIRONMENT, 'cwd': str(REPOSITORY)}
    command = [str(PYTHON), '-I', '-S', '-B', str(REPOSITORY / 'scripts/loredock-prepared-flow/kernel-owner.py'),
               '--node', str(NODE), '--script', driver['args'][1], '--output', str(OUTPUT), '--cwd', str(REPOSITORY),
               '--wall-ms', str(LIMITS['wallMs']), '--storage-bytes', str(LIMITS['storageBytes']),
               '--catalog-bytes', str(LIMITS['catalogBytes']), '--grace-ms', str(LIMITS['graceMs'])]
    for root in plan['catalogRoots']:
        command.extend(['--catalog-root', root])
    command.extend(['--', str(manifest_path)])
    return driver, command


def create(manifest_path):
    assert not OUTPUT.exists() and not os.path.lexists(CLAIM)
    assert not manifest_path.exists()
    captured = capture()
    prior = absence_audit(captured['plan'])
    index_path = manifest_path.with_suffix('.inventory.json.gz')
    index_raw = gzip.compress(encoded(captured.pop('inventory')), mtime=0)
    driver, command = launch(captured['plan'], manifest_path)
    manifest = {'schemaVersion': 'prepared-flow-execution-seal/1', 'repository': str(REPOSITORY),
                'sourceCommit': git('rev-parse', 'HEAD'), 'driver': driver, 'command': command, 'limits': LIMITS,
                'index': {'path': str(index_path), 'bytes': len(index_raw), 'sha256': sha(index_raw)},
                'priorObservationAudit': prior, 'modelCalls': 0, 'resourceQualification': False,
                'modelEligibility': False, **captured}
    write_new(index_path, index_raw)
    write_new(manifest_path, encoded(manifest))
    return {'created': True, 'manifestSha256': sha(encoded(manifest)), 'inventorySha256': sha(index_raw),
            'sourceCommit': manifest['sourceCommit'], 'candidateReads': 0}


def verify(manifest_path):
    raw = manifest_path.read_bytes()
    manifest = json.loads(raw)
    assert manifest['schemaVersion'] == 'prepared-flow-execution-seal/1'
    assert manifest['repository'] == str(REPOSITORY)
    assert manifest['driver']['env'] == ENVIRONMENT and manifest['limits'] == LIMITS
    driver, command = launch(manifest['plan'], manifest_path)
    assert manifest['driver'] == driver and manifest['command'] == command
    assert manifest['index']['path'] == str(manifest_path.with_suffix('.inventory.json.gz'))
    for file in [manifest_path, Path(manifest['index']['path'])]:
        relative = str(file.relative_to(REPOSITORY))
        git('ls-files', '--error-unmatch', '--', relative)
        git('diff', '--exit-code', 'HEAD', '--', relative)
    git('merge-base', '--is-ancestor', manifest['sourceCommit'], 'HEAD')
    index_raw = Path(manifest['index']['path']).read_bytes()
    assert len(index_raw) == manifest['index']['bytes'] and sha(index_raw) == manifest['index']['sha256']
    captured = capture()
    expected = json.loads(gzip.decompress(index_raw))
    actual = captured.pop('inventory')
    changed = [key for key in sorted(set(actual) | set(expected)) if actual.get(key) != expected.get(key)]
    assert not changed, 'Sealed inventory changed: ' + json.dumps(changed[:20])
    for key, value in captured.items():
        assert value == manifest[key], 'Sealed metadata changed: ' + key
    prior = absence_audit(manifest['plan'])
    assert prior == manifest['priorObservationAudit'], 'Prior-observation audit changed; review before any consumption.'
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 4244))
    return {'verified': True, 'manifestSha256': sha(raw), 'inventorySha256': sha(index_raw),
            'entries': len(actual), 'candidateReads': 0}, manifest


def main():
    assert sys.flags.isolated and sys.flags.no_site and sys.flags.dont_write_bytecode, 'Use python3 -I -S -B.'
    assert len(sys.argv) == 3 and sys.argv[1] in ['create', 'verify', 'run']
    operation, manifest_path = sys.argv[1], Path(sys.argv[2])
    assert manifest_path.is_absolute() and manifest_path == manifest_path.resolve()
    assert manifest_path == REPOSITORY / 'docs/fixtures/loredock-prepared-flow-execution-seal/manifest.json'
    if operation == 'create':
        result = create(manifest_path)
    else:
        result, manifest = verify(manifest_path)
        if operation == 'run':
            assert not OUTPUT.exists(), 'The fixed output may be created only once.'
            os.execve(manifest['command'][0], manifest['command'], ENVIRONMENT)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
