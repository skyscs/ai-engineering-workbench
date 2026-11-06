// Pure receipt assessment. Supplied records never establish live executor qualification.
import { Buffer } from 'node:buffer';

export const CONTRACT_ID = 'loredock-observable-resources/2';
export const CONTRACT_SHA256 = '759dc70e2d3b86043278b8378148785dd061cf29c06fa6f96c3a5bdf00be8e5b';
const SCOPES = ['run', 'daemon', 'browser'];
const LIMITS = { run: 1476395008n, daemon: 402653184n, browser: 1073741824n };
const MAX_RECEIPT = 1048576, MAX_READ = 4096, MAX_CHECKPOINTS = 64;
const UINT64_MAX = 18446744073709551615n;
const HASH = /^[a-f0-9]{64}$/, UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const IDENTITY = ['bootId', 'mountId', 'device', 'inode', 'parentInode'];
const MEMORY_REQUIRED = ['low', 'high', 'max', 'oom', 'oom_kill', 'oom_group_kill'];
const MEMORY_OPTIONAL = ['sock_throttled'];
const MEMORY_FAILURE = ['high', 'max', 'oom', 'oom_kill', 'oom_group_kill'];
const SWAP_KEYS = ['high', 'max', 'fail'];
const FULL_RAW = ['memory.current', 'memory.peak', 'memory.swap.current', 'memory.swap.peak',
  'memory.events', 'memory.swap.events', 'cgroup.events', 'cgroup.type'];
