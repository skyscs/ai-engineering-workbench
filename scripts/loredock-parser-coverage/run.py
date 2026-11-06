"""Exclusive ordinary diagnostic owner; never rerun a consumed output directory."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

repo = Path(__file__).resolve().parents[2]
node, root = (Path(value) for value in sys.argv[1:])
assert node.is_absolute() and root.is_absolute()
assert subprocess.check_output([str(node), '--version'], text=True).strip() == 'v22.23.2'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=repo, text=True), 'Commit every input before observation.'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
subprocess.run(['git', 'diff', '--exit-code', '410e9acd4e113a0175e806444f31b8b9273cd887', '--', 'apps', 'packages', 'pnpm-lock.yaml'], cwd=repo, check=True)
root.mkdir()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def save(name, value):
    with (root / name).open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')


def inventory(folder):
    return [{'path': str(file.relative_to(folder)), 'bytes': file.stat().st_size, 'sha256': digest(file.read_bytes())}
            for file in sorted(folder.rglob('*')) if file.is_file()]


environment = {'PATH': str(node.parent) + ':/usr/bin:/bin', 'LC_ALL': 'C'}
control = json.loads(subprocess.check_output([str(node), '--input-type=module', '-e',
    'import {plan,sourceFiles} from "./scripts/loredock-parser-coverage/plan.mjs"; console.log(JSON.stringify({plan,sourceFiles}));'], cwd=repo, env=environment, text=True))
plan = control['plan']
assert str(root) == plan['firstOutput'], 'This launcher owns only the prospective first directory.'
inputs = root / 'inputs'
inputs.mkdir()
files = [name for name in subprocess.check_output(['git', 'ls-files'], cwd=repo, text=True).splitlines()
         if name.startswith(('apps/loredock/src/', 'apps/loredock/runtime/', 'scripts/loredock-parser-coverage/'))
         or name in ['package.json', 'pnpm-lock.yaml', 'apps/loredock/package.json', 'apps/loredock/tsconfig.json']]
for pattern in ['apps/loredock/dist/*.js', 'packages/*/dist/*.js']:
    files.extend(str(file.relative_to(repo)) for file in repo.glob(pattern))
for name in sorted(set(files)):
    target = inputs / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((repo / name).read_bytes())
for package in ['tsx', 'esbuild', 'typescript']:
    package_json = subprocess.check_output([str(node), '-e',
        'const {createRequire}=require("node:module"); const r=createRequire(process.cwd()+"/apps/loredock/package.json");'
        'const t=createRequire(r.resolve("tsx/package.json")); console.log((process.argv[1]==="esbuild"?t:r).resolve(process.argv[1]+"/package.json"));', package],
        cwd=repo, env=environment, text=True).strip()
    package_root = Path(package_json).parent
    for file in sorted(package_root.rglob('*')):
        if file.is_file() and 'node_modules' not in file.relative_to(package_root).parts:
            target = inputs / 'installed' / package / file.relative_to(package_root)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(file.read_bytes())
before = inventory(inputs)
save('inputs.json', {'candidate': head, 'applicationBase': plan['applicationBase'], 'node': str(node),
    'nodeSha256': digest(node.read_bytes()), 'files': before, 'plan': plan})


def process_table():
    rows = {}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            raw = (entry / 'stat').read_text()
            fields = raw[raw.rfind(')') + 2:].split()
            rows[int(entry.name)] = {'pid': int(entry.name), 'ppid': int(fields[1]), 'group': int(fields[2]),
                'session': int(fields[3]), 'startTicks': int(fields[19]), 'state': fields[0],
                'rssBytes': int(fields[21]) * os.sysconf('SC_PAGE_SIZE')}
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass
    return rows


def owned_rows(table, child, known):
    selected = {pid for pid, row in table.items() if row['session'] == child or
                (pid, row['startTicks']) in known}
    while True:
        expanded = selected | {pid for pid, row in table.items() if row['ppid'] in selected}
        if expanded == selected:
            break
        selected = expanded
    result = []
    for pid in sorted(selected):
        row = table[pid].copy()
        try:
            row['tasks'] = sorted(int(task.name) for task in Path(f'/proc/{pid}/task').iterdir())
            row['executable'] = os.path.basename(os.readlink(f'/proc/{pid}/exe'))
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            row['tasks'] = None
            row['executable'] = None
        known.add((pid, row['startTicks']))
        result.append(row)
    return result


results = []
for mode in plan['modes']:
    directory = root / mode
    directory.mkdir()
    source = directory / 'source'
    source.mkdir()
    template = directory / 'empty-template'
    template.mkdir()
    for name, content in control['sourceFiles'].items():
        target = source / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    git_env = {**environment, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_ATTR_NOSYSTEM': '1',
               'GIT_AUTHOR_DATE': '2026-01-01T00:00:00Z', 'GIT_COMMITTER_DATE': '2026-01-01T00:00:00Z'}
    git = ['git', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false',
           '-c', 'core.autocrlf=false', '-c', 'user.name=LoreDock Fixture', '-c', 'user.email=fixture@example.invalid']
    for args in [['init', '--quiet', '--object-format=sha1', '--initial-branch=main', '--template=' + str(template)],
                 ['add', '--all'], ['commit', '--quiet', '-m', 'Add synthetic observation sources']]:
        subprocess.run(git + args, cwd=source, env=git_env, check=True)
    source_before = inventory(source)
    args = [str(node), 'scripts/loredock-parser-coverage/observe.mjs', mode, str(directory / 'run'), str(source)]
    child_env = {**environment, 'COVERAGE_CANDIDATE': head}
    save(mode + '/launch.json', {'args': args, 'cwd': str(repo), 'environment': child_env,
         'nodeSha256': digest(node.read_bytes()), 'childMs': plan['childMs'], 'cleanupMs': plan['cleanupMs']})
    began = time.monotonic_ns()
    known = set()
    timeout = False
    with (directory / 'stdout.log').open('xb') as out, (directory / 'stderr.log').open('xb') as err, (directory / 'processes.jsonl').open('x') as samples:
        child = subprocess.Popen(args, cwd=repo, env=child_env, stdout=out, stderr=err, start_new_session=True)
        spawned = time.monotonic_ns()
        deadline = began + plan['childMs'] * 1000000
        while child.poll() is None:
            sample_begin = time.monotonic_ns()
            rows = owned_rows(process_table(), child.pid, known)
            samples.write(json.dumps({'requestedNs': sample_begin, 'completedNs': time.monotonic_ns(), 'processes': rows}) + '\n')
            samples.flush()
            if time.monotonic_ns() >= deadline:
                timeout = True
                os.killpg(child.pid, signal.SIGTERM)
                break
            time.sleep(plan['intervalMs'] / 1000)
        try:
            code = child.wait(timeout=plan['cleanupMs'] / 1000)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            code = child.wait(timeout=plan['cleanupMs'] / 1000)
        actual_exit = time.monotonic_ns()
        cleanup_deadline = actual_exit + plan['cleanupMs'] * 1000000
        while True:
            survivors = owned_rows(process_table(), child.pid, known)
            samples.write(json.dumps({'requestedNs': time.monotonic_ns(), 'completedNs': time.monotonic_ns(), 'processes': survivors, 'afterChildExit': True}) + '\n')
            live = [row for row in survivors if row['state'] != 'Z']
            if not live or time.monotonic_ns() >= cleanup_deadline:
                break
            time.sleep(.01)
        for row in live:
            try:
                os.kill(row['pid'], signal.SIGKILL)
            except ProcessLookupError:
                pass
    result = {'mode': mode, 'pid': child.pid, 'spawnBeganNs': began, 'spawnReturnedNs': spawned, 'actualExitNs': actual_exit,
        'exit': code, 'timedOut': timeout, 'wallMs': (actual_exit - began) / 1000000, 'sampledProcessIdentities': sorted(known),
        'survivors': survivors, 'forcedDescendantCleanup': bool(live), 'resourceQualification': False}
    assert inventory(source) == source_before
    save(mode + '/source-inventory.json', source_before)
    save(mode + '/exit.json', result)
    results.append(result)
assert inventory(inputs) == before
save('retention.json', {'candidateFiles': len(before), 'unchanged': True})
save('result.json', {'modes': results, 'inputsUnchanged': True, 'resourceQualification': False})
print(json.dumps(results))
sys.exit(1 if any(row['exit'] or row['timedOut'] or row['forcedDescendantCleanup'] for row in results) else 0)
