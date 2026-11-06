import { createHash } from 'node:crypto';

export const sourceFiles = Object.freeze({
  'README.md': '# Observation control\n\nA synthetic order reader publishes an order event. No deployment or business behavior is asserted.\n',
  'src/orders.ts': 'export function readOrder() { return fetch("/orders", { headers: { "X-Tenant": "synthetic" } }); }\nexport function publishOrder(event: unknown) { kafka.send("orders-created", event); }\n',
});
export const plan = Object.freeze({
  version: 'ordinary-parser-observation-coverage/1',
  applicationBase: '410e9acd4e113a0175e806444f31b8b9273cd887',
  modes: ['source', 'emitted'], node: '22.23.2', intervalMs: 10,
  childMs: 30000, cleanupMs: 10000, idleMs: 60,
  eventLimit: 50000, parentSampleLimit: 4000, workerRequestLimit: 4000,
  files: Object.entries(sourceFiles).map(([path, text]) => ({ path, bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex') })),
  stages: ['observer-entry', 'loader-registration', 'application-import', 'server-construction',
    'identity-and-warm', 'listening', 'source-registration', 'index', 'native-analysis',
    'foreground-graph', 'idle', 'stop', 'catalog-reopen', 'actual-process-exit'],
  workerSampling: 'At constructor return and each parent interval, at most one heap request per worker. Record request, completion, rejection and pending-at-close separately. The sample instant is unknown within request/completion; never label completion as measurement time.',
  processOwnership: 'An external Python session owner samples Linux process identities, parent/session IDs, native thread IDs, RSS and exit. Public Worker wrappers cannot discover every nested or internal isolate. Short-lived processes and pre-observer startup remain explicitly uncovered.',
  firstOutput: '/home/toshiba/aew/task141-coverage-first',
  retention: 'Exclusive root; one child per mode; no rerun, retry, GC or heap/profiler overrides. Keep failed raw output, exact application emission, runtime and installed loader identities.',
  acceptance: 'Successful lifecycle is separate from observation coverage. Missing startup/isolate samples block aggregate heap and complete startup acceptance; independent maxima and asynchronous pairs are never a simultaneous peak.',
  limits: { daemonRssBytes: 402653184, wholeHeapBytes: 67108864, startupOrIntervalMs: 100,
    parserCleanupMs: 2000, browserRssBytes: 1073741824 },
  realModelCalls: 0, corporateSources: 0, reservedFamilyReads: 0, resourceQualification: false,
});
