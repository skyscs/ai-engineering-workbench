// Static synthetic sources only. These examples are never installed or executed.
const json = value => JSON.stringify(value, null, 2) + '\n';
const pkg = name => json({ name: `@synthetic/${name}`, version: '0.0.0', private: true });
const pom = name => `<project><modelVersion>4.0.0</modelVersion><groupId>synthetic</groupId><artifactId>${name}</artifactId><version>0.0.0</version></project>\n`;
const repo = (role, description, files) => ({ role, files: { 'README.md': `# ${role}\n\n${description}\n\nStatic synthetic source. Deployment and runtime behavior are unverified.\n`, ...files } });

export const additionalRepositories = {
  'checkout-bff': repo('Checkout request facade', 'The browser-facing adapter forwards an order request to order-api. It propagates a tenant header; authentication and retries are not implemented.', {
    'package.json': pkg('checkout-bff'),
    'src/checkout.ts': "export async function checkout(payload: unknown, tenant: string) {\n  return fetch('http://order-api.local/api/orders', { method: 'POST', headers: { 'x-tenant-id': tenant }, body: JSON.stringify(payload) });\n}\n",
  }),
  'inventory-api': repo('Stock reservation and availability applications', 'This repository contains two logical applications: Reservations changes reserved quantities; Availability reads stock. Repository identity does not imply one deployed service.', {
    'pom.xml': pom('inventory-applications'),
    'config/routes.json': json({ environment: 'local', routes: [{ method: 'POST', path: '/stock/reservations', handler: 'Reservations.reserve' }, { method: 'GET', path: '/stock/availability', handler: 'Availability.check' }] }),
    'src/Reservations.java': 'package synthetic.stock;\nclass Reservations {\n  interface Stock { void reserve(String sku, int units); }\n  void reserve(Stock stock, String sku, int units) { stock.reserve(sku, units); }\n}\n',
    'src/Availability.java': 'package synthetic.stock;\nclass Availability {\n  interface Stock { int available(String sku); }\n  int check(Stock stock, String sku) { return stock.available(sku); }\n}\n',
  }),
  'inventory-worker': repo('Stock event projection', 'Consumes StockReserved through an application port. StockReserved is separate from OrderPlaced. The subscriber and database implementations are absent.', {
    'pom.xml': pom('inventory-worker'),
    'config/local.json': json({ environment: 'local', stockTopic: 'stock.reserved.v1', mongoDatabase: 'warehouse', mongoCollection: 'stock' }),
    'src/StockProjection.java': 'package synthetic.stock;\nrecord StockReserved(String sku, int units) {}\ninterface StockStore { void project(StockReserved event); }\nclass StockProjection { void accept(StockStore store, StockReserved event) { store.project(event); } }\n',
  }),
  'shipping-api': repo('Shipment request adapter', 'Previously called fulfillment-api. Sends shipment requests to an external carrier. Carrier internals, delivery guarantees and retry behavior are unavailable.', {
    'package.json': pkg('shipping-api'),
    'src/carrier.ts': "export async function requestShipment(orderId: string) {\n  return fetch('https://carrier.example.invalid/shipments', { method: 'POST', body: JSON.stringify({ orderId }) });\n}\n",
    'docs/rename.md': '# Rename record\n\nThe source component name changed from fulfillment-api to shipping-api. This record does not identify deployed instances.\n',
  }),
  'shipping-worker': repo('Shipment event projection', 'Consumes ShipmentAccepted and updates the shipment projection. No link to a live carrier event subscription is implemented.', {
    'pom.xml': pom('shipping-worker'),
    'config/local.json': json({ environment: 'local', shipmentTopic: 'shipments.accepted.v1', mongoDatabase: 'logistics', mongoCollection: 'shipments' }),
    'src/Shipments.java': 'package synthetic.shipping;\nrecord ShipmentAccepted(String orderId, String shipmentId) {}\ninterface ShipmentStore { void save(ShipmentAccepted event); }\nclass Shipments { void accept(ShipmentStore store, ShipmentAccepted event) { store.save(event); } }\n',
  }),
  'payment-adapter': repo('External payment gateway port', 'Declares a payment gateway port only. No billing ledger, settlement implementation, retry policy or provider internals are included.', {
    'package.json': pkg('payment-adapter'),
    'src/gateway.ts': 'export interface PaymentGateway {\n  authorize(orderId: string, minorUnits: number): Promise<{ reference: string }>;\n}\n',
  }),
  'notification-worker': repo('Order notification consumer', 'An additional OrderPlaced consumer produces a mail request. Mail delivery and event subscription are ports without implementations. A new consumer expands discovery scope.', {
    'pom.xml': pom('notification-worker'),
    'config/local.json': json({ environment: 'local', orderTopic: 'orders.placed.v2', consumerGroup: 'order-notifications' }),
    'src/Notify.java': 'package synthetic.notifications;\nrecord OrderPlaced(String orderId, String tenantId, long createdAtMillis) {}\ninterface Mail { void send(String tenantId, String orderId); }\nclass Notify { void accept(Mail mail, OrderPlaced event) { mail.send(event.tenantId(), event.orderId()); } }\n',
  }),
  'reporting-api': repo('Analytics order reader', 'Reads the analytics database orders collection. The identically named shop.orders projection is a different declared database scope. These declarations do not prove data replication.', {
    'package.json': pkg('reporting-api'),
    'config/local.json': json({ environment: 'local', mongoDatabase: 'analytics', mongoCollection: 'orders' }),
    'src/report.js': "export async function countOrders(database) {\n  return database.collection('orders').countDocuments({});\n}\n",
  }),
  'contract-library': repo('Shared message declarations', 'Defines message shapes for consumers and publishers. Owning a schema file does not make this library a running producer or service.', {
    'package.json': pkg('contract-library'),
    'contracts/OrderPlaced.json': json({ name: 'OrderPlaced', version: 2, fields: { orderId: 'string', tenantId: 'string', createdAtMillis: 'epoch milliseconds' }, key: 'tenantId:orderId', transport: 'Kafka', encoding: 'unspecified' }),
    'contracts/StockReserved.json': json({ name: 'StockReserved', version: 1, fields: { sku: 'string', units: 'integer' }, transport: 'Kafka' }),
  }),
  'tenant-library': repo('Tenant context propagation library', 'Carries a tenant identifier between callers. It does not authenticate users, validate membership or implement authorization.', {
    'pom.xml': pom('tenant-context'),
    'src/TenantContext.java': 'package synthetic.identity;\npublic record TenantContext(String tenantId) {}\n',
  }),
  'ui-components': repo('Presentation components', 'Reusable Vue display components. OrderBadge renders a label and makes no backend request; its name is not an API dependency.', {
    'package.json': pkg('ui-components'),
    'src/OrderBadge.vue': '<script setup lang="ts">\ndefineProps<{ label: string }>();\n</script>\n<template><span>{{ label }}</span></template>\n',
  }),
  'legacy-admin': repo('Legacy administration client', 'Dojo AMD stock administration view. A computed plugin name is intentionally unresolved; the build configuration and runtime plugin are unavailable.', {
    'package.json': pkg('legacy-admin'),
    'src/stock.js': "define(['dojo/request'], function(request) {\n  return { reserve: function(data) { return request.post('/stock/reservations', { data: data }); } };\n});\n",
    'src/plugin.js': "define([], function() {\n  return function(name) { require(['plugins/' + name], function(plugin) { plugin.open(); }); };\n});\n",
  }),
  'deployment-local': repo('Local deployment declarations', 'Documents an intended development composition. Local values are not production values; no deployment is executed or observed.', {
    'config/local.json': json({ environment: 'local', orderTopic: 'orders.placed.v2', stockTopic: 'stock.reserved.v1', carrierHost: 'carrier.example.invalid' }),
    'compose.yaml': 'services:\n  checkout:\n    image: synthetic/checkout-bff:local\n  orders:\n    image: synthetic/order-api:local\n',
  }),
  'deployment-production': repo('Production configuration placeholders', 'The production order topic and image digest must be supplied by the operator. Their actual values are unknown. Do not substitute local values.', {
    'config/production.json': json({ environment: 'production', orderTopic: '${ORDER_TOPIC}', apiImage: '${ORDER_API_IMAGE_DIGEST}' }),
    'deployment.yaml': 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: orders\nspec:\n  replicas: 2\n',
  }),
  'database-migrations': repo('Mongo index migration source', 'A migration declares a compound tenantId/orderId unique index for shop.orders. Source presence does not prove it was applied. No migration runner or database is included.', {
    'migrations/001-orders.js': "export async function up(client) {\n  await client.db('shop').collection('orders').createIndex({ tenantId: 1, orderId: 1 }, { unique: true });\n}\n",
    'migrations/002-analytics.js': "export async function up(client) {\n  await client.db('analytics').collection('orders').createIndex({ day: 1 });\n}\n",
  }),
  'architecture-docs': repo('System documentation and decisions', 'The synthetic system covers orders, stock, shipping and notification projections, with shared contracts and separate deployment sources. Billing settlement and carrier internals are external gaps.', {
    'docs/glossary.md': '# Terms\n\nReservation: a requested hold on stock; it is not payment authorization.\nProjection: a derived view; it is not proof of the authoritative live data owner.\n',
    'docs/adr-001.md': '# Separate analytics reads\n\nThe documented decision separates analytics queries from the operational order projection to keep reporting work independent. No benchmark or production deployment validates that rationale here.\n',
    'docs/old-runbook.md': '# Historical order runbook\n\nThis older runbook names orders.created.v1. Current local configuration names orders.placed.v2. Preserve the disagreement when explaining the documented setup.\n',
  }),
  'supplier-sync': repo('Supplier inventory import job', 'A Java batch port requests supplier stock since a cursor. The external client, scheduling, cursor persistence and failure recovery are not implemented.', {
    'build.gradle': "plugins { id 'java' }\ngroup = 'synthetic.supply'\nversion = '0.0.0'\n",
    'src/SupplierSync.java': 'package synthetic.supply;\ninterface Supplier { String fetchSince(String cursor); }\nclass SupplierSync { String run(Supplier supplier, String cursor) { return supplier.fetchSince(cursor); } }\n',
  }),
};
