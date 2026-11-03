// Task 077 owned inputs. Pure generation only: no parsing, repositories or candidate calls.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-arrival-console', 'b-arrival-api', 'c-presence-store', 'd-operator-handbook',
  ...Array.from({ length: 16 }, (_, index) => `e-area-notes-${String(index + 1).padStart(2, '0')}`)];
export function memoryCorpus(pathsPerSource) {
  if (![32, 496].includes(pathsPerSource)) throw new Error('Choose a declared memory diagnostic size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned arrival registration example. Deployment is unspecified.\n`,
  }]));
  const console = sources['a-arrival-console'];
  console['client/arrivals.ts'] = `export async function logArrival(badge: string, site: string) {
  const response = await fetch("/v5/arrivals", {
    method: "POST", headers: { "X-Badge-Session": badge }, body: JSON.stringify({ site }),
  });
  return response.json();
}
`;
  for (const [file, action] of [['AAArrive', 'arrive'], ['BBConfirm', 'confirm'], ['CCForward', 'forward'], ['DDReplay', 'replay']]) {
    console[`client/${file}.vue`] = `<script setup lang="ts">
import { logArrival } from "./arrivals";
const props = defineProps<{ badge: string; site: string }>();
const ${action} = () => logArrival(props.badge, props.site);
</script>
<template><button @click="${action}">Log arrival</button></template>
`;
  }
  console['client/ZZInspect.vue'] = `<script setup lang="ts">
import { inspectPresence } from "./unavailable";
const inspect = () => inspectPresence();
</script>
<template><button @click="inspect">Inspect presence</button></template>
`;
  const api = sources['b-arrival-api'], store = sources['c-presence-store'];
  api['config/routes.json'] = json({ environment: 'training', routes: [{ method: 'POST', path: '/v5/arrivals', handler: 'Arrivals.log' }],
    headerBindings: { 'Arrivals.log.badge': 'X-Badge-Session' } });
  const contract = json({ name: 'ArrivalLogged', version: 5, transport: 'Kafka', environment: 'training', fields: { badge: 'string', site: 'string' } });
  api['contracts/ArrivalLogged.json'] = contract; store['contracts/ArrivalLogged.json'] = contract;
  api['service/Arrivals.java'] = `record ArrivalLogged(String badge, String site) {}
interface EventPublisher { void publish(String topic, String key, ArrivalLogged event); }
final class Arrivals {
  private final EventPublisher publisher;
  Arrivals(EventPublisher publisher) { this.publisher = publisher; }
  void log(String badge, String site) {
    var event = new ArrivalLogged(badge, site);
    publisher.publish("arrivals.logged.v5", badge, event);
  }
}
`;
  store['service/PresenceWriter.java'] = `record ArrivalLogged(String badge, String site) {}
record BadgeKey(String badge) {}
interface MongoCollection { void replaceOne(BadgeKey selector, ArrivalLogged document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, PresenceWriter handler); }
final class PresenceWriter {
  private final MongoCollection collection;
  PresenceWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("arrivals.logged.v5", group, this); }
  void onMessage(ArrivalLogged event) {
    var selector = new BadgeKey(event.badge());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`markers/${String(index).padStart(4, '0')}.ts`] =
      `export const areaMarker = "${source}/${index}";\n`;
  }
  return sources;
}
