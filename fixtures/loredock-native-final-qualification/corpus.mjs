import assert from 'node:assert/strict';

// Prospective owned ferry-ticket family. No production or diagnostic module imports.
export function nativeFinalCorpus(pathsPerSource = 499) {
  assert.equal(pathsPerSource, 499);
  const corpus = {
    'a-ferry-console': { 'README.md': '# Ferry ticket console\n' },
    'b-ferry-ticketing': { 'README.md': '# Ferry ticket service\n' },
    'c-ferry-manifest': { 'README.md': '# Ferry passenger manifest\n' },
  };
  for (let index = 1; index <= 17; index++) corpus[`context-${String(index).padStart(2, '0')}`] = {
    'README.md': `# Separate ferry context ${index}\nThis registered source has no supported flow endpoint.\n`,
  };
  const ui = corpus['a-ferry-console'], api = corpus['b-ferry-ticketing'], consumer = corpus['c-ferry-manifest'];
  ui['ui/issue.ts'] = `export function issueTicket(passenger: string, route: string) {
  return fetch("/ferry/tickets", { method: "POST", headers: { "X-Passenger-Id": passenger }, body: JSON.stringify({ route }) });
}
`;
  for (const [file, action] of [['AABook', 'book'], ['BBReserve', 'reserve'], ['CCConfirm', 'confirm'], ['DDRetry', 'retry']])
    ui[`ui/${file}.vue`] = `<script setup lang="ts">
import { issueTicket } from "./issue";
const props = defineProps<{ passenger: string; route: string }>();
const ${action} = () => issueTicket(props.passenger, props.route);
</script>
<template><button @click="${action}">Issue ferry ticket</button></template>
`;
  ui['ui/ZZLocate.vue'] = `<script setup lang="ts">
import { locateTicket } from "./missing";
const locate = () => locateTicket();
</script>
<template><button @click="locate">Locate ticket</button></template>
`;
  api['routes.json'] = JSON.stringify({ environment: 'ferry-native', routes: [{ method: 'POST', path: '/ferry/tickets', handler: 'Tickets.issue' }],
    headerBindings: { 'Tickets.issue.passenger': 'X-Passenger-Id' } });
  const contract = JSON.stringify({ name: 'TicketIssued', version: 4, transport: 'Kafka', environment: 'ferry-native', fields: { passenger: 'string', route: 'string' } });
  api['contracts/TicketIssued.json'] = contract; consumer['contracts/TicketIssued.json'] = contract;
  api['Tickets.java'] = `record TicketIssued(String passenger, String route) {}
interface EventPublisher { void publish(String topic, String key, TicketIssued event); }
final class Tickets {
  private final EventPublisher publisher;
  Tickets(EventPublisher publisher) { this.publisher = publisher; }
  void issue(String passenger, String route) {
    var event = new TicketIssued(passenger, route);
    publisher.publish("ferry.ticket.v4", passenger, event);
  }
}
`;
  consumer['ManifestWriter.java'] = `record TicketIssued(String passenger, String route) {}
record PassengerKey(String passenger) {}
interface MongoCollection { void replaceOne(PassengerKey selector, TicketIssued document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, ManifestWriter handler); }
final class ManifestWriter {
  private final MongoCollection collection;
  ManifestWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("ferry.ticket.v4", group, this); }
  void onMessage(TicketIssued event) {
    var selector = new PassengerKey(event.passenger());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [name, files] of Object.entries(corpus)) {
    const required = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < required; index++) {
      const id = String(index).padStart(5, '0'); files[`markers/native-marker-${id}.ts`] = `// Native ferry context marker ${id} in ${name}.\n`;
    }
    assert.equal(Object.keys(files).length, pathsPerSource);
  }
  return corpus;
}
