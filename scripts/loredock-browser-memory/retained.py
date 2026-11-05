"""Attribute retained ordinary browser RSS without launching or modifying any input."""
from pathlib import Path
import gzip
import hashlib
import json
import sys

source, fixture, output = map(Path, sys.argv[1:])
assert all(path.is_absolute() and path == path.resolve() for path in [source, fixture, output])
output.mkdir()
sha = lambda raw: hashlib.sha256(raw).hexdigest()
read = lambda file: json.loads(file.read_bytes())
records = read(fixture / 'records.json')
tree = next(row for row in records['trees'] if row['path'] == 'native-v2-first.tar.gz')
assert sha((fixture / tree['path']).read_bytes()) == tree['sha256']
index = (fixture / tree['inventory']).read_bytes()
assert sha(index) == tree['inventorySha256']
expected = json.loads(gzip.decompress(index))
def verify():
    for name, identity in expected.items():
        file = source / name
        if identity['kind'] == 'symlink':
            assert file.is_symlink() and str(file.readlink()) == identity['target']
        else:
            raw = file.read_bytes()
            assert len(raw) == identity['bytes'] and sha(raw) == identity['sha256'], name
verify()
selected = ['result.json', 'run/result.json', 'run/sequence.jsonl', 'run/browser/process-tree.jsonl',
            'run/browser/events.jsonl', 'run/browser/process.json', 'run/browser/lifetime/result.json',
            'run/browser/observation.json']
for name in selected:
    target = output / 'inputs' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((source / name).read_bytes())
rows = [json.loads(line) for line in (source / 'run/browser/process-tree.jsonl').read_text().splitlines()]
lifetime = read(source / 'run/browser/lifetime/result.json')
process = read(source / 'run/browser/process.json')
assert lifetime['reason'] == 'completed' and lifetime['errors'] == lifetime['survivors'] == []
for sample in rows:
    assert len(sample['rows']) == len({row['pid'] for row in sample['rows']})
    assert sample['rssBytes'] == sum(row.get('rssBytes', 0) for row in sample['rows'])
    assert sample['complete'] == all(row['complete'] for row in sample['rows'])
peak = max(rows, key=lambda row: row['rssBytes'])
public = read(source / 'run/result.json')
browser = next(row['value']['browserResult'] for row in public['cases'] if 'browserResult' in row['value'])
assert peak['rssBytes'] == browser['maxRssBytes'] == 1403904000
owned = {(row['pid'], row['started']) for row in lifetime['owned']}
contributions = []
for row in peak['rows']:
    if row['pid'] == process['pid']:
        role = 'declared Python lifetime collector'
    else:
        assert (row['pid'], row['startedTicks']) in owned
        role = 'declared browser root' if row['pid'] == lifetime['driverExit']['pid'] else 'owned descendant; role not recorded'
    contributions.append({key: row[key] for key in ['pid', 'startedTicks', 'parentPid', 'rssBytes', 'highWaterRssBytes']}
                         | {'role': role})
events = [json.loads(line) for line in (source / 'run/browser/events.jsonl').read_text().splitlines()]
requests = []
for row in events:
    value = row.get('value', {})
    if value.get('method') == 'Network.requestWillBeSent':
        params = value['params']
        requests.append({'at': row['at'], 'browserTimestamp': params['timestamp'],
                         'url': params['request']['url'], 'method': params['request']['method']})
report = {'version': 'retained-browser-memory-attribution/1', 'applicationRuns': 0,
    'modelCalls': 0, 'reservedFamilyReads': 0, 'resourceQualification': False,
    'verifiedEntries': len(expected), 'samples': len(rows),
    'completeSamples': sum(row['complete'] for row in rows), 'peak': peak,
    'contributions': sorted(contributions, key=lambda row: row['rssBytes'], reverse=True),
    'rssLimit': 1073741824, 'excessBytes': peak['rssBytes'] - 1073741824,
    'sampleWindowMs': rows[-1]['at'] - rows[0]['began'],
    'sampleDurationsMs': [row['at'] - row['began'] for row in rows],
    'requests': requests, 'cleanupSurvivors': lifetime['survivors'],
    'limits': ['Ten short lifetime samples do not establish sustained memory behavior.',
               'Sequential process RSS includes shared resident pages in each process; keep the raw sum unchanged.',
               'Fourteen peak descendants have no recorded process role or command line.',
               'Driver-relative sample times and UTC/CDP network times have no retained exact clock bridge.',
               'No blank-browser baseline, process PSS or page heap is recorded; this is not proof of a leak.']}
assert len(contributions) == 16
verify()
(output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
(output / 'input-manifest.json').write_text(json.dumps({'source': str(source), 'archive': tree,
    'selected': {name: expected[name] for name in selected}, 'unchanged': True}, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['verifiedEntries', 'samples', 'completeSamples', 'sampleWindowMs', 'excessBytes', 'resourceQualification']}, indent=2))
