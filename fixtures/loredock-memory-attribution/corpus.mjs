// Task 079 owned inputs. Pure generation only: no parsing, repositories or candidate calls.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-loan-desk', 'b-loan-service', 'c-loan-ledger', 'd-shift-handbook',
  ...Array.from({ length: 16 }, (_, index) => `e-reading-guide-${String(index + 1).padStart(2, '0')}`)];
export function attributionCorpus(pathsPerSource) {
  if (![28, 498].includes(pathsPerSource)) throw new Error('Choose a declared memory diagnostic size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned library loan example. Runtime deployment is unspecified.\n`,
  }]));
  const desk = sources['a-loan-desk'];
  desk['desk/loans.ts'] = `export async function openLoan(reader: string, volume: string) {
  const reply = await fetch("/v6/loans", {
    method: "POST", headers: { "X-Reader-Key": reader }, body: JSON.stringify({ volume }),
  });
  return reply.json();
}
`;
  for (const [file, action] of [['AALend', 'lend'], ['BBIssue', 'issue'], ['CCRenew', 'renew'], ['DDRepeat', 'repeat']]) {
    desk[`desk/${file}.vue`] = `<script setup lang="ts">
import { openLoan } from "./loans";
const props = defineProps<{ reader: string; volume: string }>();
const ${action} = () => openLoan(props.reader, props.volume);
</script>
<template><button @click="${action}">Open loan</button></template>
`;
  }
  desk['desk/ZZSearch.vue'] = `<script setup lang="ts">
import { searchShelf } from "./unavailable";
const search = () => searchShelf();
</script>
<template><button @click="search">Search shelves</button></template>
`;
  const api = sources['b-loan-service'], store = sources['c-loan-ledger'];
  api['routing/loans.json'] = json({ environment: 'practice', routes: [{ method: 'POST', path: '/v6/loans', handler: 'Loans.open' }],
    headerBindings: { 'Loans.open.reader': 'X-Reader-Key' } });
  const contract = json({ name: 'LoanOpened', version: 6, transport: 'Kafka', environment: 'practice', fields: { reader: 'string', volume: 'string' } });
  api['contracts/LoanOpened.json'] = contract; store['contracts/LoanOpened.json'] = contract;
  api['loans/Loans.java'] = `record LoanOpened(String reader, String volume) {}
interface EventPublisher { void publish(String topic, String key, LoanOpened event); }
final class Loans {
  private final EventPublisher publisher;
  Loans(EventPublisher publisher) { this.publisher = publisher; }
  void open(String reader, String volume) {
    var event = new LoanOpened(reader, volume);
    publisher.publish("loans.opened.v6", reader, event);
  }
}
`;
  store['ledger/LoanWriter.java'] = `record LoanOpened(String reader, String volume) {}
record ReaderKey(String reader) {}
interface MongoCollection { void replaceOne(ReaderKey selector, LoanOpened document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, LoanWriter handler); }
final class LoanWriter {
  private final MongoCollection collection;
  LoanWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("loans.opened.v6", group, this); }
  void onMessage(LoanOpened event) {
    var selector = new ReaderKey(event.reader());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`probes/${String(index).padStart(4, '0')}.ts`] =
      `export const shelfMarker = "${source}/${index}";\n`;
  }
  return sources;
}
