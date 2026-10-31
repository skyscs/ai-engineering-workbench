# Prospective answer-completeness rubric

Generated from [the frozen contract](cases.mjs). This is a reviewer worksheet, not a model prompt.

This prospective rubric does not replace or rescore Task 027; its failed gate remains unchanged.

Reserved wordings have no answering-model outputs and must not be used to tune prompts before their one-shot evaluation. Retrieval is inspected; the same agent authored them after earlier failures. This is not a blind independent corpus.

A case passes only when every required proposition and qualification is supported and no forbidden or materially unsupported assertion appears.
Scope may be conveyed by a qualified claim or an appropriate unanswered question. Optional context is not a required omission.
All volunteered claims still require evidence. Evidence availability is a mechanical prerequisite, not a semantic judgment.

Evidence names below are logical references into the frozen twenty-source fixture, not local working-tree paths.
The listed references define the mechanical retrieval check. A semantic reviewer must also consider equivalent issued source evidence and record that judgment; a missing listed file alone is not an answer failure.

## stock-topic-lookup

Scope: lookup. Origin: s04.

Locate a declared value. A message-schema tour is additional context unless runtime behavior is asserted.

**d01 (development)**: Where is the stock event topic declared locally?

**h01 (reserved)**: Which local configuration file names the stock topic, and what value does it contain?

Required propositions:

- [ ] topic-location (answer): Identify an original source declaring stock.reserved.v1 as the stock topic.

  Evidence (at least one alternative): `inventory-worker/config/local.json`, `deployment-local/config/local.json`.

- [ ] local-declaration (qualification): Keep the value scoped to a local configuration declaration.

  Evidence (at least one alternative): `inventory-worker/config/local.json`, `deployment-local/config/local.json`.

Optional context:

- The other local declaration.
- The StockReserved contract and projection implementation boundaries.

Forbidden assertions:

- A known production stock topic.
- A verified live subscription inferred from a declared value.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## stock-integration-context

Scope: context. Origin: s04.

The question explicitly asks for the declaration, message, handler and missing live behavior.

**d02 (development)**: Explain the stock event integration: its local topic, message contract, projection handler and what is unimplemented or unverified about live delivery and storage.

**h02 (reserved)**: For stock events, connect the configured local topic to the message shape and consuming code, and identify the missing subscriber and database implementations.

Required propositions:

- [ ] topic-location (answer): Identify the local stock.reserved.v1 declaration.

  Evidence (at least one alternative): `inventory-worker/config/local.json`, `deployment-local/config/local.json`.

- [ ] message-contract (answer): Describe StockReserved and its sku/units message fields.

  Evidence (all listed references): `contract-library/contracts/StockReserved.json`.

- [ ] projection-port (answer): Describe the StockProjection handler delegating to StockStore.project.

  Evidence (all listed references): `inventory-worker/src/StockProjection.java`.

- [ ] unimplemented-boundaries (qualification): Subscriber and database implementations are absent from the supplied worker source; live delivery remains unverified.

  Evidence (all listed references): `inventory-worker/README.md`.

Optional context:

- The local warehouse.stock projection target.

Forbidden assertions:

- A verified live stock subscription.
- Delivery or persistence guarantees from a port signature.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## reservation-route-lookup

Scope: lookup. Origin: s14.

A literal request/route match supports a candidate endpoint; an unrelated computed plugin is not a prerequisite proven by that match.

**d03 (development)**: Which HTTP path does legacy administration use to reserve stock, and which local route matches it?

**h03 (reserved)**: Locate the stock-reservation request in the legacy client and its candidate handler in the local route declarations.

Required propositions:

- [ ] request-and-route (answer): Identify POST /stock/reservations in legacy administration and the local Reservations.reserve route.

  Evidence (all listed references): `legacy-admin/src/stock.js`, `inventory-api/config/routes.json`.

- [ ] candidate-route (qualification): Treat the match as a local static candidate; the relative URL does not prove deployed host or live wiring.

  Evidence (all listed references): `legacy-admin/src/stock.js`, `inventory-api/config/routes.json`.

Optional context:

- The unresolved dynamic plugin.
- The Stock interface and missing storage implementation.

Forbidden assertions:

- A verified deployed connection or host.
- The plugin necessarily executes the reservation function without a supporting call link.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## reservation-runtime-context

Scope: context. Origin: s14.

The question explicitly requests path, deployment/plugin uncertainty and the storage boundary.

**d04 (development)**: Explain legacy stock reservation from the HTTP request to the local handler, including unknown host/deployment wiring, dynamic plugin selection and the storage implementation boundary.

