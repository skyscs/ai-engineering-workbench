// Offline consistency of retained records only; the sealed acquisition owns live provenance.
import { createHash } from 'node:crypto';
import { assessMemoryReceipt, CONTRACT_ID, CONTRACT_SHA256 } from '../loredock-memory-receipts/assess.mjs';

const RAW_NAMES = ['counter-bindings', 'counter-initial-mount', 'counter-initial-environment',
  'counter-initial', 'counter-initial-assessment', 'native-capture', 'native-assessment',
  'owned-target-terminal', 'target-terminal-assessment', 'counter-final', 'counter-final-mount',
  'counter-final-environment', 'counter-final-assessment'].map(name => `${name}.json`);
const SCOPES = ['run', 'daemon', 'browser'];
const digest = raw => createHash('sha256').update(raw).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const decimal = value => typeof value === 'string' && /^(?:0|[1-9][0-9]{0,19})$/.test(value)
  && BigInt(value) <= 18446744073709551615n ? BigInt(value) : null;

export function assessRetainedCounterRun(records, binding) {
  const reasons = [], data = {};
  const unavailable = code => reasons.push({ code, status: 'UNAVAILABLE' });
  const fail = code => reasons.push({ code, status: 'FAIL' });
  const finish = (memory, rawMemory) => ({
    schemaVersion: 'loredock-held-counter-prerequisite-assessment/1', subject: binding,
    status: reasons.some(row => row.status === 'FAIL') ? 'FAIL' : reasons.length ? 'UNAVAILABLE' : 'PASS',
    reasons, memoryAssessment: memory, rawDiagnosticAssessment: rawMemory,
    offlineOnly: true, executorQualified: false, resourceQualification: false,
    applicationExecuted: false, emptyPrerequisiteRoles: ['daemon', 'browser'], onlyWorkloadLeaf: 'run/probe',
    notAssessed: ['ancestor-controls', 'orphans', 'interrupted-collector', 'complete-executor-lifetime',
      'application-resources', 'responsiveness', 'semantic-quality', 'prepared-answer-promotion'],
  });
  if (!object(records) || Object.keys(records).length > 256
    || Object.entries(records).some(([name, raw]) => !/^[a-z0-9_-]+\.json$/.test(name)
      || typeof raw !== 'string' || Buffer.byteLength(raw) > 1048576)
    || Object.values(records).reduce((size, raw) => size + Buffer.byteLength(raw), 0) > 2097152) {
    unavailable('RETAINED_RECORD_BOUNDS'); return finish(null, null);
  }
  for (const [name, raw] of Object.entries(records)) {
    try { data[name] = JSON.parse(raw); } catch { unavailable(`RECORD_ENCODING:${name}`); }
  }
  const get = name => data[`${name}.json`];
  const first = get('counter-initial'), last = get('counter-final');
  const lifetime = get('counter-lifetime'), retention = get('counter-retention');
  const acquired = get('assessment'), subject = get('expected-subject');
  const memory = assessMemoryReceipt(records['memory-receipt.json'], binding);
  if (memory.status === 'FAIL') fail('RETAINED_MEMORY_VIOLATION');
  else if (memory.status !== 'PASS') unavailable('MEMORY_PREDICATES_UNAVAILABLE');

  // Raw complete fields still diagnose a known breach if later receipt publication failed.
  // No missing exit/fsync/window is invented and this fallback can never establish PASS.
  const rawReceipt = {
    schemaVersion: 'loredock-memory-receipt/1', contract: { id: CONTRACT_ID, sha256: CONTRACT_SHA256 },
    run: { id: binding?.runId, candidateSha256: binding?.candidateSha256,
      bootId: subject?.bootId ?? null, clockId: subject?.clockId ?? null,
      acquiredAtNs: first?.observations?.daemon?.snapshot?.window?.fromNs ?? null,
      firstChildAtNs: lifetime?.creationLowerBoundNs ?? null, lastExitAtNs: null, retainedAtNs: null,
      allExited: false, forcedCleanup: false, fsynced: false, delegation: 'exclusive', counterMode: 'read-only-never-reset' },
    environment: { initial: get('counter-initial-environment') ?? null, final: get('counter-final-environment') ?? null },
    scopes: Object.fromEntries(SCOPES.map(role => [role, { initial: first?.observations?.[role]?.snapshot ?? null,
      checkpoints: [], final: last?.observations?.[role]?.snapshot ?? null }])),
    diagnostics: { heap: { coverage: 'unavailable', aggregateHeapPeakBytes: null, completeIsolateCoverage: false },
      rss: { coverage: 'unavailable', unavailableSamples: 1 } },
  };
  const rawMemory = assessMemoryReceipt(JSON.stringify(rawReceipt), binding);
  if (rawMemory.status === 'FAIL') fail('RETAINED_RAW_MEMORY_VIOLATION');
  if (acquired?.status === 'FAIL') fail('ACQUISITION_VIOLATION');
  else if (acquired?.status !== 'PASS') unavailable('ACQUISITION_UNAVAILABLE');
  if (acquired?.manifestSha256 !== binding?.candidateSha256 || acquired?.inputsUnchanged !== true
    || acquired?.ownedGroupEmpty !== true || acquired?.forcedCleanup !== false
    || acquired?.counterAcquisitionEstablished !== true) unavailable('ACQUISITION_BINDING_OR_CLOSURE');
  for (const name of ['ownership-assessment', 'pre-exec-assessment', 'native-assessment',
    'target-terminal-assessment', 'counter-initial-assessment', 'counter-final-assessment']) {
    if (get(name)?.status === 'FAIL') fail(`RETAINED_VIOLATION:${name}`);
    else if (get(name)?.status !== 'PASS') unavailable(`EVIDENCE_UNAVAILABLE:${name}`);
  }
  const inventory = get('counter-raw-inventory');
  if (!Array.isArray(inventory) || inventory.length !== RAW_NAMES.length
    || !equal(inventory.map(row => row?.path), RAW_NAMES)
    || inventory.some(row => row?.present !== true || typeof records[row.path] !== 'string'
      || row.bytes !== Buffer.byteLength(records[row.path]) || row.sha256 !== digest(records[row.path]))) {
    unavailable('RAW_INVENTORY_UNAVAILABLE');
  }
  for (const [key, name] of [['rawInventorySha256', 'counter-raw-inventory'],
    ['lifetimeSha256', 'counter-lifetime'], ['memoryReceiptSha256', 'memory-receipt']]) {
    if (typeof records[`${name}.json`] !== 'string' || retention?.[key] !== digest(records[`${name}.json`])) {
      unavailable(`RETENTION_BINDING:${name}`);
    }
  }
  const receipt = get('memory-receipt');
  const rawRetained = decimal(lifetime?.rawRetainedAtNs), receiptRetained = decimal(retention?.receiptRetainedAtNs);
  if (retention?.beforeOwnedServiceReturn !== true || lifetime?.status !== 'PASS'
    || !equal(lifetime?.emptyPrerequisiteRoles, ['daemon', 'browser']) || lifetime?.onlyWorkloadLeaf !== 'run/probe'
    || rawRetained === null || receiptRetained === null || rawRetained > receiptRetained
    || lifetime?.rawInventorySha256 !== retention?.rawInventorySha256
    || receipt?.run?.firstChildAtNs !== lifetime?.creationLowerBoundNs
    || receipt?.run?.lastExitAtNs !== lifetime?.waitUpperBoundNs
    || receipt?.run?.retainedAtNs !== lifetime?.rawRetainedAtNs) unavailable('LIFETIME_RETENTION_BINDING');
  if (!equal(receipt?.environment, rawReceipt.environment)
    || !equal(receipt?.scopes, rawReceipt.scopes)) unavailable('RECEIPT_RAW_PROJECTION');
  return finish(memory, rawMemory);
}
