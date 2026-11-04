// Fresh small owned development example. This is not a resource-qualification family.
export function corpusFactory(incomplete = false) {
  const corpus = {
    'a-permit-ui': { 'README.md': '# Permit requests\n' },
    'b-permit-api': { 'README.md': '# Permit grants\n' },
    'c-permit-store': { 'README.md': '# Permit projection\n' },
    'z-independent-notes': { 'README.md': '# Undisplayed context\nThis source participates in authority, without a displayed code node.\n' },
  };
  corpus['a-permit-ui']['ui/request.ts'] = `export function requestPermit(tenant: string, permit: string) {
  return fetch("/permits/grants", { method: "POST", headers: { "X-Permit-Tenant": tenant }, body: JSON.stringify({ permit }) });
}
`;
  for (const [file, action] of [['AAApply', 'apply'], ['BBRenew', 'renew'], ['CCRetry', 'retry'], ['DDConfirm', 'confirm']])
    corpus['a-permit-ui'][`ui/${file}.vue`] = `<script setup lang="ts">
import { requestPermit } from "./request";
const props = defineProps<{ tenant: string; permit: string }>();
const ${action} = () => requestPermit(props.tenant, props.permit);
</script>
<template><button @click="${action}">Request permit</button></template>
`;
  corpus['a-permit-ui']['ui/ZZLocate.vue'] = `<script setup lang="ts">
import { locatePermit } from "./missing";
const locate = () => locatePermit();
</script>
<template><button @click="locate">Locate permit</button></template>
`;
  corpus['b-permit-api']['routes.json'] = JSON.stringify({ environment: 'assessment', routes: [{ method: 'POST', path: '/permits/grants', handler: 'Grants.issue' }], headerBindings: { 'Grants.issue.tenant': 'X-Permit-Tenant' } });
  const contract = JSON.stringify({ name: 'PermitGranted', version: 3, transport: 'Kafka', environment: 'assessment', fields: { tenant: 'string', permit: 'string' } });
  corpus['b-permit-api']['contracts/PermitGranted.json'] = contract; corpus['c-permit-store']['contracts/PermitGranted.json'] = contract;
  corpus['b-permit-api']['Grants.java'] = `record PermitGranted(String tenant, String permit) {}
interface EventPublisher { void publish(String topic, String key, PermitGranted event); }
final class Grants {
  private final EventPublisher publisher;
  Grants(EventPublisher publisher) { this.publisher = publisher; }
  void issue(String tenant, String permit) {
    var event = new PermitGranted(tenant, permit);
    publisher.publish("permit.granted.v3", tenant, event);
  }
}
`;
  corpus['c-permit-store']['PermitWriter.java'] = `record PermitGranted(String tenant, String permit) {}
record TenantKey(String tenant) {}
interface MongoCollection { void replaceOne(TenantKey selector, PermitGranted document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, PermitWriter handler); }
final class PermitWriter {
  private final MongoCollection collection;
  PermitWriter(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("permit.granted.v3", group, this); }
  void ${incomplete ? 'onGranted' : 'onMessage'}(PermitGranted event) {
    var selector = new TenantKey(event.tenant());
    collection.replaceOne(selector, event, true);
  }
}
`;
  return corpus;
}
export function expectations(incomplete = false) {
  const common = [
    ['a-permit-ui', 'ui/AAApply.vue', 'symbol', 'apply', 'vue-action'],
    ['a-permit-ui', 'ui/request.ts', 'http-request', 'POST /permits/grants', null],
    ['b-permit-api', 'routes.json', 'handler-reference', 'Grants.issue', null],
    ['b-permit-api', 'Grants.java', 'event-publish', 'Publish PermitGranted', null],
  ];
  const requiredNodes = incomplete ? common : [...common,
    ['c-permit-store', 'PermitWriter.java', 'event-subscribe', 'Subscribe via KafkaSubscriber', null],
    ['c-permit-store', 'PermitWriter.java', 'document-write', 'MongoCollection.replaceOne', null]];
  return { size: { files: 15, codeFiles: 8, facts: 21 }, oracle: { rootCount: 5, sourceCount: 4, defaultFlows: 2, selectedFlows: 1,
    defaultOriginals: incomplete ? 7 : 10, isolatedOriginals: 5, isolated: { reason: 'unresolved-import' },
    isolatedRoot: ['a-permit-ui', 'ui/ZZLocate.vue', 'locate', 'vue-action'], uncitedSource: 'z-independent-notes',
    topic: 'permit.granted.v3', environment: 'assessment', terminalKind: incomplete ? 'event-publish' : 'document-write',
    expectDelivery: !incomplete, ...(incomplete ? { requiredOmission: 'unresolved-consumer-method' } : {}), requiredNodes, selectedRequiredNodes: requiredNodes } };
}