const PEAK_RAW = ['memory.peak', 'memory.swap.peak'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shape = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const exact = (value, keys) => shape(value, keys) && keys.every(key => Object.hasOwn(value, key));
const decimal = value => typeof value === 'string' && /^(?:0|[1-9][0-9]{0,19})$/.test(value)
  && BigInt(value) <= UINT64_MAX ? BigInt(value) : null;
const scalar = value => typeof value === 'string' && value.endsWith('\n')
  ? decimal(value.slice(0, -1)) : null;
const equalIdentity = (a, b) => a !== null && b !== null && IDENTITY.every(key => a[key] === b[key]);
const decimalText = value => value === null ? null : String(value);
const status = rows => rows.some(row => row.status === 'FAIL') ? 'FAIL'
  : rows.some(row => row.status === 'UNAVAILABLE') ? 'UNAVAILABLE' : 'PASS';

export function assessMemoryReceipt(serialized, expectedBinding) {
  const reasons = [], assessed = new Set(), values = {}, seen = new Set();
  let subject = null;
  const add = (axis, code, outcome = 'UNAVAILABLE', location = '') => {
    const key = `${axis}:${code}:${outcome}:${location}`;
    if (!seen.has(key)) { seen.add(key); reasons.push({ axis, code, status: outcome, location }); }
  };
  const finish = () => ({
    schemaVersion: 'loredock-memory-assessment/1', contractId: CONTRACT_ID, contractSha256: CONTRACT_SHA256,
    subject, status: status(reasons), offlineOnly: true, resourceQualification: false,
    axes: Object.fromEntries(['evidence', ...SCOPES, 'diagnosticDeclarations'].map(axis => [axis, {
      status: assessed.has(axis) ? status(reasons.filter(row => row.axis === axis)) : 'UNAVAILABLE',
      ...(Object.hasOwn(values, axis) ? { values: values[axis] } : {}),
    }])),
    reasons, aggregateHeapPeakBytes: null, completeIsolateCoverage: false,
    notAssessed: ['live-executor', 'complete-heap-or-rss-ledger', 'useful-cases', 'responsiveness',
      'work', 'storage', 'source-authority', 'semantic-quality', 'v1-qualification'],
  });

  let input;
  if (typeof serialized !== 'string' || serialized.length > MAX_RECEIPT || Buffer.byteLength(serialized) > MAX_RECEIPT) {
    add('evidence', 'RECEIPT_SIZE_OR_TYPE'); return finish();
  }
  try {
    input = JSON.parse(serialized);
    // Canonical producer encoding also rejects duplicate keys instead of selecting their last value.
    if (JSON.stringify(input) !== serialized) throw new Error('Noncanonical receipt.');
  } catch { add('evidence', 'RECEIPT_ENCODING'); return finish(); }
  if (!exact(input, ['schemaVersion', 'contract', 'run', 'environment', 'scopes', 'diagnostics'])
    || input.schemaVersion !== 'loredock-memory-receipt/1') {
    add('evidence', 'RECEIPT_SCHEMA'); return finish();
  }
  if (!exact(input.contract, ['id', 'sha256']) || input.contract.id !== CONTRACT_ID || input.contract.sha256 !== CONTRACT_SHA256) {
    add('evidence', 'CONTRACT_MISMATCH'); return finish();
  }
  if (!exact(expectedBinding, ['runId', 'candidateSha256']) || !matches(expectedBinding.runId, UUID)
    || !matches(expectedBinding.candidateSha256, HASH) || !object(input.run)
    || input.run.id !== expectedBinding.runId || input.run.candidateSha256 !== expectedBinding.candidateSha256) {
    add('evidence', 'SUBJECT_MISMATCH'); return finish();
  }
  subject = { runId: expectedBinding.runId, candidateSha256: expectedBinding.candidateSha256 };
  assessed.add('evidence');
  const run = input.run;
  const runKeys = ['id', 'candidateSha256', 'bootId', 'clockId', 'acquiredAtNs', 'firstChildAtNs',
    'lastExitAtNs', 'retainedAtNs', 'allExited', 'forcedCleanup', 'fsynced', 'delegation', 'counterMode'];
  if (!exact(run, runKeys)) add('evidence', 'RUN_SCHEMA');
  if (!matches(run.bootId, UUID) || !matches(run.clockId, HASH)) add('evidence', 'CLOCK_IDENTITY');
  const times = Object.fromEntries(['acquiredAtNs', 'firstChildAtNs', 'lastExitAtNs', 'retainedAtNs']
    .map(key => [key, decimal(run[key])]));
  if (Object.values(times).some(value => value === null)) add('evidence', 'LIFETIME_TIME_UNAVAILABLE');
  else if (!(times.acquiredAtNs <= times.firstChildAtNs && times.firstChildAtNs <= times.lastExitAtNs
    && times.lastExitAtNs <= times.retainedAtNs)) add('evidence', 'LIFETIME_ORDER');
  if (run.allExited !== true) add('evidence', 'EXIT_LEDGER_UNAVAILABLE');
  if (run.forcedCleanup === true) add('evidence', 'FORCED_CLEANUP', 'FAIL');
  else if (run.forcedCleanup !== false) add('evidence', 'CLEANUP_STATE_UNAVAILABLE');
  if (run.fsynced !== true) add('evidence', 'TERMINAL_NOT_RETAINED');
  if (run.delegation !== 'exclusive') add('evidence', 'DELEGATION_UNAVAILABLE');
  if (run.counterMode !== 'read-only-never-reset') add('evidence', 'COUNTER_MODE_UNAVAILABLE');

  const environments = [];
  if (!exact(input.environment, ['initial', 'final'])) add('evidence', 'ENVIRONMENT_SCHEMA');
  for (const phase of ['initial', 'final']) {
    const row = input.environment?.[phase];
    if (!exact(row, ['mountId', 'options', 'eventsMode']) || decimal(row.mountId) === null
      || !Array.isArray(row.options) || row.options.length > 32
      || row.options.some(option => typeof option !== 'string' || !/^[a-z_]+$/.test(option))
      || new Set(row.options).size !== row.options.length) {
      add('evidence', 'ENVIRONMENT_SCHEMA', 'UNAVAILABLE', phase); environments.push(null); continue;
    }
    if (!row.options.includes('memory_hugetlb_accounting')) add('evidence', 'HUGETLB_ACCOUNTING_UNAVAILABLE', 'UNAVAILABLE', phase);
    if (row.options.includes('memory_localevents') || row.eventsMode !== 'hierarchical') {
      add('evidence', 'HIERARCHICAL_EVENTS_UNAVAILABLE', 'UNAVAILABLE', phase);
    }
    environments.push({ mountId: row.mountId, options: [...row.options].sort().join(','), eventsMode: row.eventsMode });
  }
  if (environments.every(Boolean) && JSON.stringify(environments[0]) !== JSON.stringify(environments[1])) {
    add('evidence', 'ENVIRONMENT_CHANGED');
  }

  function identity(row, axis, location) {
    if (!exact(row, IDENTITY) || row.bootId !== run.bootId || !matches(row.bootId, UUID)
      || !matches(row.device, /^(?:0|[1-9][0-9]{0,9}):(?:0|[1-9][0-9]{0,9})$/)
      || ['mountId', 'inode', 'parentInode'].some(key => decimal(row[key]) === null || decimal(row[key]) === 0n)
      || row.inode === row.parentInode || row.mountId !== environments[0]?.mountId) {
      add(axis, 'GROUP_IDENTITY_UNAVAILABLE', 'UNAVAILABLE', location); return null;
    }
    return row;
  }
  function window(row, axis, location) {
    if (!exact(row, ['fromNs', 'toNs', 'clockId']) || row.clockId !== run.clockId) {
      add(axis, 'READ_WINDOW_UNAVAILABLE', 'UNAVAILABLE', location); return null;
    }
    const from = decimal(row.fromNs), to = decimal(row.toNs);
    if (from === null || to === null || from > to) { add(axis, 'READ_WINDOW_UNAVAILABLE', 'UNAVAILABLE', location); return null; }
    return { from, to };
  }
  function text(row, key, axis, location) {
    const value = row?.[key];
    if (typeof value !== 'string' || value.length > MAX_READ || Buffer.byteLength(value) > MAX_READ) {
      add(axis, 'RAW_READ_UNAVAILABLE', 'UNAVAILABLE', `${location}:${key}`); return null;
    }
    return value;
  }
  function counter(row, key, axis, location) {
    const raw = text(row, key, axis, location), value = scalar(raw);
    if (raw !== null && value === null) add(axis, 'COUNTER_FORMAT', 'UNAVAILABLE', `${location}:${key}`);
    return value;
  }
  function events(row, key, required, optional, axis, location) {
    const raw = text(row, key, axis, location), result = new Map(), duplicate = new Set();
    if (raw === null) return result;
    if (!raw.endsWith('\n')) { add(axis, 'EVENT_FORMAT', 'UNAVAILABLE', `${location}:${key}`); return result; }
    for (const line of raw.slice(0, -1).split('\n')) {
      const match = /^([a-z_]+) ([0-9]+)$/.exec(line);
      if (!match || decimal(match[2]) === null) { add(axis, 'EVENT_FORMAT', 'UNAVAILABLE', `${location}:${key}`); continue; }
      const name = match[1];
      if (result.has(name) || duplicate.has(name)) { duplicate.add(name); result.delete(name); add(axis, 'EVENT_DUPLICATE', 'UNAVAILABLE', `${location}:${key}`); continue; }
      if (!required.includes(name) && !optional.includes(name)) { add(axis, 'EVENT_UNKNOWN', 'UNAVAILABLE', `${location}:${key}`); continue; }
      result.set(name, decimal(match[2]));
    }
    if (required.some(name => !result.has(name))) add(axis, 'EVENT_MISSING', 'UNAVAILABLE', `${location}:${key}`);
    return result;
  }
  function snapshot(row, axis, location, full) {
    if (!exact(row, ['identity', 'window', 'raw'])) { add(axis, 'SNAPSHOT_UNAVAILABLE', 'UNAVAILABLE', location); return null; }
    const id = identity(row.identity, axis, location), span = window(row.window, axis, location);
    if (!shape(row.raw, full ? FULL_RAW : PEAK_RAW)) { add(axis, 'RAW_SCHEMA', 'UNAVAILABLE', location); return null; }
    const result = { identity: id, window: span,
      peak: counter(row.raw, 'memory.peak', axis, location), swapPeak: counter(row.raw, 'memory.swap.peak', axis, location) };
    if (full) {
      result.current = counter(row.raw, 'memory.current', axis, location);
      result.swapCurrent = counter(row.raw, 'memory.swap.current', axis, location);
      result.memoryEvents = events(row.raw, 'memory.events', MEMORY_REQUIRED, MEMORY_OPTIONAL, axis, location);
      result.swapEvents = events(row.raw, 'memory.swap.events', SWAP_KEYS, [], axis, location);
      result.cgroupEvents = events(row.raw, 'cgroup.events', ['populated', 'frozen'], [], axis, location);
      if ([...result.cgroupEvents.values()].some(value => value > 1n)) add(axis, 'CGROUP_EVENT_FORMAT', 'UNAVAILABLE', location);
      if (text(row.raw, 'cgroup.type', axis, location) !== 'domain\n') add(axis, 'CGROUP_TYPE', 'UNAVAILABLE', location);
      if (result.current !== null && result.peak !== null && result.current > result.peak
        || result.swapCurrent !== null && result.swapPeak !== null && result.swapCurrent > result.swapPeak) {
        add(axis, 'CURRENT_EXCEEDS_PEAK', 'UNAVAILABLE', location);
      }
    }
    return result;
  }

  if (!shape(input.scopes, SCOPES)) { add('evidence', 'SCOPES_SCHEMA'); return finish(); }
  const initials = {}, finals = {}, trusted = {};
  for (const axis of SCOPES) {
    assessed.add(axis);
    const row = input.scopes[axis];
    if (!shape(row, ['initial', 'checkpoints', 'final'])) { add(axis, 'SCOPE_SCHEMA'); initials[axis] = null; continue; }
    const first = snapshot(row.initial, axis, 'initial', true); initials[axis] = first;
    if (!first) continue;
    if ([first.peak, first.swapPeak, first.current, first.swapCurrent,
      ...first.memoryEvents.values(), ...first.swapEvents.values(), ...first.cgroupEvents.values()]
      .some(value => value !== null && value !== 0n)) add(axis, 'INITIAL_NOT_EMPTY');
    if (first.window && (times.acquiredAtNs !== null && first.window.from < times.acquiredAtNs
      || times.firstChildAtNs !== null && first.window.to > times.firstChildAtNs)) add(axis, 'INITIAL_READ_ORDER');
  }
  const rootIdentity = initials.run?.identity ?? null;
  for (const axis of ['daemon', 'browser']) {
    const id = initials[axis]?.identity;
    if (!id || !rootIdentity || id.bootId !== rootIdentity.bootId || id.mountId !== rootIdentity.mountId
      || id.device !== rootIdentity.device || id.parentInode !== rootIdentity.inode) add(axis, 'PARENT_IDENTITY');
  }
  for (let i = 0; i < SCOPES.length; i++) for (let j = i + 1; j < SCOPES.length; j++) {
    const a = initials[SCOPES[i]]?.identity, b = initials[SCOPES[j]]?.identity;
    if (a && b && a.device === b.device && a.inode === b.inode) {
      add(SCOPES[i], 'REUSED_GROUP_IDENTITY'); add(SCOPES[j], 'REUSED_GROUP_IDENTITY');
    }
  }
  for (const axis of SCOPES) trusted[axis] = initials[axis]?.identity !== null
    && Boolean(initials[axis]) && !reasons.some(row => row.axis === axis);

  for (const axis of SCOPES) {
    const row = input.scopes[axis], initial = initials[axis];
    if (!shape(row, ['initial', 'checkpoints', 'final'])) continue;
    let checkpoints = row.checkpoints;
    if (!Array.isArray(checkpoints) || checkpoints.length > MAX_CHECKPOINTS) {
      add(axis, 'CHECKPOINT_CAPACITY_OR_TYPE'); checkpoints = [];
    }
    const observations = checkpoints.map((item, index) => ({ location: `checkpoint-${index}`,
      row: snapshot(item, axis, `checkpoint-${index}`, false) }));
    const last = snapshot(row.final, axis, 'final', true); finals[axis] = last;
    observations.push({ location: 'final', row: last });
    let previousSpan = initial?.window ?? null;
    let previousPeak = initial?.peak ?? null, previousSwap = initial?.swapPeak ?? null;
    let maximumPeak = null, maximumCurrent = null;
    for (const observation of observations) {
      const sample = observation.row, location = observation.location;
      if (!sample) continue;
      const belongs = equalIdentity(sample.identity, initial?.identity ?? null);
      if (!belongs) add(axis, 'GROUP_IDENTITY_CHANGED', 'UNAVAILABLE', location);
      if (sample.window) {
        if (previousSpan && previousSpan.to > sample.window.from
          || times.firstChildAtNs !== null && sample.window.from < times.firstChildAtNs
          || times.retainedAtNs !== null && sample.window.to > times.retainedAtNs
          || location === 'final' && times.lastExitAtNs !== null && sample.window.from < times.lastExitAtNs) {
          add(axis, 'OBSERVATION_ORDER', 'UNAVAILABLE', location);
        }
        previousSpan = sample.window;
      }
      // A stale/ambiguous group cannot attribute a numeric violation to this run.
      if (!trusted[axis] || !belongs) continue;
      if (sample.peak !== null) {
        if (previousPeak !== null && sample.peak < previousPeak) add(axis, 'PEAK_DECREASE', 'UNAVAILABLE', location);
        previousPeak = sample.peak;
        maximumPeak = maximumPeak === null || sample.peak > maximumPeak ? sample.peak : maximumPeak;
      }
      if (sample.swapPeak !== null) {
        if (previousSwap !== null && sample.swapPeak < previousSwap) add(axis, 'SWAP_PEAK_DECREASE', 'UNAVAILABLE', location);
        previousSwap = sample.swapPeak;
      }
      for (const value of [sample.peak, sample.current ?? null]) {
        if (value !== null && value > LIMITS[axis]) add(axis, 'CHARGED_MEMORY_EXCEEDED', 'FAIL', location);
      }
      for (const value of [sample.swapPeak, sample.swapCurrent ?? null]) {
        if (value !== null && value > 0n) add(axis, 'SWAP_USED', 'FAIL', location);
      }
      if (sample.current !== undefined && sample.current !== null) {
        maximumCurrent = maximumCurrent === null || sample.current > maximumCurrent ? sample.current : maximumCurrent;
      }
      if (location === 'final') {
        if (sample.cgroupEvents.get('populated') === 1n) add(axis, 'TERMINAL_POPULATED', 'FAIL');
        if (sample.cgroupEvents.get('frozen') === 1n) add(axis, 'TERMINAL_FROZEN', 'FAIL');
        for (const key of MEMORY_FAILURE) {
          const value = sample.memoryEvents.get(key);
          if (value !== undefined && value > 0n) add(axis, 'MEMORY_PRESSURE_EVENT', 'FAIL', key);
        }
        for (const key of SWAP_KEYS) {
          const value = sample.swapEvents.get(key);
          if (value !== undefined && value > 0n) add(axis, 'SWAP_FAILURE_EVENT', 'FAIL', key);
        }
        for (const name of ['memoryEvents', 'swapEvents']) {
          if ([...initial[name].keys()].sort().join(',') !== [...sample[name].keys()].sort().join(',')) {
            add(axis, 'EVENT_FIELDS_CHANGED', 'UNAVAILABLE', name);
          }
        }
      }
    }
    values[axis] = { ceilingBytes: String(LIMITS[axis]),
      maximumObservedPeakBytes: decimalText(maximumPeak), maximumObservedCurrentBytes: decimalText(maximumCurrent),
      terminalPeakBytes: trusted[axis] && last && equalIdentity(last.identity, initial.identity) ? decimalText(last.peak) : null,
      terminalCurrentBytes: trusted[axis] && last && equalIdentity(last.identity, initial.identity) ? decimalText(last.current) : null,
      diagnosticEvents: trusted[axis] && last && equalIdentity(last.identity, initial.identity)
        ? Object.fromEntries(['low', 'sock_throttled'].map(key => [key, decimalText(last.memoryEvents.get(key) ?? null)])) : null };
  }
  for (const axis of ['daemon', 'browser']) {
    const parent = finals.run, child = finals[axis];
    if (!parent?.window || !child?.window || parent.window.from < child.window.to) add('evidence', 'ROOT_READ_ORDER', 'UNAVAILABLE', axis);
    if (parent?.peak !== null && parent?.peak !== undefined && child?.peak !== null && child?.peak !== undefined
      && parent.peak < child.peak) add('evidence', 'PARENT_PEAK_BELOW_CHILD', 'UNAVAILABLE', axis);
  }

  assessed.add('diagnosticDeclarations');
  if (!exact(input.diagnostics, ['heap', 'rss'])
    || !exact(input.diagnostics.heap, ['coverage', 'aggregateHeapPeakBytes', 'completeIsolateCoverage'])
    || !exact(input.diagnostics.rss, ['coverage', 'unavailableSamples'])) {
    add('diagnosticDeclarations', 'DIAGNOSTIC_SCHEMA');
  } else {
    const { heap, rss } = input.diagnostics;
    if (!['partial', 'unavailable'].includes(heap.coverage)) add('diagnosticDeclarations', 'HEAP_COVERAGE_UNAVAILABLE');
    if (heap.aggregateHeapPeakBytes !== null || heap.completeIsolateCoverage !== false) add('diagnosticDeclarations', 'UNSUPPORTED_HEAP_AGGREGATE', 'FAIL');
    if (!['complete', 'partial', 'unavailable'].includes(rss.coverage) || !Number.isSafeInteger(rss.unavailableSamples)
      || rss.unavailableSamples < 0 || rss.coverage === 'complete' && rss.unavailableSamples !== 0) {
      add('diagnosticDeclarations', 'RSS_DIAGNOSTIC_FORMAT');
    }
  }
  return finish();
}
