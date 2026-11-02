export const sourceNames = ['console', 'parcel-api', 'parcel-worker'];
export const variants = ['small', 'distractions', 'dense', 'ambiguity', 'truncated', 'missing', 'topic', 'environment', 'roots', 'long-chain'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const noop = (prefix, count) => Array.from({ length: count }, (_, index) => `export function ${prefix}${index}() { return ${index}; }`).join('\n') + '\n';
const action = (name, target = 'sendParcel', module = './parcels') => `<script setup lang="ts">\nimport { ${target} } from '${module}';\nconst props = defineProps<{ id: string; tenant: string }>();\nconst ${name} = () => ${target}(props.id, props.tenant);\n</script>\n<template><button @click="${name}">Dispatch parcel</button></template>\n`;

/** New source bytes; no parser, application or previous measurement input imports. */
export function connectedCorpus(variant = 'small') {
  if (!variants.includes(variant)) throw new Error('Unknown connected-admission variant.');
  const files = {
    console: {
      'README.md': '# Parcel console\nVue and legacy clients request parcel dispatch. Server authority is unbound.\n',
      'package.json': json({ name: 'owned-parcel-console', private: true }),
      'src/Dispatch.vue': action('send'),
      'src/parcels.ts': `export async function sendParcel(id: string, tenant: string) {\n  const response = await fetch('/v1/parcels', {\n    method: 'POST', headers: { 'X-Parcel-Tenant': tenant }, body: JSON.stringify({ id }),\n  });\n  return response.json();\n}\n`,
      'legacy/parcels.js': `define(['dojo/request'], function (request) {\n  return function sendLegacy(id, tenant) {\n    return request.post('/legacy/parcels', { headers: { 'X-Parcel-Tenant': tenant }, data: JSON.stringify({ id: id }) });\n  };\n});\n`,
    },
    'parcel-api': {
      'README.md': '# Parcel API\nStatic transport examples only; no server or broker implementation.\n',
      'config/routes.json': json({ routes: [{ method: 'POST', path: '/v1/parcels', handler: 'Parcels.accept' }, { method: 'POST', path: '/legacy/parcels', handler: 'Parcels.accept' }], headerBindings: { 'Parcels.accept.tenant': 'X-Parcel-Tenant' } }),
      'config/local.json': json({ environment: 'local', orderTopic: 'parcel.created.v1' }),
      'contracts/ParcelCreated.json': json({ name: 'ParcelCreated', version: 1, fields: { id: 'string', tenant: 'string' }, transport: 'Kafka', encoding: 'unspecified' }),
      'src/main/java/Parcels.java': `record ParcelCreated(String id, String tenant) {}\ninterface EventPublisher { void publish(String topic, String key, ParcelCreated event); }\nfinal class Parcels {\n  private final EventPublisher publisher;\n  Parcels(EventPublisher publisher) { this.publisher = publisher; }\n  void accept(String id, String tenant) {\n    var event = new ParcelCreated(id, tenant);\n    publisher.publish("parcel.created.v1", tenant, event);\n  }\n}\n`,
    },
    'parcel-worker': {
      'README.md': '# Parcel worker\nThe subscriber and MongoCollection are interfaces without runtime bindings.\n',
      'config/local.json': json({ environment: 'local', orderTopic: 'parcel.created.v1' }),
      'contracts/ParcelCreated.json': json({ name: 'ParcelCreated', version: 1, fields: { id: 'string', tenant: 'string' }, transport: 'Kafka', encoding: 'unspecified' }),
      'src/main/java/ParcelConsumer.java': `record ParcelCreated(String id, String tenant) {}\nrecord Selector(String tenant, String id) {}\ninterface MongoCollection { void replaceOne(Selector selector, ParcelCreated document, boolean upsert); }\ninterface KafkaSubscriber { void subscribe(String topic, String group, ParcelConsumer handler); }\nfinal class ParcelConsumer {\n  private final MongoCollection collection;\n  ParcelConsumer(MongoCollection collection) { this.collection = collection; }\n  void start(KafkaSubscriber kafka, String group) { kafka.subscribe("parcel.created.v1", group, this); }\n  void onMessage(ParcelCreated event) {\n    var selector = new Selector(event.tenant(), event.id());\n    collection.replaceOne(selector, event, true);\n  }\n}\n`,
    },
  };
  if (variant === 'distractions') for (const source of sourceNames) for (let index = 0; index < 72; index++) files[source][`a${String(index).padStart(2, '0')}.ts`] = noop(`spare${index}_`, 1);
  if (variant === 'dense' || variant === 'ambiguity') {
    files.console['a.ts'] = noop('alpha', 80); files.console['b.ts'] = noop('beta', 80);
  }
  if (variant === 'ambiguity') {
    files.console['src/parcels/index.ts'] = 'export function sendParcel() { return "alternate"; }\n';
    files['parcel-api']['zz/Shadow.java'] = 'final class Parcels { void accept(String id, String tenant) {} }\n';
  }
  if (variant === 'truncated') {
    files.console['src/parcels/index.ts'] = noop('hidden', 100) + 'export function sendParcel() { return "hidden alternate"; }\n';
    files['parcel-api']['zz/Shadow.java'] = 'final class Spare {\n' + Array.from({ length: 100 }, (_, index) => `  String spare${index}() { return "spare"; }`).join('\n') + '\n}\nfinal class Parcels { void accept(String id, String tenant) {} }\n';
  }
  if (variant === 'missing') files['parcel-api']['zz/Shadow.java'] = 'final class Parcels { void accept(String id, String tenant) {} }\n';
  if (variant === 'topic') files['parcel-api']['src/main/java/Parcels.java'] = files['parcel-api']['src/main/java/Parcels.java'].replace('publish("parcel.created.v1"', 'publish("parcel.other.v1"');
  if (variant === 'environment') files['parcel-worker']['config/local.json'] = json({ environment: 'preview', orderTopic: 'parcel.created.v1' });
  if (variant === 'roots') { files.console['src/A.vue'] = action('alpha'); files.console['src/B.vue'] = action('beta'); }
  if (variant === 'long-chain') {
    files.console['src/Dispatch.vue'] = action('send', 'hop0', './hops/hop00');
    for (let index = 0; index < 25; index++) {
      const next = index === 24 ? 'sendParcel' : `hop${index + 1}`;
      const module = index === 24 ? '../parcels' : `./hop${String(index + 1).padStart(2, '0')}`;
      files.console[`src/hops/hop${String(index).padStart(2, '0')}.ts`] = `import { ${next} } from '${module}';\nexport function hop${index}(id: string, tenant: string) { return ${next}(id, tenant); }\n`;
    }
  }
  return files;
}
export const criticalNodes = [
  { source: 'console', path: 'src/Dispatch.vue', kind: 'symbol', label: 'send', literal: 'const send =' },
  { source: 'console', path: 'src/parcels.ts', kind: 'http-request', label: 'POST /v1/parcels', literal: 'const response = await fetch(' },
  { source: 'console', path: 'legacy/parcels.js', kind: 'http-request', label: 'POST /legacy/parcels', literal: 'return request.post(' },
  { source: 'parcel-api', path: 'src/main/java/Parcels.java', kind: 'symbol', label: 'Parcels.accept', literal: 'void accept(' },
  { source: 'parcel-api', path: 'src/main/java/Parcels.java', kind: 'event-publish', label: 'Publish ParcelCreated', literal: 'publisher.publish(' },
  { source: 'parcel-worker', path: 'src/main/java/ParcelConsumer.java', kind: 'event-subscribe', label: 'Subscribe via KafkaSubscriber', literal: 'void start(' },
  { source: 'parcel-worker', path: 'src/main/java/ParcelConsumer.java', kind: 'document-write', label: 'MongoCollection.replaceOne', literal: 'collection.replaceOne(' },
];
