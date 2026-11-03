import { configuration as base } from './streaming-qualification-config.js';

// Independent tiny full-application integration only, never frozen diagnostic inputs.
export async function configuration(size: number) {
  const config = await base(0);
  if (![0, 1].includes(size)) throw new Error('Unknown terminal integration variant.');
  let stores = 0;
  class CleanupFailureStore extends config.services.CatalogStore {
    private readonly failClose = ++stores === 2;
    override close() {
      super.close();
      if (this.failClose) throw new Error('Deliberate terminal cleanup failure.');
    }
  }
  const roots = [['AABook', 'book'], ['BBHold', 'hold'], ['CCPin', 'pin'], ['DDRetry', 'retry']].map(([file, action]) =>
    ['a-locker-client', `ui/${file}.vue`, action, 'vue-action']);
  const originals = [...roots.map(row => [row[0], row[1], 1, 6]),
    ['a-locker-client', 'ui/reserve.ts', 1, 3], ['b-locker-api', 'Reservations.java', 1, 10],
    ['b-locker-api', 'routes.json', 1, 1], ['b-locker-api', 'contracts/LockerReserved.json', 1, 1],
    ['c-locker-store', 'contracts/LockerReserved.json', 1, 1], ['c-locker-store', 'LockerWriter.java', 1, 13]];
  const tail = [
    ['a-locker-client', 'ui/reserve.ts', 'symbol', 'reserveLocker', 'function'],
    ['a-locker-client', 'ui/reserve.ts', 'http-request', 'POST /lockers/reservations', null],
    ['b-locker-api', 'routes.json', 'route', 'POST /lockers/reservations', null],
    ['b-locker-api', 'routes.json', 'handler-reference', 'Reservations.reserve', null],
    ['b-locker-api', 'Reservations.java', 'symbol', 'Reservations.reserve', 'java-method'],
    ['b-locker-api', 'Reservations.java', 'event-publish', 'Publish LockerReserved', null],
    ['c-locker-store', 'LockerWriter.java', 'event-subscribe', 'Subscribe via KafkaSubscriber', null],
    ['c-locker-store', 'LockerWriter.java', 'symbol', 'LockerWriter.onMessage', 'java-method'],
    ['c-locker-store', 'LockerWriter.java', 'document-write', 'MongoCollection.replaceOne', null],
  ];
  const complete = { sources: ['a-locker-client', 'b-locker-api', 'c-locker-store'], roots,
    isolatedRoot: config.oracle.isolatedRoot, originals,
    isolatedOriginals: [...originals.slice(0, 4), ['a-locker-client', 'ui/ZZLocate.vue', 1, 5]],
    flows: roots.slice(0, 2).map(row => ({ nodes: [[row[0], row[1], 'symbol', row[2], row[3]], ...tail],
      edges: ['calls', 'performs', 'http-target', 'routes-to', 'implements', 'performs', 'event-delivery', 'dispatch-candidate', 'performs'] })) };
  return { ...config, services: size === 1 ? { ...config.services, CatalogStore: CleanupFailureStore } : config.services,
    oracle: { ...config.oracle, complete, arms: ['same-process'] }, terminalLimits: { watchdogMs: 30000 } };
}
