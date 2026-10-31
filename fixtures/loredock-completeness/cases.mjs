// Prospective reviewer expectations. These objects never enter product/model inputs.
const requirement = (id, kind, proposition, evidence, mode = 'all') => ({ id, kind, proposition, evidence, mode });
const answer = (id, proposition, evidence, mode) => requirement(id, 'answer', proposition, evidence, mode);
const qualify = (id, proposition, evidence, mode) => requirement(id, 'qualification', proposition, evidence, mode);
const stockConfigs = ['inventory-worker/config/local.json', 'deployment-local/config/local.json'];
const reservation = ['legacy-admin/src/stock.js', 'inventory-api/config/routes.json'];
const shipment = 'shipping-worker/config/local.json';
const shipmentHandler = 'shipping-worker/src/Shipments.java';
const supplier = 'supplier-sync/src/SupplierSync.java';

export const completenessIntents = [
  {
    id: 'stock-topic-lookup', sourceQuestion: 's04', scope: 'lookup',
    rationale: 'Locate a declared value. A message-schema tour is additional context unless runtime behavior is asserted.',
    requirements: [
      answer('topic-location', 'Identify an original source declaring stock.reserved.v1 as the stock topic.', stockConfigs, 'any'),
      qualify('local-declaration', 'Keep the value scoped to a local configuration declaration.', stockConfigs, 'any'),
    ],
    optionalContext: ['The other local declaration.', 'The StockReserved contract and projection implementation boundaries.'],
    forbiddenAssertions: ['A known production stock topic.', 'A verified live subscription inferred from a declared value.'],
    developmentQuestion: 'Where is the stock event topic declared locally?',
    reservedQuestion: 'Which local configuration file names the stock topic, and what value does it contain?',
  },
  {
    id: 'stock-integration-context', sourceQuestion: 's04', scope: 'context',
    rationale: 'The question explicitly asks for the declaration, message, handler and missing live behavior.',
    requirements: [
      answer('topic-location', 'Identify the local stock.reserved.v1 declaration.', stockConfigs, 'any'),
      answer('message-contract', 'Describe StockReserved and its sku/units message fields.', ['contract-library/contracts/StockReserved.json']),
      answer('projection-port', 'Describe the StockProjection handler delegating to StockStore.project.', ['inventory-worker/src/StockProjection.java']),
      qualify('unimplemented-boundaries', 'Subscriber and database implementations are absent from the supplied worker source; live delivery remains unverified.', ['inventory-worker/README.md']),
    ],
    optionalContext: ['The local warehouse.stock projection target.'],
    forbiddenAssertions: ['A verified live stock subscription.', 'Delivery or persistence guarantees from a port signature.'],
    developmentQuestion: 'Explain the stock event integration: its local topic, message contract, projection handler and what is unimplemented or unverified about live delivery and storage.',
    reservedQuestion: 'For stock events, connect the configured local topic to the message shape and consuming code, and identify the missing subscriber and database implementations.',
  },
  {
    id: 'reservation-route-lookup', sourceQuestion: 's14', scope: 'lookup',
    rationale: 'A literal request/route match supports a candidate endpoint; an unrelated computed plugin is not a prerequisite proven by that match.',
    requirements: [
      answer('request-and-route', 'Identify POST /stock/reservations in legacy administration and the local Reservations.reserve route.', reservation),
      qualify('candidate-route', 'Treat the match as a local static candidate; the relative URL does not prove deployed host or live wiring.', reservation),
    ],
    optionalContext: ['The unresolved dynamic plugin.', 'The Stock interface and missing storage implementation.'],
    forbiddenAssertions: ['A verified deployed connection or host.', 'The plugin necessarily executes the reservation function without a supporting call link.'],
    developmentQuestion: 'Which HTTP path does legacy administration use to reserve stock, and which local route matches it?',
    reservedQuestion: 'Locate the stock-reservation request in the legacy client and its candidate handler in the local route declarations.',
  },
  {
    id: 'reservation-runtime-context', sourceQuestion: 's14', scope: 'context',
    rationale: 'The question explicitly requests path, deployment/plugin uncertainty and the storage boundary.',
    requirements: [
      answer('request-and-route', 'Identify the relative POST /stock/reservations and local Reservations.reserve route.', reservation),
      answer('stock-port', 'Reservations.reserve delegates to a Stock interface; the supplied code has no concrete storage implementation.', ['inventory-api/src/Reservations.java']),
      qualify('unresolved-host', 'Host/deployment wiring remains unknown from the relative request and local route.', reservation),
      qualify('unresolved-plugin', 'The plugin name is computed; the supplied README lacks its runtime/build configuration. Do not invent a plugin-to-reservation dependency.', ['legacy-admin/src/plugin.js', 'legacy-admin/README.md']),
    ],
    optionalContext: ['Other availability routes in the inventory repository.'],
    forbiddenAssertions: ['A concrete resolved plugin target.', 'A proven plugin-to-reservation call chain.', 'Verified deployed routing or stock persistence.'],
    developmentQuestion: 'Explain legacy stock reservation from the HTTP request to the local handler, including unknown host/deployment wiring, dynamic plugin selection and the storage implementation boundary.',
    reservedQuestion: 'What do the legacy stock request and inventory handler establish, and what remains unresolved about their deployed connection, plugin/build configuration and persistence?',
  },
  {
    id: 'shipment-target-lookup', sourceQuestion: 's07', scope: 'lookup',
    rationale: 'A declared database/collection location does not by itself ask for the handler implementation.',
    requirements: [
      answer('projection-target', 'Locate the shipping-worker local declaration of logistics.shipments.', [shipment]),
      qualify('local-target', 'Describe a declared local target without claiming the live storage destination.', [shipment]),
    ],
    optionalContext: ['ShipmentAccepted and ShipmentStore.', 'Missing carrier subscription and storage implementation.'],
    forbiddenAssertions: ['A known live database or deployed projection.', 'Proven storage semantics from a declared target.'],
    developmentQuestion: 'Which local database and collection are declared for shipment projections?',
    reservedQuestion: 'Locate the configured local storage target of shipping-worker.',
  },
  {
    id: 'shipment-runtime-context', sourceQuestion: 's07', scope: 'context',
    rationale: 'The requested explanation spans the local target, handler, carrier subscription and concrete storage.',
    requirements: [
      answer('projection-target', 'Name the local logistics.shipments target.', [shipment]),
      answer('handler-and-port', 'ShipmentAccepted reaches a handler that calls ShipmentStore.save; only the store interface is supplied.', [shipmentHandler]),
      qualify('missing-subscription', 'No live carrier-event subscription is implemented; deployment remains unverified.', ['shipping-worker/README.md']),
      qualify('missing-store', 'The supplied handler has no concrete database implementation or proven persistence behavior.', [shipmentHandler]),
    ],
    optionalContext: ['The external carrier request adapter.'],
    forbiddenAssertions: ['A verified carrier subscription.', 'A working database implementation or delivery guarantee from interface declarations.'],
    developmentQuestion: 'Explain shipment projections: the local storage target, message handler, carrier subscription and concrete database implementation status.',
    reservedQuestion: 'How do the declared shipment target and handler relate, and what evidence is missing for a live carrier subscription and persisted projection?',
  },
  {
    id: 'supplier-cursor-code', sourceQuestion: 's19', scope: 'lookup',
    rationale: 'Describe visible argument flow without turning it into a scheduling or recovery algorithm.',
    requirements: [
      answer('cursor-pass-through', 'SupplierSync.run passes its cursor argument to Supplier.fetchSince and returns that result.', [supplier]),
      qualify('code-scope', 'Describe the visible method/port behavior without claiming a complete synchronization or recovery implementation.', [supplier]),
    ],
    optionalContext: ['The README list of missing external client, scheduling, persistence and recovery.'],
    forbiddenAssertions: ['Cursor persistence or automatic recovery inferred from fetchSince.', 'A verified deployed synchronization job.'],
    developmentQuestion: 'What does SupplierSync.run do with its cursor argument?',
    reservedQuestion: 'Trace the cursor parameter through the supplied supplier synchronization method.',
  },
  {
    id: 'supplier-recovery-context', sourceQuestion: 's19', scope: 'context',
    rationale: 'Recovery and execution questions require the explicit documented missing pieces, not only argument flow.',
    requirements: [
      answer('cursor-pass-through', 'The supplied code accepts a cursor and calls Supplier.fetchSince.', [supplier]),
      qualify('missing-execution', 'The external client and scheduling are not implemented in the supplied sources.', ['supplier-sync/README.md']),
      qualify('missing-recovery', 'Cursor persistence and failure recovery are not implemented there; a restart/resume mechanism is unknown.', ['supplier-sync/README.md']),
    ],
    optionalContext: ['The Gradle build declaration.'],
    forbiddenAssertions: ['Automatic cursor persistence or restart recovery.', 'Global absence of an external scheduler or client outside the supplied sources.'],
    developmentQuestion: 'How does supplier synchronization execute and recover after failure, including its client, scheduling, cursor persistence and restart behavior?',
    reservedQuestion: 'Can the supplied supplier-sync code resume after a crash, and which execution, client and cursor-recovery pieces are missing?',
  },
  {
    id: 'production-topic-control', sourceQuestion: 's16', scope: 'control',
    rationale: 'A production value cannot be filled from a known local value.',
    requirements: [
      answer('production-placeholder', 'Production retains the operator-supplied ORDER_TOPIC placeholder; its concrete value is unknown.', ['deployment-production/config/production.json', 'deployment-production/README.md']),
      qualify('no-local-substitution', 'The local order-topic declaration cannot establish the production value.', ['deployment-local/config/local.json', 'deployment-production/README.md']),
    ],
    optionalContext: ['Preserve the unqualified README/local topic discrepancy if discussing those source values.'],
    forbiddenAssertions: ['A known production topic inferred from local config.', 'A conflict between a known local value and an unknown production value.'],
    developmentQuestion: 'Can the local order topic tell us which topic production actually uses?',
    reservedQuestion: 'Is the production order-topic value determined by the available local and production configuration sources?',
  },
  {
    id: 'tenant-enforcement-control', sourceQuestion: 's12', scope: 'control',
    rationale: 'Identifier carriage cannot establish membership enforcement or global absence of security controls.',
    requirements: [
      answer('identifier-only', 'TenantContext holds a tenant identifier and its library explicitly lacks authentication, membership validation and authorization.', ['tenant-library/src/TenantContext.java', 'tenant-library/README.md']),
      qualify('controls-elsewhere', 'Enforcement elsewhere or in deployment remains unknown; do not infer system-wide absence.', ['tenant-library/README.md']),
    ],
    optionalContext: ['Tenant propagation through request headers or order events.'],
    forbiddenAssertions: ['TenantContext proves tenant membership.', 'No authentication or authorization exists anywhere in the system.'],
    developmentQuestion: 'Does a TenantContext value establish that the caller belongs to the tenant?',
    reservedQuestion: 'Is tenant membership enforced by the supplied tenant context library, and what can we conclude about controls elsewhere?',
  },
  {
    id: 'schema-producer-control', sourceQuestion: 's11', scope: 'control',
    rationale: 'Owning a message definition is distinct from publishing messages at runtime.',
    requirements: [
      answer('schema-declaration', 'The contract library defines the OrderPlaced message shape.', ['contract-library/contracts/OrderPlaced.json']),
      qualify('not-running-producer', 'The schema/library declaration does not establish a running producer; publishing implementation or deployment needs separate evidence.', ['contract-library/README.md']),
    ],
    optionalContext: ['A separately supported candidate publisher in the order API.'],
    forbiddenAssertions: ['The library runs a publisher because it owns the schema.', 'All publishers are enumerated by the contract library.'],
    developmentQuestion: 'Does owning the OrderPlaced definition make the contract library an event producer?',
    reservedQuestion: 'What does the shared OrderPlaced schema establish about whether the library sends messages at runtime?',
  },
  {
    id: 'migration-application-control', sourceQuestion: 's17', scope: 'control',
    rationale: 'Migration source proves a declared operation, not application to a running database.',
    requirements: [
      answer('declared-index', 'A migration declares a unique tenantId/orderId index on shop.orders.', ['database-migrations/migrations/001-orders.js']),
      qualify('unproven-application', 'Source presence does not prove application; no migration runner or database is included and live index state is unknown.', ['database-migrations/README.md']),
    ],
    optionalContext: ['The different analytics index declaration.'],
    forbiddenAssertions: ['The index is installed because its migration exists.', 'Uniqueness, concurrency or idempotency guarantees from an unapplied migration.'],
    developmentQuestion: 'Does the migration file prove that shop.orders already has the unique index?',
    reservedQuestion: 'What evidence shows whether the tenant-and-order uniqueness migration has actually run?',
  },
];

