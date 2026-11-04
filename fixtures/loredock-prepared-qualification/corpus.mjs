// Task 091 fresh owned greenhouse-calibration inputs. Pure construction only.
const json = value => JSON.stringify(value, null, 2) + '\n';
export const sourceNames = ['a-greenhouse-panel', 'b-calibration-api', 'c-sensor-journal', 'd-growing-guide',
  ...Array.from({ length: 16 }, (_, index) => `e-greenhouse-${String(index + 1).padStart(2, '0')}`)];
export function preparedCorpus(pathsPerSource) {
  if (pathsPerSource !== 492) throw new Error('Unknown frozen prepared qualification size.');
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    'README.md': `# ${name}\nOwned synthetic greenhouse calibration.\nSource declarations do not establish live infrastructure or deployment.\n`,
  }]));
  const client = sources['a-greenhouse-panel'];
  client['panel/calibration.ts'] = `export async function startCalibration(sensor: string, operator: string) {
  const response = await fetch("/greenhouse/calibration", {
    method: "POST", headers: { "X-Sensor-Id": sensor },
    body: JSON.stringify({ operator }),
  });
  return response.json();
}
`;
  for (const [file, action] of [['AAStart', 'start'], ['BBQueue', 'queue'], ['CCReset', 'reset'], ['DDVerify', 'verify']])
    client[`panel/${file}.vue`] = `<script setup lang="ts">
import { startCalibration } from "./calibration";
const props = defineProps<{ sensor: string; operator: string }>();
const ${action} = () => startCalibration(props.sensor, props.operator);
</script>
<template><button @click="${action}">Request sensor calibration</button></template>
`;
  client['panel/ZZInspect.vue'] = `<script setup lang="ts">
import { inspectSensor } from "./absent";
const inspect = () => inspectSensor();
</script>
<template><button @click="inspect">Inspect sensor</button></template>
`;
  const api = sources['b-calibration-api'], journal = sources['c-sensor-journal'];
  api['http/calibration.json'] = json({ environment: 'greenhouse', routes: [{ method: 'POST', path: '/greenhouse/calibration', handler: 'Calibration.start' }],
    headerBindings: { 'Calibration.start.sensor': 'X-Sensor-Id' } });
  const contract = json({ name: 'CalibrationRequested', version: 4, transport: 'Kafka', environment: 'greenhouse', fields: { sensor: 'string', operator: 'string' } });
  api['contracts/CalibrationRequested.json'] = contract; journal['contracts/CalibrationRequested.json'] = contract;
  api['calibration/Calibration.java'] = `record CalibrationRequested(String sensor, String operator) {}
interface EventPublisher { void publish(String topic, String key, CalibrationRequested event); }
final class Calibration {
  private final EventPublisher publisher;
  Calibration(EventPublisher publisher) { this.publisher = publisher; }
  void start(String sensor, String operator) {
    var event = new CalibrationRequested(sensor, operator);
    publisher.publish("sensor.calibration.v4", sensor, event);
  }
}
`;
  journal['journal/CalibrationWriter.java'] = `record CalibrationRequested(String sensor, String operator) {}
record SensorKey(String sensor) {}
interface MongoCollection { void replaceOne(SensorKey selector, CalibrationRequested document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, CalibrationWriter handler); }
final class CalibrationWriter {
  private final MongoCollection collection;
  CalibrationWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("sensor.calibration.v4", group, this); }
  void onMessage(CalibrationRequested event) {
    var selector = new SensorKey(event.sensor());
    collection.replaceOne(selector, event, true);
  }
}
`;
  for (const [source, files] of Object.entries(sources)) {
    const count = pathsPerSource - Object.keys(files).length;
    for (let index = 0; index < count; index++) files[`sensors/${String(index).padStart(4, '0')}.ts`] =
      `export const sensorMarker = "${source}/sensor-${index}";\n`;
  }
  return sources;
}
