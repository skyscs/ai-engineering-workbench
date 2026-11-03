// Task 080 owned inputs. Pure generation only: no parsing, repositories or candidate calls.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-device-console', 'b-checkout-api', 'c-custody-ledger', 'd-fleet-handbook',
  ...Array.from({ length: 16 }, (_, index) => `e-zone-notes-${String(index + 1).padStart(2, '0')}`)];
export function allocationCorpus() {
  const pathsPerSource = 497;
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned device checkout example. Runtime wiring is unspecified.\n`,
  }]));
  const desk = sources['a-device-console'];
  desk['ui/checkout.ts'] = `export async function checkoutDevice(operator: string, device: string) {
  const reply = await fetch("/v3/checkouts", {
    method: "POST", headers: { "X-Operator-Tag": operator }, body: JSON.stringify({ device }),
  });
  return reply.json();
}
`;
  for (const [file, action] of [['AAAssign', 'assign'], ['BBCheckout', 'checkout'], ['CCRelease', 'release'], ['DDRetry', 'retry']]) {
    desk[`ui/${file}.vue`] = `<script setup lang="ts">
import { checkoutDevice } from "./checkout";
const props = defineProps<{ operator: string; device: string }>();
const ${action} = () => checkoutDevice(props.operator, props.device);
</script>
<template><button @click="${action}">Checkout device</button></template>
`;
  }
  desk['ui/ZZInspect.vue'] = `<script setup lang="ts">
import { inspectFleet } from "./unavailable";
const inspect = () => inspectFleet();
</script>
<template><button @click="inspect">Inspect fleet</button></template>
`;
  const api = sources['b-checkout-api'], store = sources['c-custody-ledger'];
  api['config/checkouts.json'] = json({ environment: 'simulation', routes: [{ method: 'POST', path: '/v3/checkouts', handler: 'Checkouts.record' }],
    headerBindings: { 'Checkouts.record.operator': 'X-Operator-Tag' } });
  const contract = json({ name: 'CheckoutRecorded', version: 3, transport: 'Kafka', environment: 'simulation', fields: { operator: 'string', device: 'string' } });
  api['contracts/CheckoutRecorded.json'] = contract; store['contracts/CheckoutRecorded.json'] = contract;
  api['checkout/Checkouts.java'] = `record CheckoutRecorded(String operator, String device) {}
interface EventPublisher { void publish(String topic, String key, CheckoutRecorded event); }
final class Checkouts {
  private final EventPublisher publisher;
  Checkouts(EventPublisher publisher) { this.publisher = publisher; }
  void record(String operator, String device) {
    var event = new CheckoutRecorded(operator, device);
    publisher.publish("checkouts.recorded.v3", operator, event);
  }
}
`;
  store['custody/CustodyWriter.java'] = `record CheckoutRecorded(String operator, String device) {}
record OperatorKey(String operator) {}
interface MongoCollection { void replaceOne(OperatorKey selector, CheckoutRecorded document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, CustodyWriter handler); }
final class CustodyWriter {
  private final MongoCollection collection;
  CustodyWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("checkouts.recorded.v3", group, this); }
  void onMessage(CheckoutRecorded event) {
    var selector = new OperatorKey(event.operator());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`probes/${String(index).padStart(4, '0')}.ts`] =
      `export const deviceMarker = "${source}/${index}";\n`;
  }
  return sources;
}
