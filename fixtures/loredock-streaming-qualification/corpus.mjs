// Task 082 owned inputs. Pure generation only, before parser or candidate observation.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-kit-console', 'b-issue-service', 'c-stock-journal', 'd-operations-notes',
  ...Array.from({ length: 16 }, (_, index) => `e-team-guide-${String(index + 1).padStart(2, '0')}`)];
export function qualificationCorpus(pathsPerSource) {
  if (![29, 499].includes(pathsPerSource)) throw new Error('Unknown frozen qualification size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned laboratory kit example. Deployment relationships remain unspecified.\n`,
  }]));
  const console = sources['a-kit-console'];
  console['ui/issues.ts'] = `export async function issueKit(member: string, kit: string) {
  const reply = await fetch("/v4/issues", {
    method: "POST", headers: { "X-Member-Key": member }, body: JSON.stringify({ kit }),
  });
  return reply.json();
}
`;
  for (const [file, action] of [['AAAllocate', 'allocate'], ['BBIssue', 'issue'], ['CCRetry', 'retry'], ['DDDispatch', 'dispatch']])
    console[`ui/${file}.vue`] = `<script setup lang="ts">
import { issueKit } from "./issues";
const props = defineProps<{ member: string; kit: string }>();
const ${action} = () => issueKit(props.member, props.kit);
</script>
<template><button @click="${action}">Issue kit</button></template>
`;
  console['ui/ZZLocate.vue'] = `<script setup lang="ts">
import { lookupKit } from "./unknown";
const locate = () => lookupKit();
</script>
<template><button @click="locate">Locate kit</button></template>
`;
  const api = sources['b-issue-service'], stock = sources['c-stock-journal'];
  api['routing/issues.json'] = json({ environment: 'laboratory', routes: [{ method: 'POST', path: '/v4/issues', handler: 'Issues.issue' }],
    headerBindings: { 'Issues.issue.member': 'X-Member-Key' } });
  const contract = json({ name: 'KitIssued', version: 4, transport: 'Kafka', environment: 'laboratory', fields: { member: 'string', kit: 'string' } });
  api['contracts/KitIssued.json'] = contract; stock['contracts/KitIssued.json'] = contract;
  api['issues/Issues.java'] = `record KitIssued(String member, String kit) {}
interface EventPublisher { void publish(String topic, String key, KitIssued event); }
final class Issues {
  private final EventPublisher publisher;
  Issues(EventPublisher publisher) { this.publisher = publisher; }
  void issue(String member, String kit) {
    var event = new KitIssued(member, kit);
    publisher.publish("kit.issued.v4", member, event);
  }
}
`;
  stock['stock/StockProjector.java'] = `record KitIssued(String member, String kit) {}
record MemberKey(String member) {}
interface MongoCollection { void replaceOne(MemberKey selector, KitIssued document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, StockProjector handler); }
final class StockProjector {
  private final MongoCollection collection;
  StockProjector(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("kit.issued.v4", group, this); }
  void onIssued(KitIssued event) {
    var selector = new MemberKey(event.member());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`markers/${String(index).padStart(4, '0')}.ts`] =
      `export const kitMarker = "${source}/${index}";\n`;
  }
  return sources;
}
