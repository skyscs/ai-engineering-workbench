// Fresh Task 087 owned archive-intake example. Pure construction only.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-intake-desk', 'b-accession-api', 'c-archive-register', 'd-curation-handbook',
  ...Array.from({ length: 16 }, (_, index) => `e-collection-${String(index + 1).padStart(2, '0')}`)];
export function terminalCorpus(pathsPerSource) {
  if (pathsPerSource !== 496) throw new Error('Unknown frozen terminal diagnostic size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nSynthetic archive intake owned by this diagnostic.\nDeployment and broker relationships are intentionally unspecified.\n`,
  }]));
  const desk = sources['a-intake-desk'];
  desk['actions/accession.ts'] = `export async function acceptArchive(reference: string, collection: string) {
  return fetch("/archive/accessions", {
    method: "POST",
    headers: { "X-Archive-Reference": reference },
    body: JSON.stringify({ collection }),
  });
}
`;
  for (const [file, action] of [['AAAccept', 'accept'], ['BBRegister', 'register'], ['CCRetry', 'retry'], ['DDConfirm', 'confirm']])
    desk[`actions/${file}.vue`] = `<script setup lang="ts">
import { acceptArchive } from "./accession";
const props = defineProps<{ reference: string; collection: string }>();
const ${action} = () => acceptArchive(props.reference, props.collection);
</script>
<template><button @click="${action}">Accept archive</button></template>
`;
  desk['actions/ZZSearch.vue'] = `<script setup lang="ts">
import { searchArchive } from "./unavailable";
const search = () => searchArchive();
</script>
<template><button @click="search">Search archive</button></template>
`;
  const api = sources['b-accession-api'], register = sources['c-archive-register'];
  api['routing/accessions.json'] = json({ environment: 'archive', routes: [{ method: 'POST', path: '/archive/accessions', handler: 'Accessions.accept' }],
    headerBindings: { 'Accessions.accept.reference': 'X-Archive-Reference' } });
  const contract = json({ name: 'ArchiveAccepted', version: 6, transport: 'Kafka', environment: 'archive', fields: { reference: 'string', collection: 'string' } });
  api['contracts/ArchiveAccepted.json'] = contract; register['contracts/ArchiveAccepted.json'] = contract;
  api['accessions/Accessions.java'] = `record ArchiveAccepted(String reference, String collection) {}
interface EventPublisher { void publish(String topic, String key, ArchiveAccepted event); }
final class Accessions {
  private final EventPublisher publisher;
  Accessions(EventPublisher publisher) { this.publisher = publisher; }
  void accept(String reference, String collection) {
    var event = new ArchiveAccepted(reference, collection);
    publisher.publish("archive.accepted.v6", reference, event);
  }
}
`;
  register['register/ArchiveWriter.java'] = `record ArchiveAccepted(String reference, String collection) {}
record ReferenceKey(String reference) {}
interface MongoCollection { void replaceOne(ReferenceKey selector, ArchiveAccepted document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, ArchiveWriter handler); }
final class ArchiveWriter {
  private final MongoCollection collection;
  ArchiveWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("archive.accepted.v6", group, this); }
  void onMessage(ArchiveAccepted event) {
    var selector = new ReferenceKey(event.reference());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const remaining = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < remaining; index++) files[`inventory/${String(index).padStart(4, '0')}.ts`] =
      `// Synthetic archival inventory marker.\nexport const accessionMarker = "${source}:${index}";\n`;
  }
  return sources;
}
