// Task 089 fresh owned observatory-maintenance inputs. Pure construction only.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-observation-console', 'b-maintenance-api', 'c-station-ledger', 'd-field-manual',
  ...Array.from({ length: 16 }, (_, index) => `e-observatory-${String(index + 1).padStart(2, '0')}`)];
export function compactCorpus(pathsPerSource) {
  if (pathsPerSource !== 494) throw new Error('Unknown frozen compact qualification size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned synthetic observatory maintenance.\nSource declarations do not establish live infrastructure or deployment.\n`,
  }]));
  const client = sources['a-observation-console'];
  client['console/maintenance.ts'] = `export async function planMaintenance(station: string, technician: string) {
  const response = await fetch("/observatory/maintenance", {
    method: "POST", headers: { "X-Station-Id": station },
    body: JSON.stringify({ technician }),
  });
  return response.json();
}
`;
  for (const [file, action] of [['AAPlan', 'plan'], ['BBAssign', 'assign'], ['CCRetry', 'retry'], ['DDConfirm', 'confirm']])
    client[`console/${file}.vue`] = `<script setup lang="ts">
import { planMaintenance } from "./maintenance";
const props = defineProps<{ station: string; technician: string }>();
const ${action} = () => planMaintenance(props.station, props.technician);
</script>
<template><button @click="${action}">Plan station maintenance</button></template>
`;
  client['console/ZZInspect.vue'] = `<script setup lang="ts">
import { inspectStation } from "./absent";
const inspect = () => inspectStation();
</script>
<template><button @click="inspect">Inspect station</button></template>
`;
  const api = sources['b-maintenance-api'], ledger = sources['c-station-ledger'];
  api['http/maintenance.json'] = json({ environment: 'observatory', routes: [{ method: 'POST', path: '/observatory/maintenance', handler: 'Maintenance.plan' }],
    headerBindings: { 'Maintenance.plan.station': 'X-Station-Id' } });
  const contract = json({ name: 'MaintenancePlanned', version: 3, transport: 'Kafka', environment: 'observatory', fields: { station: 'string', technician: 'string' } });
  api['contracts/MaintenancePlanned.json'] = contract; ledger['contracts/MaintenancePlanned.json'] = contract;
  api['maintenance/Maintenance.java'] = `record MaintenancePlanned(String station, String technician) {}
interface EventPublisher { void publish(String topic, String key, MaintenancePlanned event); }
final class Maintenance {
  private final EventPublisher publisher;
  Maintenance(EventPublisher publisher) { this.publisher = publisher; }
  void plan(String station, String technician) {
    var event = new MaintenancePlanned(station, technician);
    publisher.publish("station.maintenance.v3", station, event);
  }
}
`;
  ledger['ledger/MaintenanceWriter.java'] = `record MaintenancePlanned(String station, String technician) {}
record StationKey(String station) {}
interface MongoCollection { void replaceOne(StationKey selector, MaintenancePlanned document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, MaintenanceWriter handler); }
final class MaintenanceWriter {
  private final MongoCollection collection;
  MaintenanceWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("station.maintenance.v3", group, this); }
  void onMessage(MaintenancePlanned event) {
    var selector = new StationKey(event.station());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`stations/${String(index).padStart(4, '0')}.ts`] =
      `export const stationMarker = "${source}/station-${index}";\n`;
  }
  return sources;
}