export const completenessCases = ['development', 'reserved'].flatMap(split => completenessIntents.map((intent, index) => ({
  id: `${split === 'development' ? 'd' : 'h'}${String(index + 1).padStart(2, '0')}`,
  split, intentId: intent.id, question: split === 'development' ? intent.developmentQuestion : intent.reservedQuestion,
})));

export const completenessContract = {
  schemaVersion: 'loredock-completeness-contract/1', intents: completenessIntents, cases: completenessCases,
  scoring: {
    semanticMethod: 'An explicit per-proposition reviewer judgment; never keyword matches, citation counts or evidence recall alone.',
    pass: 'Every required answer and qualification is supported; no unsupported material claim or forbidden assertion. Optional context is not an omission failure.',
    qualificationForm: 'A scoped claim or an appropriate unanswered question can establish a limitation; no mandatory magic phrase.',
    additionalClaims: 'Every volunteered assertion remains subject to grounding, scope, conflict and uncertainty rules.',
    attribution: 'Development-agent judgments and independent human acceptance remain separate.',
    historicalGate: 'This prospective rubric does not replace or rescore Task 027; its failed gate remains unchanged.',
  },
  reservation: 'Reserved wordings have no answering-model outputs and must not be used to tune prompts before their one-shot evaluation. Retrieval is inspected; the same agent authored them after earlier failures. This is not a blind independent corpus.',
  modelBudget: 0,
};
