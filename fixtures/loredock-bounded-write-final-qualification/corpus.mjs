import assert from 'node:assert/strict';

// Prospective owned campsite family. Pure source generation, never a service warmup.
export function boundedWriteFinalCorpus(pathsPerSource = 500) {
  assert.equal(pathsPerSource, 500);
  const corpus = {
    'a-camp-console': { 'README.md': '# Campsite booking console\n' },
    'b-camp-bookings': { 'README.md': '# Campsite reservation service\n' },
    'c-camp-occupancy': { 'README.md': '# Campsite occupancy projection\n' },
  };
  for (let i = 1; i <= 17; i++) corpus[`context-${String(i).padStart(2, '0')}`] = {
    'README.md': `# Separate campsite context ${i}\nThis registered source has no supported flow endpoint.\n`,
  };
  const ui = corpus['a-camp-console'], api = corpus['b-camp-bookings'], consumer = corpus['c-camp-occupancy'];
  ui['ui/reserve.ts'] = `export function reserveSite(guest: string, site: string) {
  return fetch("/campground/bookings", { method: "POST", headers: { "X-Camp-Guest": guest }, body: JSON.stringify({ site }) });
}
`;
  for (const [file, action] of [['AABook', 'book'], ['BBExtend', 'extend'], ['CCConfirm', 'confirm'], ['DDRetry', 'retry']])
    ui[`ui/${file}.vue`] = `<script setup lang="ts">
import { reserveSite } from "./reserve";
const props = defineProps<{ guest: string; site: string }>();
const ${action} = () => reserveSite(props.guest, props.site);
</script>
<template><button @click="${action}">Reserve campsite</button></template>
`;
  ui['ui/ZZLocate.vue'] = `<script setup lang="ts">
import { locateSite } from "./missing";
const locate = () => locateSite();
</script>
<template><button @click="locate">Locate campsite</button></template>
`;
  api['routes.json'] = JSON.stringify({ environment: 'camp-native', routes: [{ method: 'POST', path: '/campground/bookings', handler: 'Bookings.reserve' }],
    headerBindings: { 'Bookings.reserve.guest': 'X-Camp-Guest' } });
  const contract = JSON.stringify({ name: 'SiteBooked', version: 5, transport: 'Kafka', environment: 'camp-native', fields: { guest: 'string', site: 'string' } });
  api['contracts/SiteBooked.json'] = contract; consumer['contracts/SiteBooked.json'] = contract;
  api['Bookings.java'] = `record SiteBooked(String guest, String site) {}
interface EventPublisher { void publish(String topic, String key, SiteBooked event); }
final class Bookings {
  private final EventPublisher publisher;
  Bookings(EventPublisher publisher) { this.publisher = publisher; }
  void reserve(String guest, String site) {
    var event = new SiteBooked(guest, site);
    publisher.publish("camp.site.v5", guest, event);
  }
}
`;
  consumer['OccupancyWriter.java'] = `record SiteBooked(String guest, String site) {}
record GuestKey(String guest) {}
interface MongoCollection { void replaceOne(GuestKey selector, SiteBooked document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, OccupancyWriter handler); }
final class OccupancyWriter {
  private final MongoCollection collection;
  OccupancyWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("camp.site.v5", group, this); }
  void onMessage(SiteBooked event) {
    var selector = new GuestKey(event.guest());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [name, files] of Object.entries(corpus)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let i = 0; i < count; i++) {
      const id = String(i).padStart(5, '0'); files[`markers/camp-marker-${id}.ts`] = `// Campsite context marker ${id} in ${name}.\n`;
    }
    assert.equal(Object.keys(files).length, pathsPerSource);
  }
  return corpus;
}
