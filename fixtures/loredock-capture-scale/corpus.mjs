// Fresh Task 075 inputs only. This generator performs no I/O, parsing or path projection.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-sensor-ui', 'b-reading-intake', 'c-reading-index', 'd-calibration-guide',
  ...Array.from({ length: 16 }, (_, index) => `e-reading-notes-${String(index + 1).padStart(2, '0')}`)];
export function scaleCorpus(pathsPerSource) {
  if (![24, 124, 499].includes(pathsPerSource)) throw new Error('Choose a frozen size vector.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, { 'README.md': `# ${name}\nOwned sensor-reading qualification source. No runtime deployment is specified.\n` }]));
  const ui = sources['a-sensor-ui'];
  ui['app/readings.ts'] = `export async function sendReading(device: string, sample: string) {
  const response = await fetch("/v4/readings", {
    method: "POST", headers: { "X-Reading-Device": device }, body: JSON.stringify({ sample }),
  });
  return response.json();
}
`;
  for (const [file, action] of [['AARecord', 'record'], ['BBRetry', 'retry'], ['CCCollect', 'collect'], ['DDRepeat', 'repeat']]) {
    ui[`app/${file}.vue`] = `<script setup lang="ts">
import { sendReading } from "./readings";
const props = defineProps<{ device: string; sample: string }>();
const ${action} = () => sendReading(props.device, props.sample);
</script>
<template><button @click="${action}">Record reading</button></template>
`;
  }
  ui['app/ZZInspect.vue'] = `<script setup lang="ts">
import { inspectReading } from "./absent";
const inspect = () => inspectReading();
</script>
<template><button @click="inspect">Inspect reading</button></template>
`;
  const intake = sources['b-reading-intake'], index = sources['c-reading-index'];
  intake['config/routes.json'] = json({ environment: 'laboratory', routes: [{ method: 'POST', path: '/v4/readings', handler: 'Readings.accept' }],
    headerBindings: { 'Readings.accept.device': 'X-Reading-Device' } });
  const contract = json({ name: 'ReadingAccepted', version: 4, fields: { device: 'string', sample: 'string' }, transport: 'Kafka', environment: 'laboratory' });
  intake['contracts/ReadingAccepted.json'] = contract; index['contracts/ReadingAccepted.json'] = contract;
  intake['app/Readings.java'] = `record ReadingAccepted(String device, String sample) {}
interface EventPublisher { void publish(String topic, String key, ReadingAccepted event); }
final class Readings {
  private final EventPublisher publisher;
  Readings(EventPublisher publisher) { this.publisher = publisher; }
  void accept(String device, String sample) {
    var event = new ReadingAccepted(device, sample);
    publisher.publish("readings.accepted.v4", device, event);
  }
}
`;
  index['app/ReadingWriter.java'] = `record ReadingAccepted(String device, String sample) {}
record DeviceKey(String device) {}
interface MongoCollection { void replaceOne(DeviceKey selector, ReadingAccepted document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, ReadingWriter handler); }
final class ReadingWriter {
  private final MongoCollection collection;
  ReadingWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("readings.accepted.v4", group, this); }
  void onMessage(ReadingAccepted event) {
    var selector = new DeviceKey(event.device());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    for (let index = 0, missing = pathsPerSource - Object.keys(files).length; index < missing; index++) {
      files[`fill/${String(index).padStart(4, '0')}.ts`] = `export const marker = "${source}-${index}";\n`;
    }
  }
  return sources;
}
