// Task 094 fresh owned vault-seal inputs. Pure construction only.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-vault-console', 'b-seal-api', 'c-seal-ledger', 'd-facility-guide',
  ...Array.from({ length: 16 }, (_, index) => `e-vault-${String(index + 1).padStart(2, '0')}`)];
export function workerCorpus(pathsPerSource) {
  if (pathsPerSource !== 498) throw new Error('Unknown frozen worker qualification size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned synthetic vault seal requests.\nDeclarations do not establish deployment, delivery or running infrastructure.\n`,
  }]));
  const client = sources['a-vault-console'];
  client['console/seal.ts'] = `export async function requestSeal(vault: string, owner: string) {
  const response = await fetch("/vault/seals", {
    method: "POST", headers: { "X-Vault-Id": vault },
    body: JSON.stringify({ owner }),
  });
  return response.json();
}
`;
  for (const [file, action] of [['AARequest', 'request'], ['BBRepeat', 'repeat'], ['CCSchedule', 'schedule'], ['DDEmergency', 'emergency']])
    client[`console/${file}.vue`] = `<script setup lang="ts">
import { requestSeal } from "./seal";
const props = defineProps<{ vault: string; owner: string }>();
const ${action} = () => requestSeal(props.vault, props.owner);
</script>
<template><button @click="${action}">Request vault sealing</button></template>
`;
  client['console/ZZInspect.vue'] = `<script setup lang="ts">
import { inspectVault } from "./unavailable";
const inspect = () => inspectVault();
</script>
<template><button @click="inspect">Inspect vault</button></template>
`;
  const api = sources['b-seal-api'], ledger = sources['c-seal-ledger'];
  api['http/seal.json'] = json({ environment: 'facility', routes: [{ method: 'POST', path: '/vault/seals', handler: 'SealRequests.request' }],
    headerBindings: { 'SealRequests.request.vault': 'X-Vault-Id' } });
  const contract = json({ name: 'SealRequested', version: 3, transport: 'Kafka', environment: 'facility', fields: { vault: 'string', owner: 'string' } });
  api['contracts/SealRequested.json'] = contract; ledger['contracts/SealRequested.json'] = contract;
  api['seal/SealRequests.java'] = `record SealRequested(String vault, String owner) {}
interface EventPublisher { void publish(String topic, String key, SealRequested event); }
final class SealRequests {
  private final EventPublisher publisher;
  SealRequests(EventPublisher publisher) { this.publisher = publisher; }
  void request(String vault, String owner) {
    var event = new SealRequested(vault, owner);
    publisher.publish("vault.seal.v3", vault, event);
  }
}
`;
  ledger['ledger/SealLedger.java'] = `record SealRequested(String vault, String owner) {}
record VaultKey(String vault) {}
interface MongoCollection { void replaceOne(VaultKey selector, SealRequested document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, SealLedger handler); }
final class SealLedger {
  private final MongoCollection collection;
  SealLedger(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("vault.seal.v3", group, this); }
  void onMessage(SealRequested event) {
    var selector = new VaultKey(event.vault());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`markers/${String(index).padStart(4, '0')}.ts`] =
      `export const vaultMarker = "${source}/vault-${index}";\n`;
  }
  return sources;
}
