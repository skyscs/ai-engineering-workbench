import { createHash } from 'node:crypto';
import { Catalog } from '../../src/catalog.js';
import { CatalogStore, CodeAnalysis } from './integration-reference/index.js';
import { SourceGit } from '../../src/git.js';
import { codePathLimits, PathWork } from '../../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../../src/code-paths-metadata.js';
import { declarationMap } from '../../src/system-map.js';
import { compareHeaders } from '../../src/http-headers.js';
import { sha256 } from '../../src/extract.js';
import { CatalogError } from '../../src/types.js';
// @ts-expect-error Offline factory uses source services on independent regression inputs.
import { createCapturePaths } from '../../../../scripts/loredock-capture-memory/paths.mjs';

// Independent tiny locker example. Never imports or runs a frozen diagnostic corpus.
export function corpusFactory(): Record<string, Record<string, string>> {
  const sources: Record<string, Record<string, string>> = {
    'a-locker-client': { 'README.md': '# Locker console\n' },
    'b-locker-api': { 'README.md': '# Locker reservation API\n' },
    'c-locker-store': { 'README.md': '# Locker projection\n' },
  };
  const client = sources['a-locker-client']!;
  client['ui/reserve.ts'] = `export async function reserveLocker(token: string, locker: string) {
  return fetch("/lockers/reservations", { method: "POST", headers: { "X-Locker-Token": token }, body: JSON.stringify({ locker }) });
}
`;
  for (const [file, action] of [['AABook', 'book'], ['BBHold', 'hold'], ['CCPin', 'pin'], ['DDRetry', 'retry']])
    client[`ui/${file}.vue`] = `<script setup lang="ts">
import { reserveLocker } from "./reserve";
const props = defineProps<{ token: string; locker: string }>();
const ${action} = () => reserveLocker(props.token, props.locker);
</script>
<template><button @click="${action}">Reserve locker</button></template>
`;
  client['ui/ZZLocate.vue'] = `<script setup lang="ts">
import { locateLocker } from "./missing";
const locate = () => locateLocker();
</script>
<template><button @click="locate">Locate locker</button></template>
`;
  const api = sources['b-locker-api']!, store = sources['c-locker-store']!;
  api['routes.json'] = JSON.stringify({ environment: 'regression', routes: [{ method: 'POST', path: '/lockers/reservations', handler: 'Reservations.reserve' }],
    headerBindings: { 'Reservations.reserve.token': 'X-Locker-Token' } });
  const contract = JSON.stringify({ name: 'LockerReserved', version: 2, transport: 'Kafka', environment: 'regression', fields: { token: 'string', locker: 'string' } });
  api['contracts/LockerReserved.json'] = contract; store['contracts/LockerReserved.json'] = contract;
  api['Reservations.java'] = `record LockerReserved(String token, String locker) {}
interface EventPublisher { void publish(String topic, String key, LockerReserved event); }
final class Reservations {
  private final EventPublisher publisher;
  Reservations(EventPublisher publisher) { this.publisher = publisher; }
  void reserve(String token, String locker) {
    var event = new LockerReserved(token, locker);
    publisher.publish("locker.reserved.v2", token, event);
  }
}
`;
  store['LockerWriter.java'] = `record LockerReserved(String token, String locker) {}
record TokenKey(String token) {}
interface MongoCollection { void replaceOne(TokenKey selector, LockerReserved document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, LockerWriter handler); }
final class LockerWriter {
  private final MongoCollection collection;
  LockerWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("locker.reserved.v2", group, this); }
  void onMessage(LockerReserved event) {
    var selector = new TokenKey(event.token());
    collection.replaceOne(selector, event, true);
  }
}
`;
  return sources;
}

export const config = {
  size: { files: 14, codeFiles: 8, facts: 21 },
  oracle: {
    arms: ['same-process', 'reopened-process', 'instrumentation-control'],
    sourceCount: 3,
    selectedRoot: ['a-locker-client', 'ui/AABook.vue', 'book', 'vue-action'],
    isolatedRoot: ['a-locker-client', 'ui/ZZLocate.vue', 'locate', 'vue-action'],
    resources: { sampleIntervalMs: 5 }, diagnostic: { phaseRecords: 64, queryIdentities: 128 },
    limits: { work: 1000000, projectionBytes: 524288, receiptBytes: 655360, textBytes: 65536, spans: 30, sources: 20 },
    requiredCapturePhases: ['operation-start', 'snapshot-before', 'snapshot-after', 'metadata-after', 'facts-after', 'domains-after',
      'resolution-after', 'admission-after', 'path-final-before', 'path-final-after', 'receipt-projection', 'receipt-originals',
      'receipt-publication-before', 'receipt-publication-after', 'operation-end'],
  },
  corpusFactory,
  expectedCorpusHash: createHash('sha256').update(JSON.stringify(corpusFactory())).digest('hex'),
  services: { Catalog, CatalogStore, SourceGit, CodeAnalysis,
    CodePaths: createCapturePaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError }) },
};
