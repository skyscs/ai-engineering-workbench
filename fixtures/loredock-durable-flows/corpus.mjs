import { readFile } from 'node:fs/promises';
import { evidenceFiles } from '../loredock/oracle.mjs';

export const sources = ['portal', 'order-api', 'order-worker'];
export const variants = ['small', 'long-path', 'dense', 'ambiguous', 'topic', 'environment', 'syntax-gap'];

/** Deterministic owned inputs; no application/parser imports. */
export async function flowCorpus(variant = 'small') {
  if (!variants.includes(variant)) throw new Error('Unknown durable-flow corpus variant.');
  const files = Object.fromEntries(sources.map(source => [source, {}]));
  for (const [source, file] of Object.values(evidenceFiles)) {
    files[source][file] = await readFile(new URL(`../loredock/repos/${source}/${file}`, import.meta.url), 'utf8');
  }
  if (variant === 'long-path') for (const source of sources) for (let index = 0; index < 120; index++) {
    files[source][`a${String(index).padStart(3, '0')}.ts`] = `export function filler${index}() { return ${index}; }\n`;
  }
  if (variant === 'dense') files.portal['a.ts'] = Array.from({ length: 200 }, (_, index) =>
    `export function dense${index}() { return ${index}; }`).join('\n') + '\n';
  if (variant === 'ambiguous') {
    files.portal['src/orders.js'] = 'export function submitOrder() { return "ambiguous local target"; }\n';
    files['order-api']['src/main/java/Shadow.java'] = 'final class Orders { void accept(String orderId, String tenantId) {} }\n';
  }
  if (variant === 'topic' || variant === 'environment') {
    files.portal['src/Checkout.vue'] = files.portal['src/Checkout.vue'].replace("from './orders'", "from 'owned-order-client'");
    if (variant === 'topic') files['order-api']['src/main/java/Orders.java'] = files['order-api']['src/main/java/Orders.java']
      .replace('publisher.publish(topic,', 'publisher.publish("orders.other.v1",');
    else files['order-worker']['config/local.json'] = files['order-worker']['config/local.json'].replace('"local"', '"staging"');
  }
  if (variant === 'syntax-gap') files.portal['bad.ts'] = 'export function broken(\n';
  return files;
}

// Authored from source text, before collecting graph or parser results.
export const supportOracle = [
  { source: 'portal', path: 'src/Checkout.vue', kind: 'symbol', literal: 'const submit =', label: 'submit' },
  { source: 'portal', path: 'src/orders.ts', kind: 'http-request', literal: 'const response = await fetch(', label: 'POST /api/orders' },
  { source: 'portal', path: 'legacy/orders.js', kind: 'http-request', literal: "return request.post('/legacy/orders'", label: 'POST /legacy/orders' },
  { source: 'order-api', path: 'src/main/java/Orders.java', kind: 'symbol', literal: 'Accepted accept(', label: 'Orders.accept' },
  { source: 'order-api', path: 'src/main/java/Orders.java', kind: 'event-publish', literal: 'publisher.publish(', label: 'Publish OrderPlaced' },
  { source: 'order-worker', path: 'src/main/java/OrderConsumer.java', kind: 'event-subscribe', literal: 'kafka.subscribe(', label: 'Subscribe via KafkaSubscriber' },
  { source: 'order-worker', path: 'src/main/java/OrderConsumer.java', kind: 'document-write', literal: 'collection.replaceOne(', label: 'MongoCollection.replaceOne' },
];
export const baselineEdges = { calls: 1, performs: 5, 'routes-to': 2, implements: 1, 'http-target': 2, 'event-delivery': 1, 'dispatch-candidate': 1 };
