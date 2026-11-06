"""Read retained ordinary evidence without executing the application."""
import collections
import json
from pathlib import Path
import sys


def assess(root):
    rows = []
    for mode in ['source', 'emitted']:
        directory = root / mode
        result = json.loads((directory / 'run/result.json').read_text())
        exit_record = json.loads((directory / 'exit.json').read_text())
        heap = json.loads((directory / 'run/heap.json').read_text())
        parent = [json.loads(line) for line in (directory / 'run/parent.jsonl').read_text().splitlines()]
        processes = [json.loads(line) for line in (directory / 'processes.jsonl').read_text().splitlines()]
        events = [json.loads(line) for line in (directory / 'run/events.jsonl').read_text().splitlines()]
        assert not result['failure'] and exit_record['exit'] == 0 and not exit_record['timedOut']
        assert not exit_record['survivors'] and not exit_record['forcedDescendantCleanup']
        assert result['lifecycle']['native']['counts']['parsed'] == 1
        assert not result['lifecycle']['stopped']['owner']['owned']
        assert result['lifecycle']['integrity']['integrity_check'] == 'ok'
        assert not result['lifecycle']['foreignKeyFailures']
        assert heap['simultaneousHeapPeakBytes'] is None and not heap['completeStartup']
        requests = heap['requests']
        assert all(row['measurementAt'] is None for row in requests)
        for request in requests:
            if request['completedAt'] is not None:
                assert request['completedAt'] >= request['requestedAt']
            if request['status'] != 'fulfilled':
                assert request['heap'] is None
        workers = []
        for worker in heap['workers']:
            first = worker['firstSuccessfulWindow']
            last = worker['lastSuccessfulWindow']
            workers.append({**worker,
                'creationToFirstWindowMs': None if first is None else [first[0] - worker['createdAt'], first[1] - worker['createdAt']],
                'lastWindowToExitMs': None if last is None or worker['exitedAt'] is None else
                    [worker['exitedAt'] - last[1], worker['exitedAt'] - last[0]]})
        rows.append({'mode': mode, 'lifecyclePassed': True, 'wholeChildMs': exit_record['wallMs'],
            'observerEntryMs': events[0]['at'], 'listeningAtMs': result['lifecycle']['listeningAt'],
            'parentSamples': len(parent), 'maximumParentGapMs': max(row['gapMs'] for row in parent),
            'sampledParentHeapMaximumBytes': max(row['memory']['heapUsed'] for row in parent),
            'processHighWaterRssBytes': result['resourceUsage']['maxRSS'] * 1024,
            'sampledProcessTreeRssMaximumBytes': max(sum(row['rssBytes'] for row in sample['processes']) for sample in processes),
            'sampledProcessIdentities': exit_record['sampledProcessIdentities'],
            'maximumCensusRequestGapMs': max((second['requestedNs'] - first['requestedNs']) / 1000000 for first, second in zip(processes, processes[1:])),
            'heapRequestStatuses': dict(collections.Counter(row['status'] for row in requests)),
            'maximumHeapRequestLatencyMs': max(row['completedAt'] - row['requestedAt'] for row in requests if row['completedAt'] is not None),
            'workers': workers, 'completeIsolateSet': False, 'completeStartup': False,
            'simultaneousHeapPeakBytes': None, 'resourceQualification': False})
    return {'version': 'ordinary-parser-coverage-assessment/1', 'modes': rows,
        'decision': 'Lifecycle control passes. Whole-isolate heap and complete startup remain blocked. Design the measurement boundary before near-limit execution.',
        'limitations': ['JavaScript entry misses process bootstrap.', 'Worker sample instants are unknown.',
            'Early, late and pending worker samples remain missing.', 'Public Worker hooks cannot discover every nested/internal isolate.',
            'Linux census is interval sampled and cannot prove that no short-lived descendant existed.',
            'The observer allocates and writes synchronously; this is not an uninstrumented benchmark.',
            'Source loader cache state is uncontrolled; no cold-cache claim.', 'No browser or near-limit workload ran.']}


if __name__ == '__main__':
    root, output = (Path(value) for value in sys.argv[1:])
    result = assess(root)
    with output.open('x') as handle:
        json.dump(result, handle, indent=2)
        handle.write('\n')
