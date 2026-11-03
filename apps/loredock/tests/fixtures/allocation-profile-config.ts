import { fileURLToPath } from 'node:url';
import { config as base } from './memory-runner-config.js';

const profile = { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
  validationBytes: 33554432, treeNodes: 32768, samples: 262144, depth: 128, summaryFrames: 100, summaryBytes: 262144,
  preparerWatchdogMs: 60000, readerWatchdogMs: 60000, overallWatchdogMs: 180000, resourceAcceptance: false,
  allowUnmappedSamples: true, backendStopForcesGC: true, backendExportAllocationsIncluded: true };
export const config = { ...base, repositoryRoot: fileURLToPath(new URL('../../../../', import.meta.url)),
  oracle: { ...base.oracle, sizes: [base.size], profile, rootCount: 5, defaultFlows: 2, defaultOriginals: 10,
    topic: 'locker.reserved.v2', environment: 'regression', uncitedSource: 'not-in-this-regression',
    requiredNodes: [
      ['a-locker-client', 'ui/AABook.vue', 'symbol', 'book', 'vue-action'],
      ['a-locker-client', 'ui/reserve.ts', 'http-request', 'POST /lockers/reservations', null],
      ['b-locker-api', 'routes.json', 'handler-reference', 'Reservations.reserve', null],
      ['b-locker-api', 'Reservations.java', 'event-publish', 'Publish LockerReserved', null],
      ['c-locker-store', 'LockerWriter.java', 'event-subscribe', 'Subscribe via KafkaSubscriber', null],
      ['c-locker-store', 'LockerWriter.java', 'document-write', 'MongoCollection.replaceOne', null],
    ] },
};
