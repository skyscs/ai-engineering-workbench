import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { javaFacts } from '../src/code-java.js';
import { typescriptFacts } from '../src/code-typescript.js';

const fixture = (file: string) => readFile(new URL('../../../fixtures/loredock/repos/' + file, import.meta.url), 'utf8');

test('the code adapters recover the supported pilot syntax without running it', async () => {
  const client = typescriptFacts(await fixture('portal/src/orders.ts'), 'src/orders.ts');
  assert.equal(client.symbols[0]!.name, 'submitOrder');
  assert.deepEqual(client.operations.map(operation => operation.properties), [{ method: 'POST', path: '/api/orders', baseExpression: 'import.meta.env.VITE_API_BASE', adapter: 'fetch', requestHeaderStatus: 'literal', requestHeaderNames: '["Content-Type","X-Tenant"]' }]);
  const vue = typescriptFacts(await fixture('portal/src/Checkout.vue'), 'src/Checkout.vue');
  assert.equal(vue.symbols[0]!.role, 'vue-action');
  assert.equal(vue.calls[0]!.module, './orders'); assert.equal(vue.calls[0]!.imported, 'submitOrder');
  const dojo = typescriptFacts(await fixture('portal/legacy/orders.js'), 'legacy/orders.js');
  assert.equal(dojo.symbols[0]!.role, 'amd-function'); assert.equal(dojo.operations[0]!.properties.path, '/legacy/orders');
  const publisher = javaFacts(await fixture('order-api/src/main/java/Orders.java'));
  assert.equal(publisher.operations[0]!.kind, 'event-publish'); assert.equal(publisher.operations[0]!.properties.payloadType, 'OrderPlaced');
  const worker = javaFacts(await fixture('order-worker/src/main/java/OrderConsumer.java'));
  assert.deepEqual(worker.operations.map(operation => operation.kind), ['event-subscribe', 'document-write']);
  assert.equal(worker.records.OrderPlaced, publisher.records.OrderPlaced);
  assert.deepEqual([...client.gaps, ...vue.gaps, ...dojo.gaps, ...publisher.gaps, ...worker.gaps], []);
});

test('comments, strings, nested functions and shadowed JavaScript bindings do not become HTTP calls', () => {
  const examples = [
    `export function submit(fetch: unknown) { fetch('/api/orders', {method:'POST'}); }`,
    `const fetch = fake; export function submit() { fetch('/api/orders', {method:'POST'}); }`,
    `export function submit() { const note = "fetch('/api/orders')"; /* fetch('/api/orders') */ }`,
    `export function submit() { function unused() { fetch('/api/orders'); } }`,
    `fetch = fake; export function submit() { fetch('/api/orders'); }`,
    `globalThis.fetch = fake; export function submit() { fetch('/api/orders'); }`,
  ];
  for (const source of examples) assert.equal(typescriptFacts(source, 'client.ts').operations.length, 0, source);
  const shadow = typescriptFacts(`import {submitOrder} from './orders'; export function caller(submitOrder: unknown) { submitOrder(); }`, 'client.ts');
  assert.equal(shadow.calls.length, 0); assert.ok(shadow.gaps.includes('shadowed-or-reassigned-import'));
});

test('dynamic HTTP options, paths, AMD shapes and unsupported Vue envelopes remain gaps', () => {
  const examples = [
    `export function submit() { fetch(target, {method:'POST'}); }`,
    'export function submit() { fetch(`/api/${id}`, {method:"POST"}); }',
    `export function submit() { fetch('/api/orders', {method:verb}); }`,
    `export function submit() { fetch('/api/orders', {method:'POST', ...options}); }`,
    `export function submit() { fetch('/api/orders', {method:'POST', method:'GET'}); }`,
    `export function submit() { fetch('/api/orders', options); }`,
  ];
  for (const source of examples) { const facts = typescriptFacts(source, 'client.ts'); assert.equal(facts.operations.length, 0, source); assert.ok(facts.gaps.length); }
  assert.equal(typescriptFacts(`define(['custom/request'], function(request) { return function submit() { request.post('/orders'); }; });`, 'legacy.js').operations.length, 0);
  assert.equal(typescriptFacts(`<script setup>fetch('/orders')</script><template><button @click="dynamic()">Go</button></template>`, 'client.vue').symbols.length, 0);
  assert.ok(typescriptFacts('export function broken( {', 'client.ts').gaps.includes('invalid-typescript-syntax'));
});

test('Java roles require declared receiver interfaces and typed payloads', async () => {
  const publisher = await fixture('order-api/src/main/java/Orders.java');
  const untyped = publisher.replace('private final EventPublisher publisher;', 'private final OtherPublisher publisher;');
  assert.equal(javaFacts(untyped).operations.length, 0);
  const wrong = publisher.replace('publisher.publish(topic, tenantId + ":" + orderId, event);', 'publisher.publish(topic, tenantId + ":" + orderId, orderId);');
  assert.equal(javaFacts(wrong).operations.length, 0);
  const literal = publisher.replace('publisher.publish(topic, tenantId + ":" + orderId, event);', 'String note = "publisher.publish(topic, key, event)"; /* publisher.publish(topic, key, event); */');
  assert.equal(javaFacts(literal).operations.length, 0);
  const shadowed = publisher.replace('var event =', 'String publisher = "not an interface"; var event =');
  assert.equal(javaFacts(shadowed).operations.length, 0);
});

test('unsupported Java features and excessive syntax fail closed', async () => {
  const publisher = await fixture('order-api/src/main/java/Orders.java');
  for (const source of [publisher + '\\u000a', publisher.replace('final class Orders', 'final class Orders extends Base'), publisher + '{', publisher.replace('Accepted accept', 'List<Accepted> accept')]) {
    const facts = javaFacts(source); assert.equal(facts.operations.length, 0); assert.ok(facts.gaps.length);
  }
  assert.ok(javaFacts('/*'.repeat(12000)).gaps.length);
  const anonymous = publisher.replace('var event =', 'var unused = new Other(a,b,c,d,e,f,g,h,i,j) { void hidden() { publisher.publish(topic, key, event); } }; var event =');
  const nested = javaFacts(anonymous);
  assert.equal(nested.operations.length, 0); assert.ok(nested.gaps.includes('unsupported-nested-java-code'));
  const deep = typescriptFacts('export function deep(){ return ' + '('.repeat(500) + 'x' + ')'.repeat(500) + '; }', 'deep.ts');
  assert.equal(deep.operations.length, 0); assert.ok(deep.gaps.length);
});