**h04 (reserved)**: What do the legacy stock request and inventory handler establish, and what remains unresolved about their deployed connection, plugin/build configuration and persistence?

Required propositions:

- [ ] request-and-route (answer): Identify the relative POST /stock/reservations and local Reservations.reserve route.

  Evidence (all listed references): `legacy-admin/src/stock.js`, `inventory-api/config/routes.json`.

- [ ] stock-port (answer): Reservations.reserve delegates to a Stock interface; the supplied code has no concrete storage implementation.

  Evidence (all listed references): `inventory-api/src/Reservations.java`.

- [ ] unresolved-host (qualification): Host/deployment wiring remains unknown from the relative request and local route.

  Evidence (all listed references): `legacy-admin/src/stock.js`, `inventory-api/config/routes.json`.

- [ ] unresolved-plugin (qualification): The plugin name is computed; the supplied README lacks its runtime/build configuration. Do not invent a plugin-to-reservation dependency.

  Evidence (all listed references): `legacy-admin/src/plugin.js`, `legacy-admin/README.md`.

Optional context:

- Other availability routes in the inventory repository.

Forbidden assertions:

- A concrete resolved plugin target.
- A proven plugin-to-reservation call chain.
- Verified deployed routing or stock persistence.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## shipment-target-lookup

Scope: lookup. Origin: s07.

A declared database/collection location does not by itself ask for the handler implementation.

**d05 (development)**: Which local database and collection are declared for shipment projections?

**h05 (reserved)**: Locate the configured local storage target of shipping-worker.

Required propositions:

- [ ] projection-target (answer): Locate the shipping-worker local declaration of logistics.shipments.

  Evidence (all listed references): `shipping-worker/config/local.json`.

- [ ] local-target (qualification): Describe a declared local target without claiming the live storage destination.

  Evidence (all listed references): `shipping-worker/config/local.json`.

Optional context:

- ShipmentAccepted and ShipmentStore.
- Missing carrier subscription and storage implementation.

Forbidden assertions:

- A known live database or deployed projection.
- Proven storage semantics from a declared target.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## shipment-runtime-context

Scope: context. Origin: s07.

The requested explanation spans the local target, handler, carrier subscription and concrete storage.

**d06 (development)**: Explain shipment projections: the local storage target, message handler, carrier subscription and concrete database implementation status.

**h06 (reserved)**: How do the declared shipment target and handler relate, and what evidence is missing for a live carrier subscription and persisted projection?

Required propositions:

- [ ] projection-target (answer): Name the local logistics.shipments target.

  Evidence (all listed references): `shipping-worker/config/local.json`.

- [ ] handler-and-port (answer): ShipmentAccepted reaches a handler that calls ShipmentStore.save; only the store interface is supplied.

  Evidence (all listed references): `shipping-worker/src/Shipments.java`.

- [ ] missing-subscription (qualification): No live carrier-event subscription is implemented; deployment remains unverified.

  Evidence (all listed references): `shipping-worker/README.md`.

- [ ] missing-store (qualification): The supplied handler has no concrete database implementation or proven persistence behavior.

  Evidence (all listed references): `shipping-worker/src/Shipments.java`.

Optional context:

- The external carrier request adapter.

Forbidden assertions:

- A verified carrier subscription.
- A working database implementation or delivery guarantee from interface declarations.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## supplier-cursor-code

Scope: lookup. Origin: s19.

Describe visible argument flow without turning it into a scheduling or recovery algorithm.

**d07 (development)**: What does SupplierSync.run do with its cursor argument?

**h07 (reserved)**: Trace the cursor parameter through the supplied supplier synchronization method.

Required propositions:

- [ ] cursor-pass-through (answer): SupplierSync.run passes its cursor argument to Supplier.fetchSince and returns that result.

  Evidence (all listed references): `supplier-sync/src/SupplierSync.java`.

- [ ] code-scope (qualification): Describe the visible method/port behavior without claiming a complete synchronization or recovery implementation.

  Evidence (all listed references): `supplier-sync/src/SupplierSync.java`.

Optional context:

- The README list of missing external client, scheduling, persistence and recovery.

Forbidden assertions:

- Cursor persistence or automatic recovery inferred from fetchSince.
- A verified deployed synchronization job.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## supplier-recovery-context

Scope: context. Origin: s19.

Recovery and execution questions require the explicit documented missing pieces, not only argument flow.

**d08 (development)**: How does supplier synchronization execute and recover after failure, including its client, scheduling, cursor persistence and restart behavior?

