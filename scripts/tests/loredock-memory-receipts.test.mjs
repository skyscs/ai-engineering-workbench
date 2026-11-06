import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assessMemoryReceipt, CONTRACT_ID, CONTRACT_SHA256 } from '../loredock-memory-receipts/assess.mjs';

const BINDING = { runId: '11111111-1111-4111-8111-111111111111', candidateSha256: 'a'.repeat(64) };
const BOOT = '22222222-2222-4222-8222-222222222222', CLOCK = 'b'.repeat(64);
const MEMORY_EVENTS = 'low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\noom_group_kill 0\nsock_throttled 0\n';
function fixture() {
  const identities = Object.fromEntries([['run', '10', '9'], ['daemon', '11', '10'], ['browser', '12', '10']]
    .map(([role, inode, parentInode]) => [role, { bootId: BOOT, mountId: '48', device: '0:30', inode, parentInode }]));
  const window = (from, to) => ({ fromNs: String(from), toNs: String(to), clockId: CLOCK });
  const snapshot = (role, from, peak = '0', current = '0') => ({ identity: { ...identities[role] }, window: window(from, from + 1), raw: {
    'memory.current': current + '\n', 'memory.peak': peak + '\n', 'memory.swap.current': '0\n', 'memory.swap.peak': '0\n',
    'memory.events': MEMORY_EVENTS, 'memory.swap.events': 'high 0\nmax 0\nfail 0\n',
    'cgroup.events': 'populated 0\nfrozen 0\n', 'cgroup.type': 'domain\n',
  } });
  return {
    schemaVersion: 'loredock-memory-receipt/1',
    contract: { id: 'loredock-observable-resources/2', sha256: '759dc70e2d3b86043278b8378148785dd061cf29c06fa6f96c3a5bdf00be8e5b' },
    run: { id: BINDING.runId, candidateSha256: BINDING.candidateSha256, bootId: BOOT, clockId: CLOCK,
      acquiredAtNs: '1', firstChildAtNs: '20', lastExitAtNs: '100', retainedAtNs: '200', allExited: true,
      forcedCleanup: false, fsynced: true, delegation: 'exclusive', counterMode: 'read-only-never-reset' },
    environment: { initial: { mountId: '48', options: ['rw', 'nsdelegate', 'memory_hugetlb_accounting'], eventsMode: 'hierarchical' },
      final: { mountId: '48', options: ['rw', 'nsdelegate', 'memory_hugetlb_accounting'], eventsMode: 'hierarchical' } },
    scopes: {
      run: { initial: snapshot('run', 2), checkpoints: [], final: snapshot('run', 140, '500', '5') },
      daemon: { initial: snapshot('daemon', 4), checkpoints: [], final: snapshot('daemon', 110, '200', '2') },
      browser: { initial: snapshot('browser', 6), checkpoints: [], final: snapshot('browser', 120, '300', '3') },
    },
    diagnostics: { heap: { coverage: 'unavailable', aggregateHeapPeakBytes: null, completeIsolateCoverage: false },
      rss: { coverage: 'partial', unavailableSamples: 3 } },
  };
}
const assess = input => assessMemoryReceipt(JSON.stringify(input), BINDING);
const has = (result, code) => result.reasons.some(row => row.code === code);
function checkpoint(input, role, peak, from = 50) {
  return { identity: { ...input.scopes[role].initial.identity },
    window: { fromNs: String(from), toNs: String(from + 1), clockId: CLOCK },
    raw: { 'memory.peak': peak + '\n', 'memory.swap.peak': '0\n' } };
}

