"""Assess exact first controls; infer only role flags actually retained in argv/title bytes."""
from pathlib import Path
import hashlib
import json
import os
import re
import sys

def role(value):
    # Chrome can replace its NUL-separated child argv with one process-title string.
    # Extract only bounded observed flags; do not pretend to reconstruct shell argv.
    flags = {}
    argv = value['argv']
    collapsed = len(argv) == 1 and Path(value['executable']).name == 'chrome' and argv[0].startswith(value['executable'] + ' ')
    for name in ['type', 'utility-sub-type']:
        pattern = (r'(?:^|[ \t])--' + name + r'=([A-Za-z0-9_.:-]+)(?=[ \t]|$)') if collapsed else (r'^--' + name + r'=([A-Za-z0-9_.:-]+)$')
        matches = [match.group(1) for arg in argv for match in re.finditer(pattern, arg)]
        assert len(set(matches)) <= 1
        flags[name] = matches[0] if matches else None
    if flags['type']:
        return flags['type'] + (':' + flags['utility-sub-type'] if flags['utility-sub-type'] else '')
    executable = Path(value['executable']).name
    return {'chrome': 'browser-root', 'chrome_crashpad_handler': 'crashpad', 'cat': 'wrapper-cat'}.get(executable,
        'lifetime-collector' if executable.startswith('python') else 'unclassified:' + executable)

def inventory(directory):
    result = {}
    for parent, dirs, files in os.walk(directory, followlinks=False):
        for name in sorted(dirs + files):
            file = Path(parent) / name
            if file.is_symlink(): result[str(file.relative_to(directory))] = {'target': os.readlink(file)}
            elif file.is_file():
                raw = file.read_bytes()
                result[str(file.relative_to(directory))] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    return result

def assess(source, output):
    output.mkdir(); before = inventory(source)
    read = lambda file: json.loads(file.read_bytes())
    owner, observed = read(source / 'result.json'), read(source / 'run/result.json')
    assert owner['reason'] == 'completed' and owner['driverExit']['exit'] == 0
    assert owner['errors'] == owner['survivors'] == observed['errors'] == []
    assert set(owner['catalogRoots']) == set(owner['observedCatalogRoots'])
    assert observed['retainedInputsUnchanged'] and len(observed['cases']) == 3
    report = {'schemaVersion': 'ordinary-browser-memory-assessment/1', 'cases': [],
        'originalRoleLabelLimitation': 'First observer matched argv elements beginning with --type=. Chrome child process titles collapsed into one argv element, so those derived labels were root-or-helper. Exact argv/executable/identity bytes remain retained; this assessment extracts only their observed role flags.',
        'modelCalls': 0, 'reservedFamilyReads': 0, 'resourceQualification': False}
    for case in observed['cases']:
        directory = source / 'run' / case['name'] / 'browser'
        samples = [json.loads(line) for line in (directory / 'process-tree.jsonl').read_text().splitlines()]
        assert len(samples) == case['browser']['memorySamples']
        assert case['errors'] == case['diagnostic']['errors'] == case['browser']['errors'] == []
        roles = {(row['pid'], row['startedTicks']): row for row in case['diagnostic']['roles']}
        for sample in samples:
            assert len(sample['rows']) == len({row['pid'] for row in sample['rows']})
            assert sample['rssBytes'] == sum(row.get('rssBytes', 0) for row in sample['rows'])
        peak = max(samples, key=lambda row: row['rssBytes'])
        assert peak['rssBytes'] == case['browser']['maxRssBytes']
        grouped, contributions = {}, []
        for row in peak['rows']:
            observed_role = roles.get((row['pid'], row.get('startedTicks')))
            name = role(observed_role) if observed_role else 'role-unobserved'
            grouped[name] = grouped.get(name, 0) + row.get('rssBytes', 0)
            contributions.append({'pid': row['pid'], 'startedTicks': row.get('startedTicks'),
                'rssBytes': row.get('rssBytes', 0), 'role': name,
                'extensionProcessFlag': bool(observed_role and any(re.search(r'(?:^|[ \t])--extension-process(?:[ \t]|$)', arg) for arg in observed_role['argv']))})
        assert sum(grouped.values()) == peak['rssBytes']
        proportional = case['diagnostic']['proportional']
        for row in proportional:
            raw = (directory / ('smaps-' + str(row['pid']) + '-' + row['startedTicks'] + '.txt')).read_text()
            for key, field in [('rssBytes', 'Rss'), ('pssBytes', 'Pss')]:
                assert row[key] == int(re.search(r'^' + field + r':\s+(\d+) kB$', raw, re.M).group(1)) * 1024
        report['cases'].append({'name': case['name'], 'samples': len(samples), 'peak': peak,
            'contributions': contributions, 'peakByObservedRole': grouped,
            'rawRssPass': peak['rssBytes'] <= 1073741824,
            'terminalSequentialRssBytes': sum(row['rssBytes'] for row in proportional),
            'terminalSequentialPssBytes': sum(row['pssBytes'] for row in proportional),
            'proportionalSnapshotProcesses': len(proportional),
            'idle': case['idle'], 'resourceQualification': False})
    assert inventory(source) == before
    report.update(rawUnchanged=True, rawEntries=len(before), ownerElapsedMs=owner['elapsedMs'])
    (output / 'raw-inventory.json').write_text(json.dumps(before, indent=2) + '\n')
    (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'rawEntries': len(before), 'cases': [{key: row[key] for key in
        ['name', 'samples', 'rawRssPass', 'peakByObservedRole', 'terminalSequentialPssBytes']} for row in report['cases']],
        'resourceQualification': False}, indent=2))

if __name__ == '__main__':
    source, output = map(Path, sys.argv[1:])
    assert all(path.is_absolute() and path == path.resolve() for path in [source, output])
    assess(source, output)