**h08 (reserved)**: Can the supplied supplier-sync code resume after a crash, and which execution, client and cursor-recovery pieces are missing?

Required propositions:

- [ ] cursor-pass-through (answer): The supplied code accepts a cursor and calls Supplier.fetchSince.

  Evidence (all listed references): `supplier-sync/src/SupplierSync.java`.

- [ ] missing-execution (qualification): The external client and scheduling are not implemented in the supplied sources.

  Evidence (all listed references): `supplier-sync/README.md`.

- [ ] missing-recovery (qualification): Cursor persistence and failure recovery are not implemented there; a restart/resume mechanism is unknown.

  Evidence (all listed references): `supplier-sync/README.md`.

Optional context:

- The Gradle build declaration.

Forbidden assertions:

- Automatic cursor persistence or restart recovery.
- Global absence of an external scheduler or client outside the supplied sources.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## production-topic-control

Scope: control. Origin: s16.

A production value cannot be filled from a known local value.

**d09 (development)**: Can the local order topic tell us which topic production actually uses?

**h09 (reserved)**: Is the production order-topic value determined by the available local and production configuration sources?

Required propositions:

- [ ] production-placeholder (answer): Production retains the operator-supplied ORDER_TOPIC placeholder; its concrete value is unknown.

  Evidence (all listed references): `deployment-production/config/production.json`, `deployment-production/README.md`.

- [ ] no-local-substitution (qualification): The local order-topic declaration cannot establish the production value.

  Evidence (all listed references): `deployment-local/config/local.json`, `deployment-production/README.md`.

Optional context:

- Preserve the unqualified README/local topic discrepancy if discussing those source values.

Forbidden assertions:

- A known production topic inferred from local config.
- A conflict between a known local value and an unknown production value.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## tenant-enforcement-control

Scope: control. Origin: s12.

Identifier carriage cannot establish membership enforcement or global absence of security controls.

**d10 (development)**: Does a TenantContext value establish that the caller belongs to the tenant?

**h10 (reserved)**: Is tenant membership enforced by the supplied tenant context library, and what can we conclude about controls elsewhere?

Required propositions:

- [ ] identifier-only (answer): TenantContext holds a tenant identifier and its library explicitly lacks authentication, membership validation and authorization.

  Evidence (all listed references): `tenant-library/src/TenantContext.java`, `tenant-library/README.md`.

- [ ] controls-elsewhere (qualification): Enforcement elsewhere or in deployment remains unknown; do not infer system-wide absence.

  Evidence (all listed references): `tenant-library/README.md`.

Optional context:

- Tenant propagation through request headers or order events.

Forbidden assertions:

- TenantContext proves tenant membership.
- No authentication or authorization exists anywhere in the system.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## schema-producer-control

Scope: control. Origin: s11.

Owning a message definition is distinct from publishing messages at runtime.

**d11 (development)**: Does owning the OrderPlaced definition make the contract library an event producer?

**h11 (reserved)**: What does the shared OrderPlaced schema establish about whether the library sends messages at runtime?

Required propositions:

- [ ] schema-declaration (answer): The contract library defines the OrderPlaced message shape.

  Evidence (all listed references): `contract-library/contracts/OrderPlaced.json`.

- [ ] not-running-producer (qualification): The schema/library declaration does not establish a running producer; publishing implementation or deployment needs separate evidence.

  Evidence (all listed references): `contract-library/README.md`.

Optional context:

- A separately supported candidate publisher in the order API.

Forbidden assertions:

- The library runs a publisher because it owns the schema.
- All publishers are enumerated by the contract library.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

## migration-application-control

Scope: control. Origin: s17.

Migration source proves a declared operation, not application to a running database.

**d12 (development)**: Does the migration file prove that shop.orders already has the unique index?

**h12 (reserved)**: What evidence shows whether the tenant-and-order uniqueness migration has actually run?

Required propositions:

- [ ] declared-index (answer): A migration declares a unique tenantId/orderId index on shop.orders.

  Evidence (all listed references): `database-migrations/migrations/001-orders.js`.

- [ ] unproven-application (qualification): Source presence does not prove application; no migration runner or database is included and live index state is unknown.

  Evidence (all listed references): `database-migrations/README.md`.

Optional context:

- The different analytics index declaration.

Forbidden assertions:

- The index is installed because its migration exists.
- Uniqueness, concurrency or idempotency guarantees from an unapplied migration.

- [ ] Review every additional claim and preserve source disagreements.
- [ ] Record semantic judgments separately from evidence availability.
- [ ] Obtain independent human review before claiming acceptance.

