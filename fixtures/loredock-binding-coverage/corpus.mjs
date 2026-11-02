export const sourceNames = ['booking-web', 'booking-api', 'booking-worker', ...Array.from({ length: 17 }, (_, i) => `support-${String(i).padStart(2, '0')}`)];
export const shapes = [200, 800, 2400, 4000, 10000];
export const variants = ['base', 'alternatives', 'truncated', 'unsupported-target', 'missing-target', 'java-gap', 'java-case', 'consumer-alternative', 'roots', 'branches', 'cycle', 'symlink-target', 'opaque-ancestor', 'gitlink'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const plain = text => ({ mode: '100644', text });
const action = (name, imported = 'reserveBooking', module = '../zz/client') => `<script setup lang="ts">\nimport { ${imported} } from '${module}';\nconst props = defineProps<{ reference: string; tenant: string }>();\nconst ${name} = () => ${imported}(props.reference, props.tenant);\n</script>\n<template><button @click="${name}">Reserve booking</button></template>\n`;
const client = `export async function reserveBooking(reference: string, tenant: string) {\n  const response = await fetch('/bookings/reserve', { method: 'POST', headers: { 'X-Booking-Tenant': tenant }, body: JSON.stringify({ reference }) });\n  return response.json();\n}\n`;
export const opaqueCommit = 'tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\nauthor Fixture <fixture@example.invalid> 1760000000 +0000\ncommitter Fixture <fixture@example.invalid> 1760000000 +0000\n\nOwned opaque source boundary\n';

/** Fresh owned bytes; no application, parser or earlier fixture imports. */
export function bindingCorpus(totalFiles = 200, variant = 'base') {
  if (!shapes.includes(totalFiles) || !variants.includes(variant)) throw new Error('Unknown binding-coverage shape.');
  const files = Object.fromEntries(sourceNames.map(source => [source, { 'README.md': plain(`# ${source}\nOwned booking example. Deployment and runtime dispatch are unresolved.\n`) }]));
  Object.assign(files['booking-web'], {
    'src/Reserve.vue': plain(action('reserve')),
    'zz/client.ts': plain(client),
    'src/legacy.js': plain(`define(['dojo/request'], function (request) {\n  return function reserveLegacy(reference, tenant) {\n    return request.post('/legacy/bookings', { headers: { 'X-Booking-Tenant': tenant }, data: JSON.stringify({ reference: reference }) });\n  };\n});\n`),
  });
  Object.assign(files['booking-api'], {
    'config/routes.json': plain(json({ routes: [{ method: 'POST', path: '/bookings/reserve', handler: 'Bookings.reserve' }, { method: 'POST', path: '/legacy/bookings', handler: 'Bookings.reserve' }], headerBindings: { 'Bookings.reserve.tenant': 'X-Booking-Tenant' } })),
    'config/development.json': plain(json({ environment: 'development', orderTopic: 'booking.reserved.v1' })),
    'contracts/BookingReserved.json': plain(json({ name: 'BookingReserved', version: 1, fields: { reference: 'string', tenant: 'string' }, transport: 'Kafka', encoding: 'unspecified' })),
    'src/Bookings.java': plain(`record BookingReserved(String reference, String tenant) {}\ninterface EventPublisher { void publish(String topic, String key, BookingReserved event); }\nfinal class Bookings {\n  private final EventPublisher publisher;\n  Bookings(EventPublisher publisher) { this.publisher = publisher; }\n  void reserve(String reference, String tenant) {\n    var event = new BookingReserved(reference, tenant);\n    publisher.publish("booking.reserved.v1", tenant, event);\n  }\n}\n`),
  });
  Object.assign(files['booking-worker'], {
    'config/development.json': plain(json({ environment: 'development', orderTopic: 'booking.reserved.v1' })),
    'contracts/BookingReserved.json': plain(json({ name: 'BookingReserved', version: 1, fields: { reference: 'string', tenant: 'string' }, transport: 'Kafka', encoding: 'unspecified' })),
    'src/BookingConsumer.java': plain(`record BookingReserved(String reference, String tenant) {}\nrecord Selector(String tenant, String reference) {}\ninterface MongoCollection { void replaceOne(Selector selector, BookingReserved document, boolean upsert); }\ninterface KafkaSubscriber { void subscribe(String topic, String group, BookingConsumer handler); }\nfinal class BookingConsumer {\n  private final MongoCollection collection;\n  BookingConsumer(MongoCollection collection) { this.collection = collection; }\n  void start(KafkaSubscriber kafka, String group) { kafka.subscribe("booking.reserved.v1", group, this); }\n  void onMessage(BookingReserved event) {\n    var selector = new Selector(event.tenant(), event.reference());\n    collection.replaceOne(selector, event, true);\n  }\n}\n`),
  });
  if (variant === 'alternatives') {
    files['booking-web']['zz/client.js'] = plain('export function reserveBooking() { return "second target"; }\n');
    files['booking-api']['zz/Shadow.java'] = plain('final class Bookings { void reserve(String reference, String tenant) {} }\n');
  }
  if (variant === 'truncated') {
    files['booking-web']['zz/client/index.ts'] = plain(Array.from({ length: 100 }, (_, i) => `export function filler${i}() { return ${i}; }`).join('\n') + '\nexport function reserveBooking() { return "hidden"; }\n');
    files['booking-api']['zz/Shadow.java'] = plain('final class Spare {\n' + Array.from({ length: 100 }, (_, i) => `  String filler${i}() { return "filler"; }`).join('\n') + '\n}\nfinal class Bookings { void reserve(String reference, String tenant) {} }\n');
  }
  if (variant === 'unsupported-target') files['booking-web']['zz/client.js'] = plain('export const reserveBooking = () => "unsupported export";\n');
  if (variant === 'missing-target') delete files['booking-web']['zz/client.ts'];
  if (variant === 'java-gap') files['booking-worker']['zz/Unrelated.java'] = plain('public @interface Unrelated { String value(); }\n');
  if (variant === 'java-case') files['booking-api']['zz/Shadow.JAVA'] = plain('final class Bookings { void reserve(String reference, String tenant) {} }\n');
  if (variant === 'consumer-alternative') files['booking-worker']['zz/Shadow.java'] = plain(files['booking-worker']['src/BookingConsumer.java'].text);
  if (variant === 'roots') {
    for (let i = 0; i < 5; i++) files['booking-web'][`src/Root${i}.vue`] = plain(action(`root${i}`));
    files['booking-web']['src/ZIsolated.vue'] = plain(action('isolated', 'unknownTarget', './not-present'));
  }
  if (variant === 'branches') {
    files['booking-web']['zz/client.ts'] = plain(Array.from({ length: 72 }, (_, i) => `import { route${i} } from './branches/r${i}';`).join('\n') + '\nexport function reserveBooking(reference: string, tenant: string) {\n' + Array.from({ length: 72 }, (_, i) => `  route${i}(reference, tenant);`).join('\n') + '\n}\n');
    for (let i = 0; i < 72; i++) files['booking-web'][`zz/branches/r${i}.ts`] = plain(`export function route${i}(reference: string, tenant: string) { return fetch('/bookings/reserve', { method: 'POST', headers: { 'X-Booking-Tenant': tenant } }); }\n`);
  }
  if (variant === 'cycle') {
    files['booking-web']['zz/client.ts'] = plain(`import { returnVisit } from './loop';\nexport function reserveBooking(reference: string, tenant: string) { returnVisit(reference, tenant); return fetch('/bookings/reserve', { method: 'POST', headers: { 'X-Booking-Tenant': tenant } }); }\n`);
    files['booking-web']['zz/loop.ts'] = plain(`import { reserveBooking } from './client';\nexport function returnVisit(reference: string, tenant: string) { return reserveBooking(reference, tenant); }\n`);
  }
  if (variant === 'symlink-target') {
    files['booking-web']['zz/client.ts'] = { mode: '120000', text: 'client/index.ts' };
    files['booking-web']['zz/client/index.ts'] = plain(client);
  }
  if (variant === 'opaque-ancestor') {
    files['booking-web']['src/Reserve.vue'] = plain(action('reserve', 'reserveBooking', '../opaque/client'));
    files['booking-web'].opaque = { mode: '120000', text: 'zz' };
  }
  if (variant === 'gitlink') files['booking-worker'].opaque = { mode: '160000', text: opaqueCommit };
  for (const [sourceIndex, source] of sourceNames.entries()) {
    const remaining = totalFiles / 20 - Object.keys(files[source]).length;
    if (remaining < 0) throw new Error('Variant exceeds the declared source shape.');
    for (let i = 0; i < remaining; i++) files[source][`a/entry-${String(i).padStart(4, '0')}.ts`] = plain(i % 2
      ? `export const caption${sourceIndex}_${i} = { source: ${sourceIndex}, label: "owned-${i}" };\n`
      : `export function readCaption${sourceIndex}_${i}() { return "owned-${i}"; }\n`);
  }
  return files;
}

export const criticalNodes = [
  { source: 'booking-web', path: 'src/Reserve.vue', kind: 'symbol', label: 'reserve', literal: 'const reserve =' },
  { source: 'booking-web', path: 'zz/client.ts', kind: 'http-request', label: 'POST /bookings/reserve', literal: 'fetch(' },
  { source: 'booking-web', path: 'src/legacy.js', kind: 'http-request', label: 'POST /legacy/bookings', literal: 'return request.post(' },
  { source: 'booking-api', path: 'src/Bookings.java', kind: 'symbol', label: 'Bookings.reserve', literal: 'void reserve(' },
  { source: 'booking-api', path: 'src/Bookings.java', kind: 'event-publish', label: 'Publish BookingReserved', literal: 'publisher.publish(' },
  { source: 'booking-worker', path: 'src/BookingConsumer.java', kind: 'event-subscribe', label: 'Subscribe via KafkaSubscriber', literal: 'void start(' },
  { source: 'booking-worker', path: 'src/BookingConsumer.java', kind: 'document-write', label: 'MongoCollection.replaceOne', literal: 'collection.replaceOne(' },
];