test('valid memory receipts remain explicitly offline and do not qualify any execution', () => {
  const result = assess(fixture()); assert.equal(result.status, 'PASS');
  assert.equal(result.offlineOnly, true); assert.equal(result.resourceQualification, false);
  assert.equal(result.aggregateHeapPeakBytes, null); assert.equal(result.completeIsolateCoverage, false);
  assert(result.notAssessed.includes('live-executor')); assert(result.notAssessed.includes('responsiveness'));
  assert.equal(result.axes.run.values.terminalPeakBytes, '500');
});
test('the implemented binding matches the accepted immutable contract and its targets', () => {
  const bytes = readFileSync(new URL('../../docs/loredock/observable-resource-contract-v2.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), CONTRACT_SHA256);
  const contract = JSON.parse(bytes); assert.equal(contract.schemaVersion, CONTRACT_ID);
  assert.deepEqual(contract.memory.chargedPeakCeilingsBytes, { run: 1476395008, daemon: 402653184, browser: 1073741824 });
});
for (const [role, ceiling] of [['run', 1476395008], ['daemon', 402653184], ['browser', 1073741824]]) {
  test(`${role} has an inclusive byte ceiling with no MiB rounding`, () => {
    const input = fixture(); input.scopes.run.final.raw['memory.peak'] = '1476395008\n';
    input.scopes[role].final.raw['memory.peak'] = `${ceiling}\n`; assert.equal(assess(input).status, 'PASS');
    input.scopes[role].final.raw['memory.peak'] = `${ceiling + 1}\n`;
    const result = assess(input); assert.equal(result.status, 'FAIL'); assert(has(result, 'CHARGED_MEMORY_EXCEEDED'));
  });
}
test('a root excess fails even when both role peaks pass, without adding their maxima', () => {
  const input = fixture(); input.scopes.run.final.raw['memory.peak'] = '1476395009\n';
  const result = assess(input); assert.equal(result.axes.run.status, 'FAIL'); assert.equal(result.axes.daemon.status, 'PASS');
  assert.equal(result.axes.browser.status, 'PASS'); assert.equal(result.status, 'FAIL');
});
test('a short-lived child peak remains a failure after population and current memory reach zero', () => {
  const input = fixture(); input.scopes.daemon.final.raw['memory.current'] = '0\n';
  input.scopes.daemon.final.raw['memory.peak'] = '402653185\n'; input.scopes.run.final.raw['memory.peak'] = '402653185\n';
  const result = assess(input); assert.equal(result.status, 'FAIL'); assert.equal(result.axes.daemon.values.terminalCurrentBytes, '0');
});
test('a previous excess survives a missing terminal record and a later lower counter', () => {
  for (const missing of [true, false]) {
    const input = fixture(); input.scopes.daemon.checkpoints.push(checkpoint(input, 'daemon', '402653185'));
    if (missing) input.scopes.daemon.final = null;
    const result = assess(input); assert.equal(result.status, 'FAIL'); assert(has(result, 'CHARGED_MEMORY_EXCEEDED'));
    assert(has(result, missing ? 'SNAPSHOT_UNAVAILABLE' : 'PEAK_DECREASE'));
    assert.equal(result.axes.daemon.values.maximumObservedPeakBytes, '402653185');
  }
});
test('missing evidence cannot erase an independently observed excess in another role', () => {
  const input = fixture(); delete input.scopes.daemon.final;
  input.scopes.browser.final.raw['memory.peak'] = '1073741825\n'; input.scopes.run.final.raw['memory.peak'] = '1073741825\n';
  const result = assess(input); assert.equal(result.status, 'FAIL'); assert.equal(result.axes.daemon.status, 'UNAVAILABLE');
});
test('missing final peaks are unavailable and are not copied from current or prior samples', () => {
  const input = fixture(); delete input.scopes.browser.final.raw['memory.peak'];
  const result = assess(input); assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.axes.browser.values.terminalPeakBytes, null);
});
test('a valid current reading can establish an excess while its peak record is missing', () => {
  const input = fixture(); delete input.scopes.daemon.final.raw['memory.peak'];
  input.scopes.daemon.final.raw['memory.current'] = '402653185\n';
  const result = assess(input); assert.equal(result.status, 'FAIL'); assert(has(result, 'RAW_READ_UNAVAILABLE'));
});
test('stale initial memory, events or population cannot be attributed to a fresh run', () => {
  for (const [key, value] of [['memory.peak', '1\n'], ['memory.events', MEMORY_EVENTS.replace('low 0', 'low 1')],
    ['cgroup.events', 'populated 1\nfrozen 0\n']]) {
    const input = fixture(); input.scopes.daemon.initial.raw[key] = value;
    const result = assess(input); assert.equal(result.status, 'UNAVAILABLE'); assert(has(result, 'INITIAL_NOT_EMPTY'));
  }
});
test('changed identities, reused group identities and wrong parents are unavailable', () => {
  for (const kind of ['changed', 'reused', 'parent', 'boot', 'mount']) {
    const input = fixture();
    if (kind === 'changed') input.scopes.daemon.final.identity.inode = '13';
    if (kind === 'reused') input.scopes.browser.initial.identity = { ...input.scopes.daemon.initial.identity };
    if (kind === 'parent') input.scopes.daemon.initial.identity.parentInode = '9';
    if (kind === 'boot') input.scopes.daemon.initial.identity.bootId = BINDING.runId;
    if (kind === 'mount') input.scopes.daemon.initial.identity.mountId = '49';
    assert.equal(assess(input).status, 'UNAVAILABLE', kind);
  }
});
test('early root reads, overlapping observations and missing clock identity cannot pass', () => {
  for (const kind of ['root', 'initial', 'exit', 'reverse', 'clock', 'retain']) {
    const input = fixture();
    if (kind === 'root') input.scopes.run.final.window = { fromNs: '115', toNs: '116', clockId: CLOCK };
    if (kind === 'initial') input.run.firstChildAtNs = '5';
    if (kind === 'exit') input.run.lastExitAtNs = '130';
    if (kind === 'reverse') input.scopes.daemon.final.window.toNs = '1';
    if (kind === 'clock') input.scopes.daemon.final.window.clockId = 'c'.repeat(64);
    if (kind === 'retain') input.run.retainedAtNs = '130';
    assert.equal(assess(input).status, 'UNAVAILABLE', kind);
  }
});
test('a parent peak below a child peak is unavailable rather than repaired by a sum', () => {
  const input = fixture(); input.scopes.run.final.raw['memory.peak'] = '250\n';
  const result = assess(input); assert.equal(result.status, 'UNAVAILABLE'); assert(has(result, 'PARENT_PEAK_BELOW_CHILD'));
});
test('nonzero swap peak, swap current or swap failure events fail independently', () => {
  for (const key of ['memory.swap.peak', 'memory.swap.current', 'memory.swap.events']) {
    const input = fixture(); input.scopes.daemon.final.raw[key] = key.endsWith('events') ? 'high 0\nmax 0\nfail 1\n' : '1\n';
    assert.equal(assess(input).status, 'FAIL', key);
  }
});
test('each required memory pressure event fails while low and socket diagnostics remain visible', () => {
  for (const name of ['high', 'max', 'oom', 'oom_kill', 'oom_group_kill']) {
    const input = fixture(); input.scopes.daemon.final.raw['memory.events'] = MEMORY_EVENTS.replace(`${name} 0\n`, `${name} 1\n`);
    assert.equal(assess(input).status, 'FAIL', name);
  }
  const input = fixture(); input.scopes.daemon.final.raw['memory.events'] = MEMORY_EVENTS.replace('low 0\n', 'low 1\n').replace('sock_throttled 0\n', 'sock_throttled 2\n');
  const result = assess(input); assert.equal(result.status, 'PASS'); assert.deepEqual(result.axes.daemon.values.diagnosticEvents, { low: '1', sock_throttled: '2' });
});
test('unknown, duplicate, missing and changing event fields cannot pass', () => {
  for (const raw of [MEMORY_EVENTS + 'new_event 0\n', MEMORY_EVENTS + 'high 1\n', MEMORY_EVENTS.replace('oom 0\n', ''),
    MEMORY_EVENTS.replace('sock_throttled 0\n', ''), MEMORY_EVENTS.trimEnd(), '']) {
    const input = fixture(); input.scopes.daemon.final.raw['memory.events'] = raw;
    assert.equal(assess(input).status, 'UNAVAILABLE');
  }
});
test('a missing event field does not turn a valid positive pressure event into zero', () => {
  const input = fixture(); input.scopes.daemon.final.raw['memory.events'] = MEMORY_EVENTS.replace('oom 0\n', '').replace('high 0\n', 'high 1\n');
  const result = assess(input); assert.equal(result.status, 'FAIL'); assert(has(result, 'EVENT_MISSING'));
});
test('scalar parsing rejects truncated, negative, fractional, numeric and overflowing counters', () => {
  for (const raw of ['0', '-1\n', '1.5\n', '00\n', '1e3\n', '18446744073709551616\n', 9007199254740992, null]) {
    const input = fixture(); input.scopes.daemon.final.raw['memory.peak'] = raw;
    assert.equal(assess(input).status, 'UNAVAILABLE', String(raw));
  }
});
test('unsigned 64-bit counter strings retain precision beyond JavaScript safe integers', () => {
  const input = fixture(); input.scopes.daemon.final.raw['memory.peak'] = '9007199254740993\n';
  const result = assess(input); assert.equal(result.status, 'FAIL'); assert.equal(result.axes.daemon.values.terminalPeakBytes, '9007199254740993');
});
test('peak decrease, reset declaration and too many checkpoints remain unavailable', () => {
  for (const kind of ['decrease', 'reset', 'capacity']) {
    const input = fixture();
    if (kind === 'decrease') input.scopes.daemon.checkpoints.push(checkpoint(input, 'daemon', '250'));
    if (kind === 'reset') input.run.counterMode = 'reset';
    if (kind === 'capacity') input.scopes.daemon.checkpoints = Array(65).fill(checkpoint(input, 'daemon', '1'));
    assert.equal(assess(input).status, 'UNAVAILABLE', kind);
  }
});
test('initial and terminal accounting modes must be eligible and unchanged', () => {
  for (const kind of ['hugetlb', 'local', 'changed', 'unknown-mode', 'duplicate-option']) {
    const input = fixture();
    if (kind === 'hugetlb') input.environment.initial.options = ['rw'];
    if (kind === 'local') input.environment.initial.options.push('memory_localevents');
    if (kind === 'changed') input.environment.final.options.push('memory_recursiveprot');
    if (kind === 'unknown-mode') input.environment.initial.eventsMode = 'unspecified';
    if (kind === 'duplicate-option') input.environment.initial.options.push('rw');
    assert.equal(assess(input).status, 'UNAVAILABLE', kind);
  }
});
test('wrong contract or expected subject cannot supply resource credit', () => {
  for (const kind of ['contract', 'digest', 'run', 'candidate', 'binding']) {
    const input = fixture();
    if (kind === 'contract') input.contract.id = 'loredock-observable-resources/2-draft1';
    if (kind === 'digest') input.contract.sha256 = '0'.repeat(64);
    if (kind === 'run') input.run.id = BOOT;
    if (kind === 'candidate') input.run.candidateSha256 = 'd'.repeat(64);
    const result = kind === 'binding' ? assessMemoryReceipt(JSON.stringify(input), {}) : assess(input);
    assert.equal(result.status, 'UNAVAILABLE', kind); assert.equal(result.resourceQualification, false);
  }
});
test('an asserted qualification or aggregate heap cannot become live authority', () => {
  const extra = fixture(); extra.qualified = true; assert.equal(assess(extra).status, 'UNAVAILABLE');
  for (const field of ['aggregateHeapPeakBytes', 'completeIsolateCoverage']) {
    const input = fixture(); input.diagnostics.heap[field] = field === 'aggregateHeapPeakBytes' ? 1 : true;
    const result = assess(input); assert.equal(result.status, 'FAIL'); assert.equal(result.resourceQualification, false);
    assert.equal(result.aggregateHeapPeakBytes, null); assert.equal(result.completeIsolateCoverage, false);
  }
});
test('remaining population, frozen state and forced cleanup are failed normal closure', () => {
  for (const kind of ['populated', 'frozen', 'forced']) {
    const input = fixture();
    if (kind === 'forced') input.run.forcedCleanup = true;
    else input.scopes.daemon.final.raw['cgroup.events'] = `populated ${kind === 'populated' ? 1 : 0}\nfrozen ${kind === 'frozen' ? 1 : 0}\n`;
    assert.equal(assess(input).status, 'FAIL', kind);
  }
});
test('unretained evidence, missing exits and absent exclusive delegation are unavailable', () => {
  for (const field of ['fsynced', 'allExited', 'delegation']) {
    const input = fixture(); input.run[field] = false; assert.equal(assess(input).status, 'UNAVAILABLE', field);
  }
});
test('oversized and malformed data are bounded failures without throwing or dropping known faults', () => {
  for (const raw of [null, '', '{', ' '.repeat(1048577), '['.repeat(10000) + '0' + ']'.repeat(10000)]) {
    assert.equal(assessMemoryReceipt(raw, BINDING).status, 'UNAVAILABLE');
  }
  const input = fixture(); input.scopes.daemon.final.raw['memory.peak'] = '0'.repeat(4096) + '\n';
  assert.equal(assess(input).status, 'UNAVAILABLE');
  input.scopes.browser.final.raw['memory.peak'] = '1073741825\n'; assert.equal(assess(input).status, 'FAIL');
});
test('duplicate JSON keys, noncanonical encoding and unexpected scope fields are rejected', () => {
  const input = fixture(), serialized = JSON.stringify(input);
  assert.equal(assessMemoryReceipt(serialized.replace('"memory.peak":"200\\n"', '"memory.peak":"402653185\\n","memory.peak":"200\\n"'), BINDING).status, 'UNAVAILABLE');
  assert.equal(assessMemoryReceipt(JSON.stringify(input, null, 2), BINDING).status, 'UNAVAILABLE');
  input.scopes.daemon.hidden = true; assert.equal(assess(input).status, 'UNAVAILABLE');
});
test('ordinary absent or malformed nested records never throw or masquerade as not-run', () => {
  const mutations = [x => { x.environment = null; }, x => { x.scopes = null; }, x => { x.scopes.daemon.initial = null; },
    x => { x.scopes.daemon.final.raw = null; }, x => { x.scopes.daemon.checkpoints = null; }, x => { x.diagnostics = null; },
    x => { delete x.run.lastExitAtNs; }, x => { delete x.scopes.browser; }];
  for (const mutate of mutations) { const input = fixture(); mutate(input); assert.equal(assess(input).status, 'UNAVAILABLE'); }
});
test('JSON objects cannot coerce themselves into identity strings or throw during validation', () => {
  const mutations = [x => { x.run.bootId = { toString: null }; }, x => { x.run.clockId = { toString: null }; },
    x => { x.scopes.daemon.initial.identity.device = { toString: null }; },
    x => { x.scopes.daemon.final.identity.bootId = [BOOT]; }];
  for (const mutate of mutations) { const input = fixture(); mutate(input); assert.equal(assess(input).status, 'UNAVAILABLE'); }
  assert.equal(assessMemoryReceipt(JSON.stringify(fixture()), { ...BINDING, runId: Symbol('bad') }).status, 'UNAVAILABLE');
});
test('separate role maxima need not be simultaneous and never replace the root counter', () => {
  const input = fixture(); input.scopes.daemon.final.raw['memory.peak'] = '402653184\n';
  input.scopes.browser.final.raw['memory.peak'] = '1073741824\n'; input.scopes.run.final.raw['memory.peak'] = '1073741824\n';
  const result = assess(input); assert.equal(result.status, 'PASS'); assert.equal(result.axes.run.values.terminalPeakBytes, '1073741824');
});
test('an earlier swap peak cannot disappear into a later zero', () => {
  const input = fixture(), sample = checkpoint(input, 'daemon', '150'); sample.raw['memory.swap.peak'] = '1\n';
  input.scopes.daemon.checkpoints.push(sample);
  const result = assess(input); assert.equal(result.status, 'FAIL'); assert(has(result, 'SWAP_USED')); assert(has(result, 'SWAP_PEAK_DECREASE'));
});
