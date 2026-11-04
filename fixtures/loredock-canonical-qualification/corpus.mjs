// Task 097 fresh owned museum-visit inputs. Pure construction only.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-gallery-ui', 'b-visit-api', 'c-visit-store', 'd-museum-guide',
  ...Array.from({ length: 16 }, (_, index) => `e-gallery-${String(index + 1).padStart(2, '0')}`)];
export function canonicalCorpus(pathsPerSource) {
  if (pathsPerSource !== 498) throw new Error('Unknown frozen canonical qualification size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned synthetic museum visit reservations.\nThese source declarations do not establish running infrastructure or delivery.\n`,
  }]));
  const client = sources['a-gallery-ui'];
  client['ui/visit.ts'] = `export async function reserveVisit(visitor: string, group: string) {
  const response = await fetch("/museum/visits", {
    method: "POST", headers: { "X-Visitor-Id": visitor },
    body: JSON.stringify({ group }),
  });
  return response.json();
}
`;
  for (const [file, action] of [['AAReserve', 'reserve'], ['BBChange', 'change'], ['CCCancel', 'cancel'], ['DDRepeat', 'repeat']])
    client[`ui/${file}.vue`] = `<script setup lang="ts">
import { reserveVisit } from "./visit";
const props = defineProps<{ visitor: string; group: string }>();
const ${action} = () => reserveVisit(props.visitor, props.group);
</script>
<template><button @click="${action}">Reserve museum visit</button></template>
`;
  client['ui/ZZCheck.vue'] = `<script setup lang="ts">
import { checkVisit } from "./missing";
const check = () => checkVisit();
</script>
<template><button @click="check">Check visit</button></template>
`;
  const api = sources['b-visit-api'], store = sources['c-visit-store'];
  api['http/visit.json'] = json({ environment: 'museum', routes: [{ method: 'POST', path: '/museum/visits', handler: 'Visits.reserve' }],
    headerBindings: { 'Visits.reserve.visitor': 'X-Visitor-Id' } });
  const contract = json({ name: 'VisitReserved', version: 5, transport: 'Kafka', environment: 'museum', fields: { visitor: 'string', group: 'string' } });
  api['contracts/VisitReserved.json'] = contract; store['contracts/VisitReserved.json'] = contract;
  api['visits/Visits.java'] = `record VisitReserved(String visitor, String group) {}
interface EventPublisher { void publish(String topic, String key, VisitReserved event); }
final class Visits {
  private final EventPublisher publisher;
  Visits(EventPublisher publisher) { this.publisher = publisher; }
  void reserve(String visitor, String group) {
    var event = new VisitReserved(visitor, group);
    publisher.publish("museum.visit.v5", visitor, event);
  }
}
`;
  store['store/VisitWriter.java'] = `record VisitReserved(String visitor, String group) {}
record VisitorKey(String visitor) {}
interface MongoCollection { void replaceOne(VisitorKey selector, VisitReserved document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, VisitWriter handler); }
final class VisitWriter {
  private final MongoCollection collection;
  VisitWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("museum.visit.v5", group, this); }
  void onMessage(VisitReserved event) {
    var selector = new VisitorKey(event.visitor());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`markers/${String(index).padStart(4, '0')}.ts`] =
      `export const galleryMarker = "${source}/gallery-${index}";\n`;
  }
  return sources;
}
