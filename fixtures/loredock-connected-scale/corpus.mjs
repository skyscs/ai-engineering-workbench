export const sourceNames = ['portal', 'provision-api', 'provision-worker', ...Array.from({ length: 17 }, (_, i) => `module-${String(i).padStart(2, '0')}`)];
export const shapes = [120, 600, 3600, 10000];
export const variants = ['base', 'ambiguity', 'truncation', 'roots', 'branches', 'cycle'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const action = (name, target = 'provision', module = './provision') => `<script setup lang="ts">\nimport { ${target} } from '${module}';\nconst props = defineProps<{ device: string; account: string }>();\nconst ${name} = () => ${target}(props.device, props.account);\n</script>\n<template><button @click="${name}">Provision device</button></template>\n`;

/** Independent owned source bytes; no application, parser or earlier fixture imports. */
export function scaleCorpus(totalFiles = 120, variant = 'base') {
  if (!shapes.includes(totalFiles) || !variants.includes(variant)) throw new Error('Unknown scale shape.');
  const files = Object.fromEntries(sourceNames.map(source => [source, { 'README.md': `# ${source}\nOwned device provisioning fixture. Runtime deployment is unknown.\n` }]));
  Object.assign(files.portal, {
    'z/Provision.vue': action('activate'),
    'z/provision.ts': `export async function provision(device: string, account: string) {\n  const response = await fetch('/devices/activate', { method: 'POST', headers: { 'X-Account': account }, body: JSON.stringify({ device }) });\n  return response.json();\n}\n`,
    'z/legacy.js': `define(['dojo/request'], function (request) {\n  return function activateLegacy(device, account) {\n    return request.post('/legacy/activate', { headers: { 'X-Account': account }, data: JSON.stringify({ device: device }) });\n  };\n});\n`,
  });
  Object.assign(files['provision-api'], {
    'config/routes.json': json({ routes: [{ method: 'POST', path: '/devices/activate', handler: 'Devices.activate' }, { method: 'POST', path: '/legacy/activate', handler: 'Devices.activate' }], headerBindings: { 'Devices.activate.account': 'X-Account' } }),
    'config/local.json': json({ environment: 'fixture', orderTopic: 'device.activated.v1' }),
    'contracts/DeviceActivated.json': json({ name: 'DeviceActivated', version: 1, fields: { device: 'string', account: 'string' }, transport: 'Kafka', encoding: 'unspecified' }),
    'z/Devices.java': `record DeviceActivated(String device, String account) {}\ninterface EventPublisher { void publish(String topic, String key, DeviceActivated event); }\nfinal class Devices {\n  private final EventPublisher publisher;\n  Devices(EventPublisher publisher) { this.publisher = publisher; }\n  void activate(String device, String account) {\n    var event = new DeviceActivated(device, account);\n    publisher.publish("device.activated.v1", account, event);\n  }\n}\n`,
  });
  Object.assign(files['provision-worker'], {
    'config/local.json': json({ environment: 'fixture', orderTopic: 'device.activated.v1' }),
    'contracts/DeviceActivated.json': json({ name: 'DeviceActivated', version: 1, fields: { device: 'string', account: 'string' }, transport: 'Kafka', encoding: 'unspecified' }),
    'z/DeviceConsumer.java': `record DeviceActivated(String device, String account) {}\nrecord Selector(String account, String device) {}\ninterface MongoCollection { void replaceOne(Selector selector, DeviceActivated document, boolean upsert); }\ninterface KafkaSubscriber { void subscribe(String topic, String group, DeviceConsumer handler); }\nfinal class DeviceConsumer {\n  private final MongoCollection collection;\n  DeviceConsumer(MongoCollection collection) { this.collection = collection; }\n  void start(KafkaSubscriber kafka, String group) { kafka.subscribe("device.activated.v1", group, this); }\n  void onMessage(DeviceActivated event) {\n    var selector = new Selector(event.account(), event.device());\n    collection.replaceOne(selector, event, true);\n  }\n}\n`,
  });
  if (variant === 'ambiguity') {
    files.portal['z/provision/index.ts'] = 'export function provision() { return "alternate"; }\n';
    files['provision-api']['zz/Alternate.java'] = 'final class Devices { void activate(String device, String account) {} }\n';
  }
  if (variant === 'truncation') {
    files.portal['z/provision/index.ts'] = Array.from({ length: 100 }, (_, i) => `export function hidden${i}() { return ${i}; }`).join('\n') + '\nexport function provision() { return "hidden"; }\n';
    files['provision-api']['zz/Alternate.java'] = 'final class Other {\n' + Array.from({ length: 100 }, (_, i) => `  String spare${i}() { return "spare"; }`).join('\n') + '\n}\nfinal class Devices { void activate(String device, String account) {} }\n';
  }
  if (variant === 'roots') {
    for (let i = 0; i < 6; i++) files.portal[`z/Root${i}.vue`] = action(`root${i}`);
    files.portal['zz/Isolated.vue'] = action('isolated', 'missing', './not-present');
  }
  if (variant === 'branches') {
    files.portal['z/provision.ts'] = Array.from({ length: 75 }, (_, i) => `import { branch${i} } from './branches/b${i}';`).join('\n') + '\nexport function provision(device: string, account: string) {\n' + Array.from({ length: 75 }, (_, i) => `  branch${i}(device, account);`).join('\n') + '\n}\n';
    for (let i = 0; i < 75; i++) files.portal[`z/branches/b${i}.ts`] = `export function branch${i}(device: string, account: string) { return fetch('/devices/activate', { method: 'POST', headers: { 'X-Account': account } }); }\n`;
  }
  if (variant === 'cycle') {
    files.portal['z/provision.ts'] = `import { round } from './round';\nexport function provision(device: string, account: string) { round(device, account); return fetch('/devices/activate', { method: 'POST', headers: { 'X-Account': account } }); }\n`;
    files.portal['z/round.ts'] = `import { provision } from './provision';\nexport function round(device: string, account: string) { return provision(device, account); }\n`;
  }
  for (const [sourceIndex, source] of sourceNames.entries()) {
    const remaining = totalFiles / 20 - Object.keys(files[source]).length;
    if (remaining < 0) throw new Error('Variant needs a larger declared shape.');
    for (let i = 0; i < remaining; i++) files[source][`a/file-${String(i).padStart(4, '0')}.ts`] = i % 2
      ? `export const descriptor${sourceIndex}_${i} = { module: ${sourceIndex}, ordinal: ${i} };\n`
      : `export function utility${sourceIndex}_${i}() { return ${i}; }\n`;
  }
  return files;
}

export const criticalNodes = [
  { source: 'portal', path: 'z/Provision.vue', kind: 'symbol', label: 'activate', literal: 'const activate =' },
  { source: 'portal', path: 'z/provision.ts', kind: 'http-request', label: 'POST /devices/activate', literal: 'fetch(' },
  { source: 'portal', path: 'z/legacy.js', kind: 'http-request', label: 'POST /legacy/activate', literal: 'return request.post(' },
  { source: 'provision-api', path: 'z/Devices.java', kind: 'symbol', label: 'Devices.activate', literal: 'void activate(' },
  { source: 'provision-api', path: 'z/Devices.java', kind: 'event-publish', label: 'Publish DeviceActivated', literal: 'publisher.publish(' },
  { source: 'provision-worker', path: 'z/DeviceConsumer.java', kind: 'event-subscribe', label: 'Subscribe via KafkaSubscriber', literal: 'void start(' },
  { source: 'provision-worker', path: 'z/DeviceConsumer.java', kind: 'document-write', label: 'MongoCollection.replaceOne', literal: 'collection.replaceOne(' },
];
