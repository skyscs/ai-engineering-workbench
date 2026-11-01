// Prospective mechanical checks over the unchanged synthetic capacity fixture.
const expected = (source, path, symbol) => ({ source, path, symbol });
export const symbolLookupCases = [
  { id: 's01', query: 'loadProbe000179', expected: [expected('portal', 'load/probe-0179.ts', 'loadProbe000179')] },
  { id: 's02', query: 'loadProbe100179', expected: [expected('reporting-api', 'load/probe-0179.ts', 'loadProbe100179')] },
  { id: 's03', query: 'loadProbe190179', expected: [expected('supplier-sync', 'load/probe-0179.ts', 'loadProbe190179')] },
  { id: 's04', query: 'Orders.accept', expected: [expected('order-api', 'src/main/java/Orders.java', 'Orders.accept')], outsideDefaultGraph: true },
  { id: 's05', query: 'accept', expected: [
    expected('order-api', 'src/main/java/Orders.java', 'Orders.accept'),
    expected('inventory-worker', 'src/StockProjection.java', 'StockProjection.accept'),
    expected('shipping-worker', 'src/Shipments.java', 'Shipments.accept'),
    expected('notification-worker', 'src/Notify.java', 'Notify.accept')
  ] },
  { id: 's06', query: 'Orders', expected: [expected('order-api', 'src/main/java/Orders.java', 'Orders.accept')] },
  { id: 's07', query: 'OrderBadge', expected: [], expectedGap: 'unsupported-vue-envelope' },
  { id: 's08', query: 'loadprobe190179', expected: [], reason: 'Case-sensitive mismatch; this does not imply the correctly cased function is absent.' },
  { id: 's09', query: 'nonexistentSyntheticSymbol048', expected: [], reason: 'Literal no-match; this does not establish absence of system behavior.' }
];
