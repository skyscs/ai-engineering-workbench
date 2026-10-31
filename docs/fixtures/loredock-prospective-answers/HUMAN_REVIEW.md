# Prospective answer review

These are development-agent judgments; independent review is pending. Unchecked boxes are not approval.

[Raw run](answer-result.json) · [Agent judgments](semantic-review.json) · [Frozen contract](evaluation-contract.json)

## d01 (development): Where is the stock event topic declared locally?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The local stock event topic is declared as `stock.reserved.v1` in `deployment-local/config/local.json`.

   Evidence: [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20).

   Agent review: The cited local deployment JSON declares stockTopic=stock.reserved.v1.

2. **fact** — The inventory worker also declares `stock.reserved.v1` in its local configuration at `inventory-worker/config/local.json`.

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583).

   Agent review: The separately cited worker JSON repeats that value under local scope.

Unanswered 1: Which local configuration source is authoritative for the deployment being queried?

Agent review: Authority for an actual deployment remains open; the question does not invent a discrepancy.

- **answer: topic-location — met.** Identify an original source declaring stock.reserved.v1 as the stock topic.
  Agent review: Both source paths and the declared topic value are supplied. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: local-declaration — met.** Keep the value scoped to a local configuration declaration.
  Agent review: Both claims explicitly restrict the declarations to local configuration. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A known production stock topic.

Both claims remain local declarations; neither a production value nor an active subscriber is asserted.

Forbidden assertion absent: A verified live subscription inferred from a declared value.

Both claims remain local declarations; neither a production value nor an active subscriber is asserted.

## d02 (development): Explain the stock event integration: its local topic, message contract, projection handler and what is unimplemented or unverified about live delivery and storage.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The supplied local configuration names the stock topic `stock.reserved.v1`.

   Evidence: [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20), [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583).

   Agent review: Both local JSON files declare the named stock topic.

2. **fact** — `StockReserved` version 1 declares `sku` as a string and `units` as an integer, with Kafka as its transport.

   Evidence: [contract-library/contracts/StockReserved.json:1–9](#evidence-d8a2e2a9-3ca4-4ebb-a609-ead869e554f9).

   Agent review: The shared contract explicitly supplies version, sku/units types and Kafka transport.

3. **fact** — The stock projection code declares a `StockReserved(String sku, int units)` record; its `accept` handler passes the event to `StockStore.project(event)`.

   Evidence: [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4).

   Agent review: The Java record and accept method show the stated fields and delegation to project.

4. **fact** — `StockStore` is only an interface in the supplied projection code, so the supplied source provides a storage boundary rather than a storage implementation.

   Evidence: [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4).

   Agent review: The issued source declares an interface without a concrete store implementation.

5. **fact** — The inventory-worker documentation states that `StockReserved` is consumed through an application port, is separate from `OrderPlaced`, and that subscriber and database implementations are absent.

   Evidence: [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The README states the application-port scope and missing subscriber/database implementations.

6. **fact** — The same documentation characterizes the source as static and synthetic and says deployment and runtime behavior are unverified.

   Evidence: [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The README explicitly marks deployment and runtime behavior unverified.

7. **inference** — The supplied artifacts describe the intended local topic, Kafka message declaration, projection handler, and storage port, but do not verify a live end-to-end delivery or persistence connection.

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583), [contract-library/contracts/StockReserved.json:1–9](#evidence-d8a2e2a9-3ca4-4ebb-a609-ead869e554f9), [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4), [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: This is a scoped synthesis of configuration, contract and port, expressly declining to verify a live connection.

Unanswered 1: What subscriber implementation, if any, connects the configured stock topic to `StockProjection.accept`?

Agent review: No concrete subscriber is supplied.

Unanswered 2: What database or other `StockStore` implementation persists stock projections?

Agent review: No concrete database/store adapter is supplied.

Unanswered 3: Which stock-topic value and component revisions are deployed in the target environment?

Agent review: Deployed topic and revisions are unknown.

Unanswered 4: What delivery, acknowledgment, retry, recovery, and persistence behavior is provided by any deployed integration?

Agent review: Delivery and persistence semantics require missing implementations.

- **answer: topic-location — met.** Identify the local stock.reserved.v1 declaration.
  Agent review: The local topic is named. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **answer: message-contract — met.** Describe StockReserved and its sku/units message fields.
  Agent review: Both contract fields are described. Claims: 2, 3; unanswered: none.
  Equivalent support: The selected Java record also supplies sku/units; the cited shared JSON independently gives the requested message declaration.

- **answer: projection-port — met.** Describe the StockProjection handler delegating to StockStore.project.
  Agent review: Handler delegation and the storage interface boundary are explicit. Claims: 3, 4; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unimplemented-boundaries — met.** Subscriber and database implementations are absent from the supplied worker source; live delivery remains unverified.
  Agent review: Both missing implementations and unverified live behavior are preserved. Claims: 5, 6, 7; unanswered: 1, 2, 3, 4.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A verified live stock subscription.

No live subscription, delivery guarantee or implemented storage is asserted.

Forbidden assertion absent: Delivery or persistence guarantees from a port signature.

No live subscription, delivery guarantee or implemented storage is asserted.

## d03 (development): Which HTTP path does legacy administration use to reserve stock, and which local route matches it?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — Legacy administration posts stock-reservation requests to the HTTP path `/stock/reservations`.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284).

   Agent review: The Dojo function calls request.post on the stated path.

2. **fact** — The supplied local inventory API route matching that path is `POST /stock/reservations`, handled by `Reservations.reserve`.

   Evidence: [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178).

   Agent review: The local routes JSON names that POST path and Reservations.reserve.

3. **fact** — The reservation handler code delegates to a `Stock.reserve(sku, units)` interface; the supplied code does not provide a storage implementation.

   Evidence: [inventory-api/src/Reservations.java:1–5](#evidence-1e640835-3741-4488-8305-a9802c085b99).

   Agent review: Reservations.java delegates through its nested Stock interface without implementing storage.

4. **fact** — The legacy-administration source describes runtime behavior as unverified.

   Evidence: [legacy-admin/README.md:1–5](#evidence-2b706848-d3e3-42bf-a85f-53c9f736bf10).

   Agent review: The cited legacy README explicitly marks runtime behavior unverified.

Unanswered 1: Which route configuration is authoritative for the deployed environment?

Agent review: The authoritative deployed routing configuration is not supplied.

Unanswered 2: Is the supplied legacy administration client deployed and connected to the local inventory API route?

Agent review: The client-to-handler deployment connection is not established.

Unanswered 3: What implementation provides the Stock storage boundary, and how does it persist reservations?

Agent review: The concrete Stock implementation and persistence remain absent.

- **answer: request-and-route — met.** Identify POST /stock/reservations in legacy administration and the local Reservations.reserve route.
  Agent review: The literal request and matching local route are identified. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: candidate-route — met.** Treat the match as a local static candidate; the relative URL does not prove deployed host or live wiring.
  Agent review: The route stays local and the deployed connection is explicitly left open. Claims: 2, 4; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A verified deployed connection or host.

No verified host/connection or plugin-to-reservation chain is asserted.

Forbidden assertion absent: The plugin necessarily executes the reservation function without a supporting call link.

No verified host/connection or plugin-to-reservation chain is asserted.

## d04 (development): Explain legacy stock reservation from the HTTP request to the local handler, including unknown host/deployment wiring, dynamic plugin selection and the storage implementation boundary.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The legacy stock administration module sends a POST request to the relative path `/stock/reservations`, passing the supplied data as the request body.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284).

   Agent review: The Dojo source uses a relative POST and forwards the data argument as request data.

2. **fact** — The supplied local inventory route configuration maps POST `/stock/reservations` to `Reservations.reserve`.

   Evidence: [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178).

   Agent review: The local routes JSON maps this POST path to Reservations.reserve.

3. **inference** — If the legacy client's relative request is served by an instance using that local route configuration, the request reaches the `Reservations.reserve` handler; the supplied sources do not verify that host or deployment connection.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284), [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178).

   Agent review: This is explicitly conditional on a deployment using the route, and expressly says that connection is unverified; it is a static route candidate, not a runtime fact.

4. **fact** — `Reservations.reserve` accepts a `Stock` dependency plus `sku` and `units`, then invokes `stock.reserve(sku, units)`. The shown `Stock` type is an interface, not a storage implementation.

   Evidence: [inventory-api/src/Reservations.java:1–5](#evidence-1e640835-3741-4488-8305-a9802c085b99).

   Agent review: The Java method arguments and invocation match; Stock is a nested interface.

5. **fact** — The reservation API documentation says Reservations changes reserved quantities, but repository identity does not imply one deployed service; it also labels runtime and deployment behavior unverified.

   Evidence: [inventory-api/README.md:1–5](#evidence-18fa33af-dd02-44b6-9528-5ff766a00c73).

   Agent review: The README describes Reservations and disclaims repository/deployment equivalence and runtime verification.

6. **fact** — The legacy administration README says a computed plugin name is intentionally unresolved because the build configuration and runtime plugin are unavailable, and that deployment and runtime behavior are unverified.

   Evidence: [legacy-admin/README.md:1–5](#evidence-2b706848-d3e3-42bf-a85f-53c9f736bf10).

   Agent review: The legacy README explicitly names the unresolved computed plugin and unavailable build/runtime configuration.

7. **fact** — The plugin loader dynamically constructs `plugins/` plus the supplied name and loads it with `require`; the loaded plugin's `open()` method is then called.

   Evidence: [legacy-admin/src/plugin.js:1–3](#evidence-fa4a1bb5-93c8-44ae-8b2d-51fee373a26d).

   Agent review: The AMD loader concatenates plugins/ with name, then invokes open on the loaded module.

8. **inference** — The supplied code establishes dynamic plugin selection by runtime name, but cannot identify the selected plugin or show that it participates in the reservation request flow.

   Evidence: [legacy-admin/src/plugin.js:1–3](#evidence-fa4a1bb5-93c8-44ae-8b2d-51fee373a26d), [legacy-admin/README.md:1–5](#evidence-2b706848-d3e3-42bf-a85f-53c9f736bf10).

   Agent review: The inference stays within the unresolved loader and does not invent its participation in reservation.

9. **fact** — The supplied local inventory configuration is scoped to `local`; it contains `stockTopic: stock.reserved.v1` but no HTTP host/base URL or deployment wiring for the legacy client.

   Evidence: [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178), [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20).

   Agent review: The two cited local declarations contain the local environment and stock topic but no legacy HTTP base/host wiring. They are separate route/deployment files.

10. **fact** — `StockReserved` version 1 has `sku` (string) and `units` (integer) fields and specifies Kafka as its transport.

   Evidence: [contract-library/contracts/StockReserved.json:1–9](#evidence-d8a2e2a9-3ca4-4ebb-a609-ead869e554f9).

   Agent review: The shared StockReserved JSON declares version 1, sku/units and Kafka.

11. **fact** — The inventory worker's local configuration names `stock.reserved.v1`, Mongo database `warehouse`, and collection `stock`; its code declares `StockStore.project(StockReserved)` and delegates a received event to that port.

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583), [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4).

   Agent review: The cited local worker JSON declares warehouse.stock; the Java port and handler delegate the event without implementing storage.

12. **fact** — The inventory-worker documentation states that StockReserved is consumed through an application port and is separate from OrderPlaced, while the subscriber and database implementations are absent.

   Evidence: [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The worker README explicitly states the port-only consumer and absent subscriber/database implementations.

Unanswered 1: Which host, proxy, or deployment routing resolves the legacy client's relative `/stock/reservations` request?

Agent review: Relative URL host/proxy resolution is unknown.

Unanswered 2: Which environment and deployed revision, if any, use the supplied local inventory route configuration?

Agent review: The deployed environment/revision using these routes is unknown.

Unanswered 3: What runtime value selects the dynamic plugin, and which plugin module is available?

Agent review: The runtime plugin value/module is unresolved.

Unanswered 4: What concrete implementation supplies the reservation handler's `Stock` dependency and persists reserved quantities?

Agent review: Concrete Stock persistence is not supplied.

Unanswered 5: Does the reservation handler publish a `StockReserved` event matching the supplied Kafka contract, and on which deployed topic?

Agent review: No reservation-event publishing link is supplied; the question leaves it open.

Unanswered 6: What subscriber and database implementations connect `stock.reserved.v1` to the inventory worker's `StockStore` projection?

Agent review: No subscriber/database implementation for the stock projection is supplied.

Unanswered 7: What authentication, authorization, or identity-validation controls apply to the legacy reservation request?

Agent review: Optional security controls are left open rather than asserted absent.

- **answer: request-and-route — met.** Identify the relative POST /stock/reservations and local Reservations.reserve route.
  Agent review: Request and local handler are joined only as a conditional candidate. Claims: 1, 2, 3; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **answer: stock-port — met.** Reservations.reserve delegates to a Stock interface; the supplied code has no concrete storage implementation.
  Agent review: The Stock delegation is explicit and concrete persistence remains unresolved. Claims: 4; unanswered: 4.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unresolved-host — met.** Host/deployment wiring remains unknown from the relative request and local route.
  Agent review: Relative request and local declarations do not establish deployed host wiring. Claims: 1, 2, 3, 9; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unresolved-plugin — met.** The plugin name is computed; the supplied README lacks its runtime/build configuration. Do not invent a plugin-to-reservation dependency.
  Agent review: Computed target, missing build/runtime configuration and missing reservation linkage are all preserved. Claims: 6, 7, 8; unanswered: 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A concrete resolved plugin target.

No resolved plugin, proven plugin/reservation chain, deployed route or concrete persistence is asserted.

Forbidden assertion absent: A proven plugin-to-reservation call chain.

No resolved plugin, proven plugin/reservation chain, deployed route or concrete persistence is asserted.

Forbidden assertion absent: Verified deployed routing or stock persistence.

No resolved plugin, proven plugin/reservation chain, deployed route or concrete persistence is asserted.

## d05 (development): Which local database and collection are declared for shipment projections?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The shipping worker's local configuration declares the MongoDB database `logistics` and collection `shipments` for the shipment projection.

   Evidence: [shipping-worker/config/local.json:1–6](#evidence-ce353c64-8e99-4cf6-86b2-b42a40848abf).

   Agent review: The worker JSON directly declares the local logistics.shipments target.

2. **fact** — The supplied shipment-projection code only defines a `ShipmentStore` interface and calls its `save` method; it does not provide a storage implementation.

   Evidence: [shipping-worker/src/Shipments.java:1–4](#evidence-b96e6021-445d-440c-b211-4e48e6f9ce66).

   Agent review: The Java source declares ShipmentStore and calls save without implementing it.

3. **fact** — The shipment-projection documentation says it consumes `ShipmentAccepted` and updates a shipment projection, but no live carrier-event subscription is implemented.

   Evidence: [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The README describes the projection and explicitly says no live subscription link is implemented.

Unanswered 1: Which database and collection are configured for shipment projections outside the local environment?

Agent review: Nonlocal configuration is not supplied.

Unanswered 2: Is the declared local MongoDB storage connection implemented and deployed?

Agent review: Implementation and deployment of the local declaration remain unknown.

Unanswered 3: What authentication, authorization, or validation controls apply to shipment-projection event handling?

Agent review: This optional security question does not assert a control exists or is absent.

- **answer: projection-target — met.** Locate the shipping-worker local declaration of logistics.shipments.
  Agent review: Both database and collection are given. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: local-target — met.** Describe a declared local target without claiming the live storage destination.
  Agent review: Local declaration is separated from implemented/deployed storage. Claims: 1, 2, 3; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A known live database or deployed projection.

No live target or storage semantics are inferred from the declaration.

Forbidden assertion absent: Proven storage semantics from a declared target.

No live target or storage semantics are inferred from the declaration.

## d06 (development): Explain shipment projections: the local storage target, message handler, carrier subscription and concrete database implementation status.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The supplied local shipping-worker configuration declares the shipment projection storage target as MongoDB database `logistics`, collection `shipments`, and declares `shipments.accepted.v1` as its shipment topic.

   Evidence: [shipping-worker/config/local.json:1–6](#evidence-ce353c64-8e99-4cf6-86b2-b42a40848abf).

   Agent review: The local JSON contains the stated database, collection and topic.

2. **fact** — The supplied shipment handler accepts a `ShipmentAccepted` message containing `orderId` and `shipmentId`, then calls `ShipmentStore.save(event)`; `ShipmentStore` is only an interface in the supplied code.

   Evidence: [shipping-worker/src/Shipments.java:1–4](#evidence-b96e6021-445d-440c-b211-4e48e6f9ce66).

   Agent review: The Java record, accept method and interface support each part of the claim.

3. **fact** — The shipping-worker README describes the projection as consuming `ShipmentAccepted` and updating the shipment projection, but states that no link to a live carrier-event subscription is implemented.

   Evidence: [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The README explicitly records the missing live subscription link.

4. **fact** — No concrete shipment-store or database implementation is supplied: the storage boundary is the `ShipmentStore` interface, while the worker documentation labels the source static and says deployment and runtime behavior are unverified.

   Evidence: [shipping-worker/src/Shipments.java:1–4](#evidence-b96e6021-445d-440c-b211-4e48e6f9ce66), [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The issued code contains only the store interface; the README disclaims runtime verification.

5. **fact** — The shipping API contains a function that POSTs a shipment request with an `orderId` to `https://carrier.example.invalid/shipments`; its documentation says carrier internals, delivery guarantees, and retry behavior are unavailable.

   Evidence: [shipping-api/src/carrier.ts:1–3](#evidence-a29dca57-6391-4b80-b829-4dd7a14acce9), [shipping-api/README.md:1–5](#evidence-9cdc5a46-813b-4eec-9fda-2daa077fb4da).

   Agent review: The carrier function and README supply the request and missing internals/guarantees/retries.

6. **fact** — The supplied carrier-request code is distinct from a carrier-event subscription and does not establish a live connection from carrier events to the shipment projection.

   Evidence: [shipping-api/src/carrier.ts:1–3](#evidence-a29dca57-6391-4b80-b829-4dd7a14acce9), [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The cited outbound request is not a subscription; the worker README directly disclaims the live link.

Unanswered 1: Which environment-specific configuration is authoritative for the shipment topic and MongoDB target?

Agent review: Environment-specific authority is unknown.

Unanswered 2: Is the supplied shipment handler actually subscribed to `shipments.accepted.v1` in a deployed runtime?

Agent review: A deployed subscriber is not established.

Unanswered 3: What concrete MongoDB/ShipmentStore implementation, if any, persists shipment projections?

Agent review: A concrete store implementation is absent.

Unanswered 4: What carrier event contract and live subscription mechanism, if any, produces `ShipmentAccepted` messages?

Agent review: The live carrier event source/contract is unknown.

Unanswered 5: What deployment coverage and revisions are active for this projection?

Agent review: Active deployment revisions are unknown.

- **answer: projection-target — met.** Name the local logistics.shipments target.
  Agent review: The scoped target is named. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **answer: handler-and-port — met.** ShipmentAccepted reaches a handler that calls ShipmentStore.save; only the store interface is supplied.
  Agent review: Message fields, handler and interface are described. Claims: 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-subscription — met.** No live carrier-event subscription is implemented; deployment remains unverified.
  Agent review: Missing live subscription and unknown deployment remain explicit. Claims: 3, 6; unanswered: 2, 4, 5.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-store — met.** The supplied handler has no concrete database implementation or proven persistence behavior.
  Agent review: The missing concrete database implementation is stated. Claims: 2, 4; unanswered: 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A verified carrier subscription.

No live subscription, working database or delivery guarantee is claimed.

Forbidden assertion absent: A working database implementation or delivery guarantee from interface declarations.

No live subscription, working database or delivery guarantee is claimed.

## d07 (development): What does SupplierSync.run do with its cursor argument?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — SupplierSync.run passes its cursor argument unchanged to supplier.fetchSince(cursor) and returns that call's String result.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The method forwards cursor unchanged and returns the String result.

2. **fact** — The supplied source provides only the Supplier interface and the SupplierSync delegation; the external client, scheduling, cursor persistence, and failure recovery are documented as not implemented.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b), [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The source only defines a port and delegation; all four missing pieces are listed in the README.

Unanswered 1: Does the supplier implementation interpret, validate, or persist the cursor?

Agent review: Supplier cursor semantics are not implemented by the port.

Unanswered 2: Which deployment, if any, runs this supplied source?

Agent review: Deployment is not established.

- **answer: cursor-pass-through — met.** SupplierSync.run passes its cursor argument to Supplier.fetchSince and returns that result.
  Agent review: Argument forwarding and return value are explicit. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: code-scope — met.** Describe the visible method/port behavior without claiming a complete synchronization or recovery implementation.
  Agent review: Visible delegation is distinguished from implementation and deployment. Claims: 1, 2; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: Cursor persistence or automatic recovery inferred from fetchSince.

No persistent cursor or automatic recovery is inferred.

Forbidden assertion absent: A verified deployed synchronization job.

No persistent cursor or automatic recovery is inferred.

## d08 (development): How does supplier synchronization execute and recover after failure, including its client, scheduling, cursor persistence and restart behavior?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The supplied supplier-sync README describes a Java batch port that requests supplier stock since a cursor, but explicitly says the external client, scheduling, cursor persistence, and failure recovery are not implemented; it also labels runtime behavior unverified.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The README lists the client, scheduling, cursor persistence and failure recovery as unimplemented.

2. **fact** — The supplied code declares a Supplier interface with fetchSince(String cursor); SupplierSync.run accepts a Supplier and cursor and returns the result of supplier.fetchSince(cursor).

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The Java signature and return expression exactly match this description.

3. **inference** — Within the supplied code, synchronization is only represented as a direct delegation to an injected supplier port using the caller-provided cursor; no supplied implementation establishes a concrete external client connection.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b), [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: Injected port delegation and the missing concrete connection are supported by code and README.

4. **fact** — The supplied sources provide only an interface at the supplier boundary and no implementation for cursor storage, scheduled execution, failure recovery, or restart behavior.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a), [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The missing execution/persistence/recovery components are explicitly documented; scope stays with supplied sources.

Unanswered 1: What concrete external supplier client implements the Supplier interface?

Agent review: Concrete external client is absent.

Unanswered 2: What mechanism schedules SupplierSync.run, and at what cadence?

Agent review: Scheduling mechanism/cadence is absent.

Unanswered 3: Where and when is the synchronization cursor persisted?

Agent review: Cursor persistence is absent.

Unanswered 4: After a failure or restart, how is a cursor selected and how are partial or repeated supplier responses handled?

Agent review: Recovery and repeated/partial response handling are absent.

Unanswered 5: Which environment deploys this component, and is its runtime behavior verified?

Agent review: Runtime deployment verification remains unavailable.

- **answer: cursor-pass-through — met.** The supplied code accepts a cursor and calls Supplier.fetchSince.
  Agent review: The cursor argument and fetchSince call are explained. Claims: 2, 3; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-execution — met.** The external client and scheduling are not implemented in the supplied sources.
  Agent review: Both concrete client and scheduling are explicitly missing. Claims: 1, 3, 4; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-recovery — met.** Cursor persistence and failure recovery are not implemented there; a restart/resume mechanism is unknown.
  Agent review: Persistence, recovery and unresolved restart behavior are all retained. Claims: 1, 4; unanswered: 3, 4.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: Automatic cursor persistence or restart recovery.

No automatic recovery or system-wide absence is asserted.

Forbidden assertion absent: Global absence of an external scheduler or client outside the supplied sources.

No automatic recovery or system-wide absence is asserted.

## d09 (development): Can the local order topic tell us which topic production actually uses?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The local deployment configuration sets the order topic to `orders.placed.v2`, and its README explicitly says local values are not production values and no deployment is executed or observed.

   Evidence: [deployment-local/README.md:1–5](#evidence-057d5f18-b727-4841-b04b-08871b566e2e), [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20).

   Agent review: The local README and JSON explicitly separate local declarations from production.

2. **fact** — Production configuration leaves `orderTopic` as the `${ORDER_TOPIC}` placeholder; its README says the operator must supply the actual production topic and that its value is unknown.

   Evidence: [deployment-production/README.md:1–5](#evidence-b474c9e6-1800-409e-a0e7-2af2e64ede73), [deployment-production/config/production.json:1–5](#evidence-c055d4bb-320a-4aa1-924e-8495d03e2c2a).

   Agent review: The production JSON has the literal placeholder and its README says the value is operator-supplied and unknown.

3. **fact** — The order API resolves its publish topic from `ORDER_TOPIC` when set, otherwise from its configured topic; the supplied API code only defines a publisher interface and states that no Kafka driver is included.

   Evidence: [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: Orders.java reads ORDER_TOPIC with configuredTopic fallback and only declares an EventPublisher; its comment excludes a real Kafka driver.

4. **fact** — The supplied local order API configuration sets `orderTopic` to `orders.placed.v2`, whereas its README names `orders.created.v1` as the order event topic and says production may override it with `ORDER_TOPIC`.

   Evidence: [order-api/config/local.json:1–5](#evidence-6d5491dc-28f8-429b-bec1-fccde7d07f25), [order-api/README.md:1–8](#evidence-f58d9f58-5c08-4e3c-baa3-1bad27a9abd4).

   Agent review: The API README and JSON contain the stated differing values and environment override.

5. **conflict** — The order API README's unqualified `orders.created.v1` topic conflicts with the scoped local order API configuration's `orders.placed.v2` topic; the historical runbook also records this disagreement.

   Evidence: [order-api/README.md:1–8](#evidence-f58d9f58-5c08-4e3c-baa3-1bad27a9abd4), [order-api/config/local.json:1–5](#evidence-6d5491dc-28f8-429b-bec1-fccde7d07f25), [architecture-docs/docs/old-runbook.md:1–3](#evidence-368ac089-8d91-41bd-90fa-7d402bc76f48).

   Agent review: This is the documented unqualified README versus local configuration discrepancy, also explicitly named by the historical runbook; it is not a local/unknown-production conflict.

6. **fact** — The local order worker is configured to consume `orders.placed.v2`; its subscriber topic can also be overridden by `ORDER_TOPIC`, but the supplied code uses only a `KafkaSubscriber` interface and the README says the configured production topic and deployed revisions are unknown.

   Evidence: [order-worker/config/local.json:1–7](#evidence-25044091-7966-48b5-ad83-d081c0d53e30), [order-worker/src/main/java/OrderConsumer.java:1–18](#evidence-b3b4c9af-a910-4963-a696-dd643266e1d1), [order-worker/README.md:1–7](#evidence-9a739851-8c10-462b-8060-c985d9f97d3b).

   Agent review: The worker JSON declares the local topic; start reads the override and invokes a subscriber interface; its README leaves production and deployment unknown.

7. **inference** — No: the local topic identifies an intended local configuration, but the supplied production configuration and code do not reveal the operator-supplied `ORDER_TOPIC`; therefore it cannot establish which topic production actually uses.

   Evidence: [deployment-local/README.md:1–5](#evidence-057d5f18-b727-4841-b04b-08871b566e2e), [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20), [deployment-production/README.md:1–5](#evidence-b474c9e6-1800-409e-a0e7-2af2e64ede73), [deployment-production/config/production.json:1–5](#evidence-c055d4bb-320a-4aa1-924e-8495d03e2c2a), [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: The local value cannot resolve an operator-supplied production placeholder; the inference preserves that boundary.

Unanswered 1: What operator-supplied `ORDER_TOPIC` value is deployed in production?

Agent review: The actual operator value is unknown.

Unanswered 2: Which source or deployment setting is authoritative for the documented `orders.created.v1` versus local `orders.placed.v2` discrepancy?

Agent review: After the cited conflict, authority is a legitimate unanswered question; the discrepancy itself is already stated in claims.

Unanswered 3: What deployment evidence would establish the production topic and the revisions actually deployed together?

Agent review: Co-deployed revisions and actual production topic need external evidence.

- **answer: production-placeholder — met.** Production retains the operator-supplied ORDER_TOPIC placeholder; its concrete value is unknown.
  Agent review: The production placeholder and missing actual value are explicit. Claims: 2, 7; unanswered: 1, 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: no-local-substitution — met.** The local order-topic declaration cannot establish the production value.
  Agent review: Local configuration is explicitly rejected as proof of production. Claims: 1, 2, 7; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A known production topic inferred from local config.

No production value is substituted; the only conflict is the separately supported README/local disagreement.

Forbidden assertion absent: A conflict between a known local value and an unknown production value.

No production value is substituted; the only conflict is the separately supported README/local disagreement.

## d10 (development): Does a TenantContext value establish that the caller belongs to the tenant?

Agent outcome: **failed**. Required membership/scoping propositions pass, but optional claim 2 invents a verified header path despite incompatible literal header names. The case fails grounding.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — No. TenantContext is a record containing only a tenantId, and its documentation explicitly says it carries a tenant identifier without authenticating users, validating membership, or implementing authorization.

   Evidence: [tenant-library/README.md:1–5](#evidence-375282ab-ddeb-45a6-b655-750ba62cbae2), [tenant-library/src/TenantContext.java:1–2](#evidence-290803fe-730f-4547-bfe1-2c6bd068475a).

   Agent review: The record contains only tenantId and the README explicitly disclaims authentication, membership validation and authorization.

2. **fact** — The supplied checkout and order code propagate a caller-provided tenant header into the order handler and then into an OrderPlaced event; the supplied code does not show membership validation in that path.

   Evidence: [checkout-bff/src/checkout.ts:1–3](#evidence-9270a4cd-6432-437e-82ed-37b1ba350624), [order-api/config/routes.json:1–7](#evidence-7d30fbad-fd9f-484f-8db3-d9f1b5477e51), [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: Unsupported end-to-end propagation: checkout sends x-tenant-id, whereas the route binds Orders.accept.tenantId to X-Tenant. The headers are not equal even case-insensitively, and no adapter/rewrite or HTTP implementation bridges them. Orders.java alone supports argument-to-event propagation, not this combined factual path.

3. **fact** — The checkout facade documentation explicitly states that it propagates a tenant header and that authentication is not implemented.

   Evidence: [checkout-bff/README.md:1–5](#evidence-1595642c-3493-48c5-9e39-fd6d82771849).

   Agent review: The facade README states header propagation and absent authentication within that facade.

4. **fact** — The tenant-context library is documented as a static synthetic source whose deployment and runtime behavior are unverified.

   Evidence: [tenant-library/README.md:1–5](#evidence-375282ab-ddeb-45a6-b655-750ba62cbae2).

   Agent review: The tenant-library README explicitly marks deployment/runtime unverified.

Unanswered 1: What authentication, tenant-membership validation, and authorization controls are enforced by the deployed request path?

Agent review: Deployed identity controls are not established.

Unanswered 2: Which additional relevant sources or excluded material would establish whether any such controls exist outside the supplied spans?

Agent review: The question preserves uncertainty about enforcement outside supplied spans.

Unanswered 3: Are the supplied revisions deployed together in any environment?

Agent review: Co-deployment remains unknown.

- **answer: identifier-only — met.** TenantContext holds a tenant identifier and its library explicitly lacks authentication, membership validation and authorization.
  Agent review: The core membership question is correctly answered with the library record and limitations. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: controls-elsewhere — met.** Enforcement elsewhere or in deployment remains unknown; do not infer system-wide absence.
  Agent review: Controls outside the library and deployment remain open. Claims: 1, 4; unanswered: 1, 2, 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: TenantContext proves tenant membership.

Neither membership proof nor system-wide absence is asserted; the separate cross-component header-flow claim is nevertheless unsupported.

Forbidden assertion absent: No authentication or authorization exists anywhere in the system.

Neither membership proof nor system-wide absence is asserted; the separate cross-component header-flow claim is nevertheless unsupported.

## d11 (development): Does owning the OrderPlaced definition make the contract library an event producer?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — No. The contract library defines shared message shapes, and its documentation explicitly says that owning a schema file does not make it a running producer or service.

   Evidence: [contract-library/README.md:1–5](#evidence-10fb2260-794c-4507-a813-b71092aaef31).

   Agent review: The README explicitly distinguishes definition ownership from a running producer.

2. **fact** — The library contains an OrderPlaced version-2 declaration with orderId, tenantId, createdAtMillis, tenantId:orderId key, and Kafka as transport.

   Evidence: [contract-library/contracts/OrderPlaced.json:1–12](#evidence-2ab39d28-8818-4d88-accf-810d01962169).

   Agent review: The shared JSON contains the named fields, version, key and transport.

3. **fact** — The supplied order-api code is the component that constructs OrderPlaced and invokes an EventPublisher port; that source also states no actual HTTP server or Kafka driver is included.

   Evidence: [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: Orders.java constructs the record and invokes an EventPublisher interface; its comment excludes a real HTTP server/Kafka driver.

4. **inference** — Therefore, definition ownership is distinct from producing events; the supplied sources show a producer-shaped call in order-api, not in the contract library.

   Evidence: [contract-library/README.md:1–5](#evidence-10fb2260-794c-4507-a813-b71092aaef31), [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: The distinction and candidate publisher-shaped call are supported; no actual broker publication is claimed.

Unanswered 1: Which component supplies the EventPublisher implementation and establishes a live Kafka publication path?

Agent review: The concrete publisher and Kafka connection are absent.

Unanswered 2: Is any order-api revision with that publisher implementation deployed?

Agent review: A deployed publisher implementation is unverified.

- **answer: schema-declaration — met.** The contract library defines the OrderPlaced message shape.
  Agent review: The contract declaration is described. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: not-running-producer — met.** The schema/library declaration does not establish a running producer; publishing implementation or deployment needs separate evidence.
  Agent review: Definition ownership is separated from live publication. Claims: 1, 3, 4; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: The library runs a publisher because it owns the schema.

The library is not labelled a running publisher, and no complete publisher inventory is claimed.

Forbidden assertion absent: All publishers are enumerated by the contract library.

The library is not labelled a running publisher, and no complete publisher inventory is claimed.

## d12 (development): Does the migration file prove that shop.orders already has the unique index?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The migration declares creation of a unique compound index on `shop.orders` for `tenantId` and `orderId`.

   Evidence: [database-migrations/migrations/001-orders.js:1–3](#evidence-581dbbc8-2bca-4ef7-b2fb-378bcc5c3354).

   Agent review: The migration calls createIndex on shop.orders with tenantId/orderId and unique:true.

2. **fact** — The migration source explicitly states that its presence does not prove the migration was applied, and that no migration runner or database is included.

   Evidence: [database-migrations/README.md:1–5](#evidence-a2065ca2-c9cc-42c8-8b9e-13f8c8322a69).

   Agent review: The migration README explicitly states non-proof of application and absent runner/database.

3. **inference** — Therefore, the migration file does not prove that `shop.orders` already has the unique index; it proves only that the supplied migration declares it.

   Evidence: [database-migrations/README.md:1–5](#evidence-a2065ca2-c9cc-42c8-8b9e-13f8c8322a69), [database-migrations/migrations/001-orders.js:1–3](#evidence-581dbbc8-2bca-4ef7-b2fb-378bcc5c3354).

   Agent review: The inference correctly separates source declaration from live database state.

Unanswered 1: Was this migration applied to the relevant `shop` database?

Agent review: Actual migration application is unknown.

Unanswered 2: What deployment environment and database instance are being evaluated?

Agent review: Relevant deployment/database identity is unknown.

- **answer: declared-index — met.** A migration declares a unique tenantId/orderId index on shop.orders.
  Agent review: Both indexed fields, uniqueness and target are named. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unproven-application — met.** Source presence does not prove application; no migration runner or database is included and live index state is unknown.
  Agent review: Application and runtime database state remain unproven. Claims: 2, 3; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: The index is installed because its migration exists.

No installed index or operational uniqueness/idempotency guarantee is inferred.

Forbidden assertion absent: Uniqueness, concurrency or idempotency guarantees from an unapplied migration.

No installed index or operational uniqueness/idempotency guarantee is inferred.

## h01 (reserved): Which local configuration file names the stock topic, and what value does it contain?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — deployment-local/config/local.json names the stock topic as "stock.reserved.v1".

   Evidence: [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20).

   Agent review: The cited deployment-local JSON directly names the topic value.

2. **fact** — inventory-worker/config/local.json also names the stock topic as "stock.reserved.v1".

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583).

   Agent review: The separately cited worker local JSON names the same topic value.

- **answer: topic-location — met.** Identify an original source declaring stock.reserved.v1 as the stock topic.
  Agent review: The requested files and value are given. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: local-declaration — met.** Keep the value scoped to a local configuration declaration.
  Agent review: Both source paths explicitly identify local configuration; no additional deployment claim is made. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A known production stock topic.

Only local file declarations are asserted; no production topic or live subscription claim occurs.

Forbidden assertion absent: A verified live subscription inferred from a declared value.

Only local file declarations are asserted; no production topic or live subscription claim occurs.

## h02 (reserved): For stock events, connect the configured local topic to the message shape and consuming code, and identify the missing subscriber and database implementations.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The inventory worker’s local configuration sets the stock topic to `stock.reserved.v1` and names MongoDB database `warehouse` and collection `stock`.

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583).

   Agent review: The worker JSON declares all three local values.

2. **fact** — The declared Kafka message shape is `StockReserved` version 1 with `sku` (string) and `units` (integer).

   Evidence: [contract-library/contracts/StockReserved.json:1–9](#evidence-d8a2e2a9-3ca4-4ebb-a609-ead869e554f9).

   Agent review: The shared contract defines version 1, sku/units types and Kafka.

3. **fact** — The supplied stock projection code declares the same `StockReserved(String sku, int units)` shape; its `accept` method passes the event to `StockStore.project`.

   Evidence: [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4).

   Agent review: The Java record and method show the stated shape and project delegation.

4. **inference** — Within the supplied local configuration and declaration-level code, `stock.reserved.v1` is intended to carry `StockReserved` events into the projection path that calls `StockStore.project`; no verified live subscription connects them.

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583), [contract-library/contracts/StockReserved.json:1–9](#evidence-d8a2e2a9-3ca4-4ebb-a609-ead869e554f9), [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4), [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The integration is labelled intended and declaration-level, expressly without a verified subscriber; the component README supports this bounded synthesis.

5. **fact** — The inventory-worker documentation explicitly says it consumes `StockReserved` through an application port, that `StockReserved` is separate from `OrderPlaced`, and that subscriber and database implementations are absent.

   Evidence: [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The README explicitly records the separate event, application port and missing subscriber/database implementations.

6. **fact** — `StockStore` is only an interface in the supplied projection code; no database implementation is supplied.

   Evidence: [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4), [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The Java interface and README directly establish the absent concrete store.

7. **fact** — The supplied inventory-worker source is described as static synthetic source, with deployment and runtime behavior unverified.

   Evidence: [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409).

   Agent review: The README explicitly marks deployment and runtime behavior unverified.

Unanswered 1: Which subscriber implementation, if any, binds `stock.reserved.v1` to `StockProjection.accept`?

Agent review: The actual subscriber binding is absent.

Unanswered 2: Which database implementation, if any, fulfills `StockStore` for the configured warehouse stock projection?

Agent review: The concrete store adapter is absent.

Unanswered 3: What stock topic and projection configuration are deployed outside the supplied local configuration?

Agent review: Nonlocal/deployed configuration is unknown.

Unanswered 4: What evidence establishes message delivery, acknowledgment, retry, recovery, and database-write behavior for this stock projection?

Agent review: Runtime delivery and storage semantics require missing implementations.

- **answer: topic-location — met.** Identify the local stock.reserved.v1 declaration.
  Agent review: The local topic is supplied. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **answer: message-contract — met.** Describe StockReserved and its sku/units message fields.
  Agent review: The message fields and shared contract are described. Claims: 2, 3; unanswered: none.
  Equivalent support: The code record independently contains sku/units, but the shared JSON is also selected and cited.

- **answer: projection-port — met.** Describe the StockProjection handler delegating to StockStore.project.
  Agent review: The handler delegates to the named store interface. Claims: 3, 6; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unimplemented-boundaries — met.** Subscriber and database implementations are absent from the supplied worker source; live delivery remains unverified.
  Agent review: Missing subscriber/database and unverified live behavior are explicit. Claims: 4, 5, 6, 7; unanswered: 1, 2, 3, 4.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A verified live stock subscription.

No active subscription, delivery guarantee or working store is asserted.

Forbidden assertion absent: Delivery or persistence guarantees from a port signature.

No active subscription, delivery guarantee or working store is asserted.

## h03 (reserved): Locate the stock-reservation request in the legacy client and its candidate handler in the local route declarations.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The legacy administration client sends a POST request to `/stock/reservations` via its `reserve(data)` function.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284).

   Agent review: The source contains reserve(data) and the stated POST path.

2. **fact** — The local inventory API route declarations map `POST /stock/reservations` to `Reservations.reserve`.

   Evidence: [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178).

   Agent review: The local route explicitly maps this path to Reservations.reserve.

3. **inference** — `Reservations.reserve` is the candidate handler for the legacy client's stock-reservation request because both supplied sources use the same POST path.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284), [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178).

   Agent review: This is explicitly a candidate inferred from matching literal method/path, not deployed routing proof.

4. **fact** — The supplied `Reservations.reserve` code delegates `sku` and `units` to a `Stock.reserve` interface; no storage implementation is supplied in that code.

   Evidence: [inventory-api/src/Reservations.java:1–5](#evidence-1e640835-3741-4488-8305-a9802c085b99).

   Agent review: The method delegates through Stock with the stated arguments; no concrete store appears.

5. **fact** — The legacy client is documented as static synthetic source whose deployment and runtime behavior are unverified.

   Evidence: [legacy-admin/README.md:1–5](#evidence-2b706848-d3e3-42bf-a85f-53c9f736bf10).

   Agent review: The legacy README explicitly marks deployment/runtime unverified.

6. **fact** — The inventory API is documented as static synthetic source whose deployment and runtime behavior are unverified; its repository contains two logical applications and does not by itself prove one deployed service.

   Evidence: [inventory-api/README.md:1–5](#evidence-18fa33af-dd02-44b6-9528-5ff766a00c73).

   Agent review: The inventory README explicitly identifies two logical applications and rejects inferring one deployed service.

Unanswered 1: Is the legacy client configured or deployed to reach the local inventory API route?

Agent review: The relative client-to-route connection is not established.

Unanswered 2: Which deployment environment and deployed revisions are authoritative for this route mapping?

Agent review: Deployed environment/revisions remain unknown.

Unanswered 3: What implementation backs the `Stock` interface used by `Reservations.reserve`?

Agent review: The concrete Stock adapter is absent.

Unanswered 4: Does the candidate handler validate or authorize requests?

Agent review: This optional security question does not invent a control.

- **answer: request-and-route — met.** Identify POST /stock/reservations in legacy administration and the local Reservations.reserve route.
  Agent review: The request and candidate route are located. Claims: 1, 2, 3; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: candidate-route — met.** Treat the match as a local static candidate; the relative URL does not prove deployed host or live wiring.
  Agent review: Candidate status and unresolved deployed connectivity are explicit. Claims: 3, 5, 6; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A verified deployed connection or host.

No deployed connection, host or plugin dependency is asserted.

Forbidden assertion absent: The plugin necessarily executes the reservation function without a supporting call link.

No deployed connection, host or plugin dependency is asserted.

## h04 (reserved): What do the legacy stock request and inventory handler establish, and what remains unresolved about their deployed connection, plugin/build configuration and persistence?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The legacy stock client declares a Dojo request that POSTs its supplied data to `/stock/reservations`.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284).

   Agent review: The Dojo source makes the stated request with the provided data.

2. **fact** — The supplied local inventory route maps POST `/stock/reservations` to `Reservations.reserve`; that handler delegates `sku` and `units` to a `Stock.reserve` interface, rather than providing a stock-storage implementation.

   Evidence: [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178), [inventory-api/src/Reservations.java:1–5](#evidence-1e640835-3741-4488-8305-a9802c085b99).

   Agent review: The local route and Java code give the named handler and interface delegation without storage implementation.

3. **inference** — The request path and local route declaration describe an intended legacy-client-to-reservation-handler integration, but do not verify a deployed connection.

   Evidence: [legacy-admin/src/stock.js:1–3](#evidence-9a735871-1980-415d-9a8b-2cb95c568284), [inventory-api/config/routes.json:1–15](#evidence-fe46e7ed-a4d6-403b-9568-6cb2aaad0178), [inventory-api/README.md:1–5](#evidence-18fa33af-dd02-44b6-9528-5ff766a00c73).

   Agent review: The integration is labelled intended and explicitly not verified in deployment.

4. **fact** — The inventory worker's local configuration names `stock.reserved.v1`, Mongo database `warehouse`, and collection `stock`; its projection handler passes `StockReserved` events to a `StockStore.project` interface only.

   Evidence: [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583), [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4).

   Agent review: The worker JSON and Java source support the topic/target and port-only delegation.

5. **fact** — The shared `StockReserved` contract is version 1 with `sku` (string) and `units` (integer), and declares Kafka transport.

   Evidence: [contract-library/contracts/StockReserved.json:1–9](#evidence-d8a2e2a9-3ca4-4ebb-a609-ead869e554f9).

   Agent review: The shared JSON supports every stated field, version and transport.

6. **fact** — The inventory-worker documentation explicitly says the subscriber and database implementations are absent; thus the supplied sources provide ports/configuration rather than verified messaging or persistence implementations.

   Evidence: [inventory-worker/README.md:1–5](#evidence-63bd541a-fa55-47fb-b6a2-ef6bbd38c409), [inventory-worker/src/StockProjection.java:1–4](#evidence-56cf16fe-f4ba-4219-9961-fafde80026e4), [inventory-worker/config/local.json:1–6](#evidence-22e1836e-8f33-4d28-89f6-f9817aad9583).

   Agent review: The README explicitly says subscriber/database implementations are absent; code/configuration do not fill that gap.

7. **fact** — The legacy-admin README states that its computed plugin name is intentionally unresolved and that both build configuration and runtime plugin are unavailable; its code constructs plugin module paths dynamically as `plugins/` plus the supplied name.

   Evidence: [legacy-admin/README.md:1–5](#evidence-2b706848-d3e3-42bf-a85f-53c9f736bf10), [legacy-admin/src/plugin.js:1–3](#evidence-fa4a1bb5-93c8-44ae-8b2d-51fee373a26d).

   Agent review: The README names unavailable build/runtime plugin data, and plugin.js constructs the stated path dynamically.

8. **fact** — The supplied legacy-admin package metadata contains only name, version, and private fields, and does not document a plugin/build configuration in that span.

   Evidence: [legacy-admin/package.json:1–5](#evidence-ecc177a8-ce3d-4cd8-8667-e25569fd8381).

   Agent review: The issued package JSON has exactly name/version/private and no plugin/build settings.

9. **fact** — The legacy-admin source is explicitly described as static synthetic source with unverified deployment and runtime behavior.

   Evidence: [legacy-admin/README.md:1–5](#evidence-2b706848-d3e3-42bf-a85f-53c9f736bf10).

   Agent review: The legacy README explicitly marks deployment/runtime behavior unverified.

Unanswered 1: What deployment configuration, if any, connects the legacy client’s `/stock/reservations` request to the inventory reservation route?

Agent review: Deployed client-to-route wiring is unknown.

Unanswered 2: Which plugin name, runtime plugin artifact, and build configuration are used for the legacy administration screen?

Agent review: Runtime plugin value/artifact and build configuration are unavailable.

Unanswered 3: What concrete `Stock` implementation persists or otherwise applies reservation changes?

Agent review: The concrete reservation store is absent.

Unanswered 4: What concrete subscriber and database implementations connect `StockReserved` messages to the inventory projection?

Agent review: The projection subscriber/database are absent.

Unanswered 5: Which environment and deployed revisions, if any, use the supplied local topic and Mongo settings?

Agent review: Deployed environment/revisions are unknown.

- **answer: request-and-route — met.** Identify the relative POST /stock/reservations and local Reservations.reserve route.
  Agent review: Request and local handler are explained without claiming deployed connectivity. Claims: 1, 2, 3; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **answer: stock-port — met.** Reservations.reserve delegates to a Stock interface; the supplied code has no concrete storage implementation.
  Agent review: Stock delegation and unresolved persistence are preserved. Claims: 2; unanswered: 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unresolved-host — met.** Host/deployment wiring remains unknown from the relative request and local route.
  Agent review: Deployment wiring and environment remain unknown. Claims: 3, 9; unanswered: 1, 5.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unresolved-plugin — met.** The plugin name is computed; the supplied README lacks its runtime/build configuration. Do not invent a plugin-to-reservation dependency.
  Agent review: Computed module name and missing plugin/build configuration are explicit; no link to reservation execution is invented. Claims: 7, 8; unanswered: 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A concrete resolved plugin target.

No concrete plugin target, plugin-to-reservation chain or verified persistence is asserted.

Forbidden assertion absent: A proven plugin-to-reservation call chain.

No concrete plugin target, plugin-to-reservation chain or verified persistence is asserted.

Forbidden assertion absent: Verified deployed routing or stock persistence.

No concrete plugin target, plugin-to-reservation chain or verified persistence is asserted.

## h05 (reserved): Locate the configured local storage target of shipping-worker.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — shipping-worker's local configuration sets the MongoDB database to `logistics` and collection to `shipments`, so its configured local storage target is `logistics.shipments`.

   Evidence: [shipping-worker/config/local.json:1–6](#evidence-ce353c64-8e99-4cf6-86b2-b42a40848abf).

   Agent review: The local JSON names logistics and shipments.

2. **fact** — The supplied code defines only a `ShipmentStore` interface whose `save` method is called for a `ShipmentAccepted` record; it does not supply a storage implementation.

   Evidence: [shipping-worker/src/Shipments.java:1–4](#evidence-b96e6021-445d-440c-b211-4e48e6f9ce66).

   Agent review: The Java source declares only the store interface and save invocation.

3. **fact** — The shipping-worker documentation says deployment and runtime behavior are unverified.

   Evidence: [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The README expressly disclaims deployment/runtime verification.

Unanswered 1: What storage implementation, connection settings, and credentials bind the configured `logistics.shipments` target at runtime?

Agent review: Runtime store binding/settings remain unavailable; the question does not supply credentials or assert that they exist.

Unanswered 2: Is this local configuration deployed or active in any environment?

Agent review: Deployment of the local configuration is unknown.

- **answer: projection-target — met.** Locate the shipping-worker local declaration of logistics.shipments.
  Agent review: The complete local target is given. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: local-target — met.** Describe a declared local target without claiming the live storage destination.
  Agent review: Declared local configuration is not promoted to a live target. Claims: 1, 2, 3; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A known live database or deployed projection.

No live database target or implementation semantics are inferred.

Forbidden assertion absent: Proven storage semantics from a declared target.

No live database target or implementation semantics are inferred.

## h06 (reserved): How do the declared shipment target and handler relate, and what evidence is missing for a live carrier subscription and persisted projection?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The shipping worker's local configuration declares `shipments.accepted.v1` as the shipment topic and `logistics.shipments` as the MongoDB target.

   Evidence: [shipping-worker/config/local.json:1–6](#evidence-ce353c64-8e99-4cf6-86b2-b42a40848abf).

   Agent review: The local JSON contains the topic and logistics.shipments target.

2. **fact** — The handler accepts a `ShipmentAccepted` record containing `orderId` and `shipmentId`, then invokes `ShipmentStore.save(event)`. `ShipmentStore` is declared only as an interface in the supplied code.

   Evidence: [shipping-worker/src/Shipments.java:1–4](#evidence-b96e6021-445d-440c-b211-4e48e6f9ce66).

   Agent review: The record, accept method and interface support the claim directly.

3. **fact** — The supplied shipping-worker documentation describes this component as consuming `ShipmentAccepted` and updating a shipment projection, but explicitly states that no link to a live carrier event subscription is implemented.

   Evidence: [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The README explicitly states the missing live subscription link.

4. **inference** — The topic, handler, and MongoDB settings form a declared projection design: shipment events are intended to reach the handler and be saved through a storage boundary targeting the configured collection. The supplied sources do not verify an actual subscription, handler wiring, or persistence implementation.

   Evidence: [shipping-worker/config/local.json:1–6](#evidence-ce353c64-8e99-4cf6-86b2-b42a40848abf), [shipping-worker/src/Shipments.java:1–4](#evidence-b96e6021-445d-440c-b211-4e48e6f9ce66), [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: This is explicitly an intended design with unverified subscription, wiring and persistence; no working runtime is claimed.

5. **fact** — The documentation labels the source as static and synthetic and says deployment and runtime behavior are unverified.

   Evidence: [shipping-worker/README.md:1–5](#evidence-ad8e2f9d-3c2c-4967-8e22-290ab5265eb7).

   Agent review: The README marks deployment/runtime behavior unverified.

Unanswered 1: What carrier subscription configuration, implementation, and runtime evidence establishes a live subscription?

Agent review: Live carrier subscription evidence is absent.

Unanswered 2: What concrete `ShipmentStore` implementation and database connection persist the projection?

Agent review: Concrete storage implementation/connection is absent.

Unanswered 3: What handler registration or consumer wiring binds the declared shipment topic to the handler?

Agent review: Handler registration is not supplied.

Unanswered 4: What execution, persistence, and recovery behavior is provided for the projection in a deployed environment?

Agent review: Runtime execution/recovery semantics are unknown.

Unanswered 5: Which deployment environment and deployed configuration are authoritative?

Agent review: Deployment authority is unknown.

- **answer: projection-target — met.** Name the local logistics.shipments target.
  Agent review: The local target is named. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **answer: handler-and-port — met.** ShipmentAccepted reaches a handler that calls ShipmentStore.save; only the store interface is supplied.
  Agent review: Message handler and store boundary are explicit. Claims: 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-subscription — met.** No live carrier-event subscription is implemented; deployment remains unverified.
  Agent review: Missing subscription and unverified wiring/deployment are preserved. Claims: 3, 4, 5; unanswered: 1, 3, 5.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-store — met.** The supplied handler has no concrete database implementation or proven persistence behavior.
  Agent review: Only an interface is supplied; concrete storage and actual persistence remain unresolved. Claims: 2, 4; unanswered: 2, 4.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A verified carrier subscription.

No working subscriber, database implementation or delivery guarantee is asserted.

Forbidden assertion absent: A working database implementation or delivery guarantee from interface declarations.

No working subscriber, database implementation or delivery guarantee is asserted.

## h07 (reserved): Trace the cursor parameter through the supplied supplier synchronization method.

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — SupplierSync.run receives a Supplier and a cursor, passes that cursor unchanged to supplier.fetchSince(cursor), and returns the resulting String.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The method passes cursor unchanged and returns the String result.

2. **fact** — The Supplier boundary is only an interface declaring fetchSince(String cursor); no external client implementation is supplied.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b), [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The interface and README explicitly leave the external client unimplemented.

3. **fact** — The supplied supplier-sync documentation states that scheduling, cursor persistence, and failure recovery are not implemented.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The README lists all three missing execution/recovery pieces.

4. **fact** — The supplied supplier-sync source is described as static synthetic source, with deployment and runtime behavior unverified.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The README explicitly marks deployment/runtime unverified.

Unanswered 1: Where does the cursor supplied to SupplierSync.run originate?

Agent review: Cursor origin is not supplied.

Unanswered 2: How is the returned String interpreted or used after fetchSince returns?

Agent review: Post-return processing is not supplied.

Unanswered 3: What mechanism persists an updated cursor between synchronization runs?

Agent review: A persistence mechanism is not implemented here.

Unanswered 4: What schedules execution of the synchronization method?

Agent review: Scheduling is not implemented here.

Unanswered 5: How are failures recovered during supplier synchronization?

Agent review: Recovery is not implemented here.

Unanswered 6: What authentication, authorization, or identity-validation controls govern access to the supplier client?

Agent review: Optional supplier security is left open without asserting any enforcement.

Unanswered 7: Which supplier-sync revision and configuration are deployed in the target environment?

Agent review: Deployment configuration/revision remains unknown.

- **answer: cursor-pass-through — met.** SupplierSync.run passes its cursor argument to Supplier.fetchSince and returns that result.
  Agent review: The cursor argument and return flow are described. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: code-scope — met.** Describe the visible method/port behavior without claiming a complete synchronization or recovery implementation.
  Agent review: The answer preserves the distinction between visible delegation and missing runtime/recovery pieces. Claims: 1, 2, 3, 4; unanswered: 1, 2, 3, 4, 5, 7.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: Cursor persistence or automatic recovery inferred from fetchSince.

No automatic cursor persistence, recovery or deployed synchronization guarantee is inferred.

Forbidden assertion absent: A verified deployed synchronization job.

No automatic cursor persistence, recovery or deployed synchronization guarantee is inferred.

## h08 (reserved): Can the supplied supplier-sync code resume after a crash, and which execution, client and cursor-recovery pieces are missing?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The supplied supplier-sync code is a Java batch port: `SupplierSync.run` passes the supplied cursor to `Supplier.fetchSince` and returns that call's string result.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The Java method passes cursor to fetchSince and returns its String result.

2. **inference** — The supplied code cannot be verified to resume after a crash: it contains only the fetch delegation, while the supplied README says cursor persistence and failure recovery are not implemented.

   Evidence: [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b), [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The inference correctly says recovery cannot be verified, grounded in the missing persistence/recovery implementations.

3. **fact** — The supplied README explicitly identifies the missing execution pieces as scheduling and failure recovery.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The README explicitly lists scheduling and failure recovery as absent.

4. **fact** — The supplied README explicitly identifies the external client as not implemented; the code supplies only the `Supplier` interface with `fetchSince(String cursor)`.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a), [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The README and interface show the missing external client.

5. **fact** — The supplied README explicitly identifies cursor persistence as not implemented; the code supplies no storage boundary or implementation for saving or restoring a cursor.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a), [supplier-sync/src/SupplierSync.java:1–3](#evidence-f4ed0a12-6194-4b67-9dd3-155b81b8761b).

   Agent review: The README explicitly lists cursor persistence as absent; the short source has no store or recovery operation.

6. **fact** — The README characterizes this as static synthetic source and says deployment and runtime behavior are unverified.

   Evidence: [supplier-sync/README.md:1–5](#evidence-d725beb4-3514-40b3-851c-f15c32a2d80a).

   Agent review: The README marks deployment/runtime unverified.

Unanswered 1: What mechanism, if any, supplies execution or scheduling for this job?

Agent review: Scheduling/execution machinery is absent.

Unanswered 2: What concrete supplier client implements `Supplier.fetchSince`?

Agent review: Concrete supplier client is absent.

Unanswered 3: What durable store and recovery procedure persist and restore the cursor after a crash?

Agent review: Durable cursor/recovery procedure is absent.

Unanswered 4: What failure-handling behavior applies if the supplier request or cursor persistence fails?

Agent review: Failure handling is not established.

Unanswered 5: Are identity validation, authentication, and authorization enforced for any supplier interaction?

Agent review: Optional security controls are left open.

Unanswered 6: Which deployment environment and deployed revision, if any, are being assessed?

Agent review: Deployment environment/revision is unknown.

- **answer: cursor-pass-through — met.** The supplied code accepts a cursor and calls Supplier.fetchSince.
  Agent review: Cursor delegation is described. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-execution — met.** The external client and scheduling are not implemented in the supplied sources.
  Agent review: Missing scheduling and concrete client are both stated. Claims: 3, 4; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: missing-recovery — met.** Cursor persistence and failure recovery are not implemented there; a restart/resume mechanism is unknown.
  Agent review: Crash recovery is unverified and the missing persistence/recovery pieces are explicit. Claims: 2, 3, 5, 6; unanswered: 3, 4, 6.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: Automatic cursor persistence or restart recovery.

No recovery mechanism is invented and absence stays scoped to supplied sources.

Forbidden assertion absent: Global absence of an external scheduler or client outside the supplied sources.

No recovery mechanism is invented and absence stays scoped to supplied sources.

## h09 (reserved): Is the production order-topic value determined by the available local and production configuration sources?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The production configuration sets `orderTopic` to the unresolved placeholder `${ORDER_TOPIC}`; its README says the operator must supply the actual production value and that it is unknown.

   Evidence: [deployment-production/config/production.json:1–5](#evidence-c055d4bb-320a-4aa1-924e-8495d03e2c2a), [deployment-production/README.md:1–5](#evidence-b474c9e6-1800-409e-a0e7-2af2e64ede73).

   Agent review: The production JSON and README explicitly supply the placeholder and unknown operator value.

2. **fact** — The available local deployment configuration sets `orderTopic` to `orders.placed.v2`, but its documentation explicitly says local values are not production values.

   Evidence: [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20), [deployment-local/README.md:1–5](#evidence-057d5f18-b727-4841-b04b-08871b566e2e).

   Agent review: The local JSON and README give the local value while disallowing production substitution.

3. **fact** — The order API and order worker select `ORDER_TOPIC` when it is present, otherwise using their configured topic; the supplied code is synthetic and does not include an actual Kafka driver.

   Evidence: [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706), [order-worker/src/main/java/OrderConsumer.java:1–18](#evidence-b3b4c9af-a910-4963-a696-dd643266e1d1).

   Agent review: Both code paths read ORDER_TOPIC with a configured fallback; the API comment excludes the Kafka driver and the worker defines interfaces.

4. **inference** — Therefore, the production order-topic value is not determined by the supplied local and production configuration sources: production requires an operator-provided environment value, while the known local value cannot be substituted for it.

   Evidence: [deployment-production/README.md:1–5](#evidence-b474c9e6-1800-409e-a0e7-2af2e64ede73), [deployment-local/README.md:1–5](#evidence-057d5f18-b727-4841-b04b-08871b566e2e), [deployment-production/config/production.json:1–5](#evidence-c055d4bb-320a-4aa1-924e-8495d03e2c2a).

   Agent review: The inference correctly leaves the actual production value unresolved.

5. **conflict** — An older runbook names `orders.created.v1`, whereas the current local configuration names `orders.placed.v2`; the runbook explicitly preserves this disagreement.

   Evidence: [architecture-docs/docs/old-runbook.md:1–3](#evidence-368ac089-8d91-41bd-90fa-7d402bc76f48), [deployment-local/config/local.json:1–6](#evidence-0e5dac24-2d52-4a88-8712-f5d899f76d20).

   Agent review: The historical runbook itself records the discrepancy with current local configuration; this is not a conflict with an unknown production value.

Unanswered 1: What `ORDER_TOPIC` value has the production operator supplied?

Agent review: The operator-supplied production topic remains unknown.

Unanswered 2: Which source is authoritative for the documented topic disagreement?

Agent review: Authority for the documented discrepancy remains unknown after the conflict is stated.

Unanswered 3: What production deployment configuration and runtime environment are actually in use?

Agent review: Actual production configuration/runtime remains unknown.

- **answer: production-placeholder — met.** Production retains the operator-supplied ORDER_TOPIC placeholder; its concrete value is unknown.
  Agent review: The placeholder and unresolved production value are explicit. Claims: 1, 4; unanswered: 1, 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: no-local-substitution — met.** The local order-topic declaration cannot establish the production value.
  Agent review: The local value is expressly not substituted for production. Claims: 2, 4; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: A known production topic inferred from local config.

No production topic is invented and no false local-versus-production conflict is introduced.

Forbidden assertion absent: A conflict between a known local value and an unknown production value.

No production topic is invented and no false local-versus-production conflict is introduced.

## h10 (reserved): Is tenant membership enforced by the supplied tenant context library, and what can we conclude about controls elsewhere?

Agent outcome: **passed**. Required propositions and control scope pass. Unlike d10, literal header names are stated separately and connectivity is expressly unverified; the broad propagation wording still merits independent review.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The supplied tenant context library carries a tenant identifier but explicitly does not authenticate users, validate membership, or implement authorization.

   Evidence: [tenant-library/README.md:1–5](#evidence-375282ab-ddeb-45a6-b655-750ba62cbae2).

   Agent review: The tenant-library README explicitly excludes authentication, membership checks and authorization.

2. **fact** — Its supplied implementation is only a TenantContext record containing a tenantId string; the library documentation says deployment and runtime behavior are unverified.

   Evidence: [tenant-library/src/TenantContext.java:1–2](#evidence-290803fe-730f-4547-bfe1-2c6bd068475a), [tenant-library/README.md:1–5](#evidence-375282ab-ddeb-45a6-b655-750ba62cbae2).

   Agent review: The Java record contains only tenantId; the README disclaims runtime verification.

3. **fact** — The supplied checkout facade propagates a caller-provided tenant value as an x-tenant-id header and documents that authentication is not implemented.

   Evidence: [checkout-bff/src/checkout.ts:1–3](#evidence-9270a4cd-6432-437e-82ed-37b1ba350624), [checkout-bff/README.md:1–5](#evidence-1595642c-3493-48c5-9e39-fd6d82771849).

   Agent review: The facade source explicitly sends x-tenant-id; its README excludes authentication in this facade.

4. **fact** — The supplied portal code also sends a caller-provided tenantId in the X-Tenant header when submitting an order.

   Evidence: [portal/src/orders.ts:1–9](#evidence-8ad507c4-4971-4494-81f3-78857679ca7d).

   Agent review: The supplied portal function sends tenantId as X-Tenant.

5. **fact** — The supplied order API route configuration binds Orders.accept.tenantId to X-Tenant, and the handler uses that value to create and publish an OrderPlaced event.

   Evidence: [order-api/config/routes.json:1–7](#evidence-7d30fbad-fd9f-484f-8db3-d9f1b5477e51), [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: The route binds the literal X-Tenant header to the named parameter; the method constructs an event and invokes its publisher port. Claim 8 expressly restricts this to declarations rather than live sending.

6. **fact** — The OrderPlaced contract declares tenantId as a field and tenantId:orderId as its key.

   Evidence: [order-api/contracts/OrderPlaced.json:1–8](#evidence-13fffe6e-e0e4-46ea-a88c-be05b455b194).

   Agent review: The API contract explicitly contains tenantId and the tenantId:orderId key.

7. **inference** — The supplied code shows tenant identity propagation across these declared request and event interfaces, but it does not establish tenant-membership enforcement, authentication, or authorization at those boundaries.

   Evidence: [tenant-library/README.md:1–5](#evidence-375282ab-ddeb-45a6-b655-750ba62cbae2), [checkout-bff/src/checkout.ts:1–3](#evidence-9270a4cd-6432-437e-82ed-37b1ba350624), [order-api/config/routes.json:1–7](#evidence-7d30fbad-fd9f-484f-8db3-d9f1b5477e51), [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: Read narrowly as identity carriage in separately declared interfaces, this inference is supported: claims 3 and 5 give the different header names separately, and claim 8/unknown 3 leave connection unverified. It does not demonstrate that x-tenant-id reaches X-Tenant; that compatibility remains an explicit review caveat.

8. **fact** — The order API supplies synthetic transport interfaces only; no actual HTTP server or Kafka driver is included, so the declared route-to-handler and publish path is not a verified live connection.

   Evidence: [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706), [order-api/pom.xml:1–8](#evidence-4fa6af99-3214-4a04-8f5f-8633553c1d92).

   Agent review: The Orders.java comment explicitly excludes an HTTP server and Kafka driver. The claim preserves the unverified live-connection boundary.

Unanswered 1: Which supplied or deployed component, if any, validates that an authenticated principal is a member of the propagated tenant?

Agent review: No membership-enforcing deployed component is established.

Unanswered 2: Which supplied or deployed component, if any, authenticates callers and authorizes tenant-scoped actions?

Agent review: No authentication/authorization implementation is established.

Unanswered 3: Are the declared portal, checkout facade, order API, and tenant-library revisions deployed together and connected at runtime?

Agent review: Co-deployment and connections among the separately named components remain unknown.

Unanswered 4: What tenant-membership controls exist in the partially covered or unsupplied repositories and excluded material?

Agent review: Controls outside the supplied coverage remain unknown.

- **answer: identifier-only — met.** TenantContext holds a tenant identifier and its library explicitly lacks authentication, membership validation and authorization.
  Agent review: The library-only membership question and all three missing control types are answered. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: controls-elsewhere — met.** Enforcement elsewhere or in deployment remains unknown; do not infer system-wide absence.
  Agent review: Enforcement outside the library and runtime connectivity remain unknown. Claims: 7, 8; unanswered: 1, 2, 3, 4.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: TenantContext proves tenant membership.

No membership proof or system-wide absence is asserted. The interface synthesis must not be read as a demonstrated checkout header mapping.

Forbidden assertion absent: No authentication or authorization exists anywhere in the system.

No membership proof or system-wide absence is asserted. The interface synthesis must not be read as a demonstrated checkout header mapping.

## h11 (reserved): What does the shared OrderPlaced schema establish about whether the library sends messages at runtime?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The shared OrderPlaced schema declares version 2 with orderId, tenantId, and createdAtMillis fields; its key is tenantId:orderId, its transport is Kafka, and its encoding is unspecified.

   Evidence: [contract-library/contracts/OrderPlaced.json:1–12](#evidence-2ab39d28-8818-4d88-accf-810d01962169).

   Agent review: The shared JSON supplies version, fields, key, transport and unspecified encoding.

2. **fact** — The contract library states that it defines message shapes for publishers and consumers, and that owning a schema file does not make the library a running producer or service.

   Evidence: [contract-library/README.md:1–5](#evidence-10fb2260-794c-4507-a813-b71092aaef31).

   Agent review: The README explicitly distinguishes shapes from a running producer/service.

3. **inference** — Therefore, the shared schema establishes a message contract and intended Kafka transport, but does not by itself establish that the library sends messages at runtime.

   Evidence: [contract-library/README.md:1–5](#evidence-10fb2260-794c-4507-a813-b71092aaef31), [contract-library/contracts/OrderPlaced.json:1–12](#evidence-2ab39d28-8818-4d88-accf-810d01962169).

   Agent review: The inference correctly limits a schema to its declaration and intended transport.

4. **fact** — The supplied order-api code constructs OrderPlaced and calls an EventPublisher port, but explicitly includes no actual Kafka driver; this is not a verified runtime send implementation.

   Evidence: [order-api/src/main/java/Orders.java:1–18](#evidence-26e5b2de-1154-4f30-adce-a9a719102706).

   Agent review: The Java source constructs an event and invokes an interface, with an explicit no-driver comment; no live send is inferred.

Unanswered 1: Which concrete EventPublisher implementation, if any, is configured to send OrderPlaced messages at runtime?

Agent review: The concrete publisher implementation is missing.

Unanswered 2: In which deployment environment, if any, are the relevant publisher and Kafka connection configured and running?

Agent review: A deployed publisher/Kafka connection is unverified.

- **answer: schema-declaration — met.** The contract library defines the OrderPlaced message shape.
  Agent review: The shared message definition is described. Claims: 1, 2; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: not-running-producer — met.** The schema/library declaration does not establish a running producer; publishing implementation or deployment needs separate evidence.
  Agent review: The schema is expressly insufficient to establish runtime publication. Claims: 2, 3, 4; unanswered: 1, 2.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: The library runs a publisher because it owns the schema.

The library is not promoted to a running producer and the sources are not called an exhaustive publisher inventory.

Forbidden assertion absent: All publishers are enumerated by the contract library.

The library is not promoted to a running producer and the sources are not called an exhaustive publisher inventory.

## h12 (reserved): What evidence shows whether the tenant-and-order uniqueness migration has actually run?

Agent outcome: **passed**. All required propositions and scope limits are supported by the issued originals.

- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.

1. **fact** — The supplied migration declares creation of a unique compound index on `shop.orders` for `{ tenantId: 1, orderId: 1 }`.

   Evidence: [database-migrations/migrations/001-orders.js:1–3](#evidence-581dbbc8-2bca-4ef7-b2fb-378bcc5c3354).

   Agent review: The migration declares unique:true with both fields on shop.orders.

2. **fact** — The migration repository documentation explicitly states that source presence does not prove the migration was applied, and that no migration runner or database is included in the supplied source.

   Evidence: [database-migrations/README.md:1–5](#evidence-a2065ca2-c9cc-42c8-8b9e-13f8c8322a69).

   Agent review: The README explicitly states that source does not prove application and includes no runner/database.

3. **inference** — Therefore, the supplied evidence establishes the intended uniqueness migration but does not verify that it has actually run in any database.

   Evidence: [database-migrations/migrations/001-orders.js:1–3](#evidence-581dbbc8-2bca-4ef7-b2fb-378bcc5c3354), [database-migrations/README.md:1–5](#evidence-a2065ca2-c9cc-42c8-8b9e-13f8c8322a69).

   Agent review: The inference correctly leaves actual database execution unverified.

4. **fact** — The order worker's local configuration names the `shop.orders` MongoDB target, but this is local configuration only.

   Evidence: [order-worker/config/local.json:1–7](#evidence-25044091-7966-48b5-ad83-d081c0d53e30).

   Agent review: The worker JSON independently names the same local target without proving deployment or index state.

5. **fact** — The supplied order-worker code contains only Mongo and Kafka interfaces and explicitly says these synthetic interfaces do not provide broker or database runtime guarantees.

   Evidence: [order-worker/src/main/java/OrderConsumer.java:1–18](#evidence-b3b4c9af-a910-4963-a696-dd643266e1d1).

   Agent review: The worker source defines Mongo/Kafka interfaces and explicitly disclaims broker/database guarantees.

Unanswered 1: What migration-runner execution record, migration history entry, or database index inspection verifies that the unique `{tenantId, orderId}` index exists in the relevant deployed `shop.orders` database?

Agent review: Execution history or actual database inspection is needed; the question does not assert it is available.

Unanswered 2: Which deployment environment and database instance are in scope for verifying the migration?

Agent review: The deployment/database scope is unknown.

Unanswered 3: Are the supplied migration and order-worker revisions deployed together in that environment?

Agent review: Co-deployed migration/worker revisions are unknown.

- **answer: declared-index — met.** A migration declares a unique tenantId/orderId index on shop.orders.
  Agent review: The intended index and target are stated. Claims: 1; unanswered: none.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

- **qualification: unproven-application — met.** Source presence does not prove application; no migration runner or database is included and live index state is unknown.
  Agent review: Application, live database state and deployment remain unverified. Claims: 2, 3, 4, 5; unanswered: 1, 2, 3.
  Equivalent support: No alternative reference is needed; the cited originals directly support this requirement.

Forbidden assertion absent: The index is installed because its migration exists.

No installed index, uniqueness enforcement or idempotency guarantee is inferred from source.

Forbidden assertion absent: Uniqueness, concurrency or idempotency guarantees from an unapplied migration.

No installed index, uniqueness enforcement or idempotency guarantee is inferred from source.

### Evidence 0e5dac24-2d52-4a88-8712-f5d899f76d20

deployment-local/config/local.json, lines 1–6. Revision: `266b8b73fbf744f2df4395e223df13b7e7504ffe`.

Blob: `5807005f1b1f666ca239932a4e7221a8e17fbbf3`. File SHA-256: `0a5763690d1c877aa13e1e983bcba9b1911d0333cc52653b0b68c6e548e2e79d`. Span SHA-256: `b4d8a4bdf17feac6f0cb4bd7ac314a247891a8c771e0d38a3f91eface8156800`.

````text
{
  "environment": "local",
  "orderTopic": "orders.placed.v2",
  "stockTopic": "stock.reserved.v1",
  "carrierHost": "carrier.example.invalid"
}
````

### Evidence 22e1836e-8f33-4d28-89f6-f9817aad9583

inventory-worker/config/local.json, lines 1–6. Revision: `ddd6e72aa0a8d32d701ac1ab4e05b01abd4eba32`.

Blob: `aff8ded61037b18ec0fd158f526028f27d8eaab7`. File SHA-256: `8b7fe3bb5a3227daaf68a1091915fe546c8f8fc6503e429d4b8025894ad364bb`. Span SHA-256: `6349aa25543db045212c297d44d165d6c1e5271826d81ea98ca3950c3355c8fc`.

````text
{
  "environment": "local",
  "stockTopic": "stock.reserved.v1",
  "mongoDatabase": "warehouse",
  "mongoCollection": "stock"
}
````

### Evidence d8a2e2a9-3ca4-4ebb-a609-ead869e554f9

contract-library/contracts/StockReserved.json, lines 1–9. Revision: `6fc0b2f8bbd4b88a35b6c04e6dc974b762cc3cbe`.

Blob: `d7e8afbd09ed893def7dda0d0075b05c3a1c63e7`. File SHA-256: `af4fff6646aeae87964f1bfe8df288cf4a14a39184114bf5fcb86d7b8a820efa`. Span SHA-256: `25631ffca54c9727ca932f3d6c84d9b38de83c63a28aee74df1e8f400b709671`.

````text
{
  "name": "StockReserved",
  "version": 1,
  "fields": {
    "sku": "string",
    "units": "integer"
  },
  "transport": "Kafka"
}
````

### Evidence 56cf16fe-f4ba-4219-9961-fafde80026e4

inventory-worker/src/StockProjection.java, lines 1–4. Revision: `ddd6e72aa0a8d32d701ac1ab4e05b01abd4eba32`.

Blob: `4b2f90579e71f57be852684d173a2220e7a4e291`. File SHA-256: `16972cc6f4c69a56e202ca19dc4fc4324e448ea29a897f03c13e769091c894f3`. Span SHA-256: `cb6533bb495c12606f49fc3dafb40196486f1a157111c7fa4f6c985dd245bc85`.

````text
package synthetic.stock;
record StockReserved(String sku, int units) {}
interface StockStore { void project(StockReserved event); }
class StockProjection { void accept(StockStore store, StockReserved event) { store.project(event); } }
````

### Evidence 63bd541a-fa55-47fb-b6a2-ef6bbd38c409

inventory-worker/README.md, lines 1–5. Revision: `ddd6e72aa0a8d32d701ac1ab4e05b01abd4eba32`.

Blob: `6318dfd46679452c388b31075374eb002d0a6ce1`. File SHA-256: `fb931db55c8bd7d02080203791b39e3e4e8ed11fafd9ea5d1ed3746c6fa89fb9`. Span SHA-256: `463766765def4a89d5ee97cf052043dbcd307ba6cf30c96e45dbb8f91618f48a`.

````text
# Stock event projection

Consumes StockReserved through an application port. StockReserved is separate from OrderPlaced. The subscriber and database implementations are absent.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence 9a735871-1980-415d-9a8b-2cb95c568284

legacy-admin/src/stock.js, lines 1–3. Revision: `831849791b519da2c71f3ee4c918fbc7a6479b52`.

Blob: `cc38f8a74e5df82aafb8343a6d51f487021ba0a5`. File SHA-256: `f9058a11e9b89e2f653c26e37defa9e2666e5eda9c5870f9daac128cfcc73b64`. Span SHA-256: `8318393618980ed1faf22eca04d58e631bfd7a7e1b524eb9b95ca15b3d5b3146`.

````text
define(['dojo/request'], function(request) {
  return { reserve: function(data) { return request.post('/stock/reservations', { data: data }); } };
});
````

### Evidence fe46e7ed-a4d6-403b-9568-6cb2aaad0178

inventory-api/config/routes.json, lines 1–15. Revision: `0e7f2a7f4776d224736bf10b8e64fd226f2d1d86`.

Blob: `730d6e2baa1774081561089cea1b156bc91945f0`. File SHA-256: `58713a0f98e14f6ce46d52b03080b7a2b3e609c8c66d0b0e048f78d19ff17ebc`. Span SHA-256: `7d2f3b5eadc2f7b36419e271edd06bf38b3fb60913d325a6f17addb1316ac241`.

````text
{
  "environment": "local",
  "routes": [
    {
      "method": "POST",
      "path": "/stock/reservations",
      "handler": "Reservations.reserve"
    },
    {
      "method": "GET",
      "path": "/stock/availability",
      "handler": "Availability.check"
    }
  ]
}
````

### Evidence 1e640835-3741-4488-8305-a9802c085b99

inventory-api/src/Reservations.java, lines 1–5. Revision: `0e7f2a7f4776d224736bf10b8e64fd226f2d1d86`.

Blob: `f55b75ab09ada95d46bea07145d8915bba276b38`. File SHA-256: `5aa47d36bb07bf61b29ddfbd429e7e93f8a9c5c23a2f20e748b7e9b725a0218a`. Span SHA-256: `7209ef45fb0eb2eeaa62ce38404bd3263ee25e214aad2127d2cb00a3d2a5a9a6`.

````text
package synthetic.stock;
class Reservations {
  interface Stock { void reserve(String sku, int units); }
  void reserve(Stock stock, String sku, int units) { stock.reserve(sku, units); }
}
````

### Evidence 2b706848-d3e3-42bf-a85f-53c9f736bf10

legacy-admin/README.md, lines 1–5. Revision: `831849791b519da2c71f3ee4c918fbc7a6479b52`.

Blob: `998c1eeb9089446fc53219c84a1351c5a3dfa249`. File SHA-256: `5d67447f838128aaaea94d3eb7553f9d877b974248f5dc4a8c709ac0f4ddebec`. Span SHA-256: `36269852062c7d0013d1c617a15e204dd0607b4c6da7d7b2b8ff6e0baaf90621`.

````text
# Legacy administration client

Dojo AMD stock administration view. A computed plugin name is intentionally unresolved; the build configuration and runtime plugin are unavailable.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence 18fa33af-dd02-44b6-9528-5ff766a00c73

inventory-api/README.md, lines 1–5. Revision: `0e7f2a7f4776d224736bf10b8e64fd226f2d1d86`.

Blob: `615e7b1ef0678a7bebae5dbeb3cda346b2e5be7a`. File SHA-256: `386bbc9cfe0b1d5b4259eb6cac121155b1cdbc5e865e778bf290e3bc1b29db4f`. Span SHA-256: `6096f8ba0a3fc401f3ad10877ef4be91fea84896959c8575f1f41143cffc09ec`.

````text
# Stock reservation and availability applications

This repository contains two logical applications: Reservations changes reserved quantities; Availability reads stock. Repository identity does not imply one deployed service.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence fa4a1bb5-93c8-44ae-8b2d-51fee373a26d

legacy-admin/src/plugin.js, lines 1–3. Revision: `831849791b519da2c71f3ee4c918fbc7a6479b52`.

Blob: `be2a3fe0276b4470010b8210f51697172c171f8a`. File SHA-256: `79bcf9b35adc5dbd6d826a71cc6cacf26700bee32a1f42f89d41b44b855be83b`. Span SHA-256: `ee2606ff0ffefd498c43f8b0438620fecf9fa48a7c7897d538ef98c6d4b0ab9c`.

````text
define([], function() {
  return function(name) { require(['plugins/' + name], function(plugin) { plugin.open(); }); };
});
````

### Evidence ce353c64-8e99-4cf6-86b2-b42a40848abf

shipping-worker/config/local.json, lines 1–6. Revision: `e71a493dede8f64a0785550cf4968b3050c86019`.

Blob: `df2e2bc8b2c83eb263b865918f20f9bf6ab8dd26`. File SHA-256: `9e4498b6e4432e5c7225801828695cecf99d70f04d781fa1042eed4492e38712`. Span SHA-256: `31816b6e68f04e9c66f999b8b2e516228f4c689820ed2d2f152cbd371f17252a`.

````text
{
  "environment": "local",
  "shipmentTopic": "shipments.accepted.v1",
  "mongoDatabase": "logistics",
  "mongoCollection": "shipments"
}
````

### Evidence b96e6021-445d-440c-b211-4e48e6f9ce66

shipping-worker/src/Shipments.java, lines 1–4. Revision: `e71a493dede8f64a0785550cf4968b3050c86019`.

Blob: `2307427cb426cb7f9b5344c99840936980c12e32`. File SHA-256: `9d4b894cf44e31f6647f17145ad0d52327cb3ce50ba2edaf256d8d925a78f822`. Span SHA-256: `b83404cf7531e428f7b48c9db92788c3b5b0ea24963a977ea038b2c219bf3620`.

````text
package synthetic.shipping;
record ShipmentAccepted(String orderId, String shipmentId) {}
interface ShipmentStore { void save(ShipmentAccepted event); }
class Shipments { void accept(ShipmentStore store, ShipmentAccepted event) { store.save(event); } }
````

### Evidence ad8e2f9d-3c2c-4967-8e22-290ab5265eb7

shipping-worker/README.md, lines 1–5. Revision: `e71a493dede8f64a0785550cf4968b3050c86019`.

Blob: `66f47e1ec682bf67599e3af49fe436f25cfffc0b`. File SHA-256: `f58570cdfc47947dfb24fc507ba4131452e1515853b0cb516cf350ce35480782`. Span SHA-256: `a869e5bcc393b4b1dca2fd2110887576c3aa0b5f3759abb0922b8a98c462a7ca`.

````text
# Shipment event projection

Consumes ShipmentAccepted and updates the shipment projection. No link to a live carrier event subscription is implemented.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence a29dca57-6391-4b80-b829-4dd7a14acce9

shipping-api/src/carrier.ts, lines 1–3. Revision: `1d89443e2914afb8de2b02389aabfe862b2a3e22`.

Blob: `bcf0031ff72720395c7dd668e155687c84599c08`. File SHA-256: `e55a27caa23d2d30825b37d8f60a36948d3d4cb91560c61f1dcb2292276c5a2a`. Span SHA-256: `c0b11bec7b7665746fa4b37bf0a883147f32c6acc967bdbb968659517669dac3`.

````text
export async function requestShipment(orderId: string) {
  return fetch('https://carrier.example.invalid/shipments', { method: 'POST', body: JSON.stringify({ orderId }) });
}
````

### Evidence 9cdc5a46-813b-4eec-9fda-2daa077fb4da

shipping-api/README.md, lines 1–5. Revision: `1d89443e2914afb8de2b02389aabfe862b2a3e22`.

Blob: `bd4f97cf1364722148084c0c86991fd30fa83e9c`. File SHA-256: `a21352a5bffb86af99585c21168a5fa929f7551f65f702c9ced943975465a089`. Span SHA-256: `9422c96e3cc39653f611d4110258c12c34e27bc2f051ee4b78c57d004824d75a`.

````text
# Shipment request adapter

Previously called fulfillment-api. Sends shipment requests to an external carrier. Carrier internals, delivery guarantees and retry behavior are unavailable.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence f4ed0a12-6194-4b67-9dd3-155b81b8761b

supplier-sync/src/SupplierSync.java, lines 1–3. Revision: `ea9faab3d1e0a2bdcfcb93b3791cbade992129b6`.

Blob: `ddb7bde1ecd6df03a89396176d16c5adae3b0d28`. File SHA-256: `3649e8cd3def84a97d53eaca944405b21cef0c7e2f213c1269d7085c10ca2767`. Span SHA-256: `e68ecd3fa9350a60965ab4d7c45c1c9ea8596a2ae8af4f78dd8cbd99b8907fb5`.

````text
package synthetic.supply;
interface Supplier { String fetchSince(String cursor); }
class SupplierSync { String run(Supplier supplier, String cursor) { return supplier.fetchSince(cursor); } }
````

### Evidence d725beb4-3514-40b3-851c-f15c32a2d80a

supplier-sync/README.md, lines 1–5. Revision: `ea9faab3d1e0a2bdcfcb93b3791cbade992129b6`.

Blob: `ea3bdca03093bd2598eeda8601635b561ab1756b`. File SHA-256: `83a58e31c683d9252a1747ea576a5421ddebe34002b6e8ef03b8acf02aaaf2bf`. Span SHA-256: `3b01d26a73a523b047b60e417ebd0c396504f0ec335e5b6e13cdf26fa5cc29eb`.

````text
# Supplier inventory import job

A Java batch port requests supplier stock since a cursor. The external client, scheduling, cursor persistence and failure recovery are not implemented.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence 057d5f18-b727-4841-b04b-08871b566e2e

deployment-local/README.md, lines 1–5. Revision: `266b8b73fbf744f2df4395e223df13b7e7504ffe`.

Blob: `485c2f7fb4dafb33fad6c2926b64493e057c9df8`. File SHA-256: `f7799ac2083913178985916e706fd1a49a274e19ae1ec0848f9dd3cd06703b27`. Span SHA-256: `5193b2c91d19d834b00c0f1ff290c36c6753b306b26153be340c7ace9ad6d86f`.

````text
# Local deployment declarations

Documents an intended development composition. Local values are not production values; no deployment is executed or observed.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence b474c9e6-1800-409e-a0e7-2af2e64ede73

deployment-production/README.md, lines 1–5. Revision: `20e07d89a00cc5ad20af50a49550b10f82b4f9f4`.

Blob: `3d796013f4b87f38ffe6ac26d263aad2d76d859d`. File SHA-256: `0b1d4a2f34ddef9793e09e56ce19d35b7d70d472f16deee3de6a12a479f8f24f`. Span SHA-256: `b1abc988579ca1daa712c3e092a0bacf9479f04843027ab4f347a0be4fc32a6a`.

````text
# Production configuration placeholders

The production order topic and image digest must be supplied by the operator. Their actual values are unknown. Do not substitute local values.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence c055d4bb-320a-4aa1-924e-8495d03e2c2a

deployment-production/config/production.json, lines 1–5. Revision: `20e07d89a00cc5ad20af50a49550b10f82b4f9f4`.

Blob: `9f6b2e3291a46292a2df88de065296e82954fc9c`. File SHA-256: `c49bdd285fd36501b5e80b5ad7b66a5640871edc07b9cf15d35f288b8f713e11`. Span SHA-256: `55da0ac9b5d2ec5b7fe196e00d8779ba17ca2ef85c0d3de3200b6646d37a86dc`.

````text
{
  "environment": "production",
  "orderTopic": "${ORDER_TOPIC}",
  "apiImage": "${ORDER_API_IMAGE_DIGEST}"
}
````

### Evidence 26e5b2de-1154-4f30-adce-a9a719102706

order-api/src/main/java/Orders.java, lines 1–18. Revision: `237510937b4388fc718b7e9f93869954950df1bb`.

Blob: `975db0047e781fc2390836a2a968d7eb30a914fe`. File SHA-256: `533356fbff3802cf2f9085bc881c774a08851267d02a4448e8cc7105feb2352c`. Span SHA-256: `fb97e2aa5ace7f6292dd5007aa417217edc8d0b828793f822b3d0666df87cf52`.

````text
// Synthetic transport interfaces; no actual HTTP server or Kafka driver is included.
record OrderPlaced(String orderId, String tenantId, long createdAtMillis) {}
interface EventPublisher { void publish(String topic, String key, OrderPlaced event); }
record Accepted(String orderId) {}

final class Orders {
  private final EventPublisher publisher;
  private final String topic;
  Orders(EventPublisher publisher, String configuredTopic) {
    this.publisher = publisher;
    this.topic = System.getenv().getOrDefault("ORDER_TOPIC", configuredTopic);
  }
  Accepted accept(String orderId, String tenantId) {
    var event = new OrderPlaced(orderId, tenantId, System.currentTimeMillis());
    publisher.publish(topic, tenantId + ":" + orderId, event);
    return new Accepted(orderId);
  }
}
````

### Evidence 6d5491dc-28f8-429b-bec1-fccde7d07f25

order-api/config/local.json, lines 1–5. Revision: `237510937b4388fc718b7e9f93869954950df1bb`.

Blob: `54b8dfbfeff6dbf1ecef008317378fe1737ad131`. File SHA-256: `d407e198084d63c25904025f9420ab898b3660c545e90999124137dbfc7d865f`. Span SHA-256: `d8813b8db303e2a761a757727b3cbceba5cdb81d5955106448c8797bec35c391`.

````text
{
  "orderTopic": "orders.placed.v2",
  "kafkaBootstrap": "localhost:9092",
  "environment": "local"
}
````

### Evidence f58d9f58-5c08-4e3c-baa3-1bad27a9abd4

order-api/README.md, lines 1–8. Revision: `237510937b4388fc718b7e9f93869954950df1bb`.

Blob: `26534363df4b1da7fc8c12dfc1ebb6894485632c`. File SHA-256: `0bdd3acf2cde47a3fe1e587e9bcf8bb0d749e2507c5e0633a6aa30073d479e61`. Span SHA-256: `d3dd0008002d24d265b4b45c5f69035416b6fd28c95d840db483c233bb6a228f`.

````text
# Order API

Synthetic Java source samples with application-specific transport interfaces.
POST /api/orders accepts an orderId and the X-Tenant header, then publishes OrderPlaced.
The order event topic is orders.created.v1.
Production may override the topic using ORDER_TOPIC; deployment values are absent.
No architecture decision explains the choice of Kafka instead of synchronous HTTP.
Billing behavior is outside this repository set.
````

### Evidence 368ac089-8d91-41bd-90fa-7d402bc76f48

architecture-docs/docs/old-runbook.md, lines 1–3. Revision: `53dcb38eeb689da1418d6ef8dd9555a357d85dba`.

Blob: `68a3983d6302d7d49aa87d0a2853e6b2b7d663cd`. File SHA-256: `5134cb00305277313521a7def01c543a5dfab065e1e5e9a0a03018c9ee631941`. Span SHA-256: `ed756ba2a97e075a76c93cb2db1ee1081ead47c573fad673fc5ce2cb9f35942a`.

````text
# Historical order runbook

This older runbook names orders.created.v1. Current local configuration names orders.placed.v2. Preserve the disagreement when explaining the documented setup.
````

### Evidence 25044091-7966-48b5-ad83-d081c0d53e30

order-worker/config/local.json, lines 1–7. Revision: `211aa99e97ae82bda0ef69e3d4b7954abab5eb37`.

Blob: `b03346c9e9054dfc4e1f8c67e97deb2a43ab33d9`. File SHA-256: `d459c3d83f1a5dd9d452a86e409f1c208479fa4322a76474ab3e6816dbc15d49`. Span SHA-256: `90c318d1813803f0c89459125f3189fe3dc0f6b0c8923e33b706d39a98ebbe06`.

````text
{
  "orderTopic": "orders.placed.v2",
  "consumerGroup": "order-projection",
  "mongoDatabase": "shop",
  "mongoCollection": "orders",
  "environment": "local"
}
````

### Evidence b3b4c9af-a910-4963-a696-dd643266e1d1

order-worker/src/main/java/OrderConsumer.java, lines 1–18. Revision: `211aa99e97ae82bda0ef69e3d4b7954abab5eb37`.

Blob: `540575b28184552ffbb282fdc5adf18186582cad`. File SHA-256: `bc2c347b007865acd3044b52dba791f7f37abd235f5c406c06b4cf2f3516dfb0`. Span SHA-256: `0857fab150aee7933a73591e087863fbe1c349649f5d10c8ab0a7a0205c870f8`.

````text
// Synthetic interfaces describe intent, not broker or database runtime guarantees.
record OrderPlaced(String orderId, String tenantId, long createdAtMillis) {}
record Selector(String tenantId, String orderId) {}
interface MongoCollection { void replaceOne(Selector selector, OrderPlaced document, boolean upsert); }
interface KafkaSubscriber { void subscribe(String topic, String group, OrderConsumer handler); }

final class OrderConsumer {
  private final MongoCollection collection;
  OrderConsumer(MongoCollection collection) { this.collection = collection; }
  void start(KafkaSubscriber kafka, String configuredTopic, String group) {
    var topic = System.getenv().getOrDefault("ORDER_TOPIC", configuredTopic);
    kafka.subscribe(topic, group, this);
  }
  void onMessage(OrderPlaced event) {
    var selector = new Selector(event.tenantId(), event.orderId());
    collection.replaceOne(selector, event, true);
  }
}
````

### Evidence 9a739851-8c10-462b-8060-c985d9f97d3b

order-worker/README.md, lines 1–7. Revision: `211aa99e97ae82bda0ef69e3d4b7954abab5eb37`.

Blob: `96f551727c0f45798fef388669bdeed296a20486`. File SHA-256: `1fe2344c9f7d46ff007c9eb29b363b6a5a89be1e5312548ffa27ff982beb1794`. Span SHA-256: `17ab0aa5c6f8906333765b15f8640ee2836b97e50284a2a4455d614d6d4a5a62`.

````text
# Order projection worker

Synthetic Java consumer and MongoDB access interfaces; no drivers are supplied.
Local configuration consumes orders.placed.v2 and stores the order projection.
The configured production topic and deployed revisions are unknown.
Acknowledgment, retry, dead-letter routing and database indexes are not implemented here.
No repository in this fixture implements billing.
````

### Evidence 375282ab-ddeb-45a6-b655-750ba62cbae2

tenant-library/README.md, lines 1–5. Revision: `f7e01099f81a705281b6c50f2571c1a2cc116617`.

Blob: `776125775b412e5b43a16bd57b05e8c7d66a314b`. File SHA-256: `b4426d3b0b5a21e10e59e770459e1443bc5abc45f08529a2183e674864c3d676`. Span SHA-256: `cca96e16b675b9c77cf36b942e3f3be0182eff9bd9cdb84711b2ec6041070278`.

````text
# Tenant context propagation library

Carries a tenant identifier between callers. It does not authenticate users, validate membership or implement authorization.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence 290803fe-730f-4547-bfe1-2c6bd068475a

tenant-library/src/TenantContext.java, lines 1–2. Revision: `f7e01099f81a705281b6c50f2571c1a2cc116617`.

Blob: `53793d68bf5d3fad755ce78656238fd8ad2888e6`. File SHA-256: `5e2888b27b2292a6c761754b1f27c642c6afbd4c4f252bc3d757bcb8a3286427`. Span SHA-256: `ad92f684a9eb7dd532694b84c6bdb697997306a936824dd5c6b9210d2c43ed9c`.

````text
package synthetic.identity;
public record TenantContext(String tenantId) {}
````

### Evidence 9270a4cd-6432-437e-82ed-37b1ba350624

checkout-bff/src/checkout.ts, lines 1–3. Revision: `07d87b7d8a7a93ee8f93f6cdf3ae03ef8253869f`.

Blob: `0e8970c688b4ebd9e7fa211e61be4a5f8425ef11`. File SHA-256: `99b7fcc4f1e800ae7a5bc27584b39b826f5c362c3a8f90f030728288a01d715b`. Span SHA-256: `782d09307395e6b0f494eec40b4d7d3c86d58bf73968826ff5a0ba9743b8b53d`.

````text
export async function checkout(payload: unknown, tenant: string) {
  return fetch('http://order-api.local/api/orders', { method: 'POST', headers: { 'x-tenant-id': tenant }, body: JSON.stringify(payload) });
}
````

### Evidence 7d30fbad-fd9f-484f-8db3-d9f1b5477e51

order-api/config/routes.json, lines 1–7. Revision: `237510937b4388fc718b7e9f93869954950df1bb`.

Blob: `5c76ba7fcef6752e146c2cc8347305d702522367`. File SHA-256: `161e949a54ab2ab99648cd5dd07de4c4115d554d411e85dfc919412877e00a5e`. Span SHA-256: `bf02b9ad422fda91b66ace23870e9d0b142f550071231acbd668eb3c439b833d`.

````text
{
  "routes": [
    { "method": "POST", "path": "/api/orders", "handler": "Orders.accept" },
    { "method": "POST", "path": "/legacy/orders", "handler": "Orders.accept" }
  ],
  "headerBindings": { "Orders.accept.tenantId": "X-Tenant" }
}
````

### Evidence 1595642c-3493-48c5-9e39-fd6d82771849

checkout-bff/README.md, lines 1–5. Revision: `07d87b7d8a7a93ee8f93f6cdf3ae03ef8253869f`.

Blob: `261f12ad57582a5706700c35f83e81012ea4ea3b`. File SHA-256: `8a1098466199c4df0c9d6e86bfe054560531c93e855a307574d240de20f238b6`. Span SHA-256: `751ad7e7fec6fbd169baf19ef48f9ec8b9fab508467c1edf830e5fab0e3781aa`.

````text
# Checkout request facade

The browser-facing adapter forwards an order request to order-api. It propagates a tenant header; authentication and retries are not implemented.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence 10fb2260-794c-4507-a813-b71092aaef31

contract-library/README.md, lines 1–5. Revision: `6fc0b2f8bbd4b88a35b6c04e6dc974b762cc3cbe`.

Blob: `5c7741a76d46e4259c67bc873b01a841dfc54462`. File SHA-256: `e988c8fc972ae844cb1092410f92b82bf1834286b17cda0c4fcb147e97e1ad53`. Span SHA-256: `0112f47a6cd277a87179bcd4ca8d691cbf11444e2f0abb6858cf88b1f5c75ef0`.

````text
# Shared message declarations

Defines message shapes for consumers and publishers. Owning a schema file does not make this library a running producer or service.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence 2ab39d28-8818-4d88-accf-810d01962169

contract-library/contracts/OrderPlaced.json, lines 1–12. Revision: `6fc0b2f8bbd4b88a35b6c04e6dc974b762cc3cbe`.

Blob: `6c1620c04c5da92b9fd4d02be7914daa587b39cf`. File SHA-256: `d256f67e8251cd7e590379d5c855e79d2939ecf4a12f97704833c5709f572fb8`. Span SHA-256: `7e5f33e97efe145969d3bddc5b3c584530d809ffeb2270e7cd7ef25321e09476`.

````text
{
  "name": "OrderPlaced",
  "version": 2,
  "fields": {
    "orderId": "string",
    "tenantId": "string",
    "createdAtMillis": "epoch milliseconds"
  },
  "key": "tenantId:orderId",
  "transport": "Kafka",
  "encoding": "unspecified"
}
````

### Evidence 581dbbc8-2bca-4ef7-b2fb-378bcc5c3354

database-migrations/migrations/001-orders.js, lines 1–3. Revision: `d75867701ea1a0a3b103a9eecc9d7532c11c9058`.

Blob: `bd769cd005b4293acbe89ff45be535e57f940b77`. File SHA-256: `594a3329546cd338ee2af89b6b20ce970d8b8da2ac984e60e111bb6505a45571`. Span SHA-256: `fe2a04c6976050087f310667710eefa537dbb7bc189ee2db262f7784ef9fc477`.

````text
export async function up(client) {
  await client.db('shop').collection('orders').createIndex({ tenantId: 1, orderId: 1 }, { unique: true });
}
````

### Evidence a2065ca2-c9cc-42c8-8b9e-13f8c8322a69

database-migrations/README.md, lines 1–5. Revision: `d75867701ea1a0a3b103a9eecc9d7532c11c9058`.

Blob: `3cc6259eae0522e114348e459c8b3bc35381ce9e`. File SHA-256: `a008a3ad6dbbe130bc2f4ac4262e97d8e7f14bbafbeeb576473716555f962032`. Span SHA-256: `4e92ce58233153b2eed5ffc44535df4ada36c6d58a27fb5ec7d0094f61ac0c83`.

````text
# Mongo index migration source

A migration declares a compound tenantId/orderId unique index for shop.orders. Source presence does not prove it was applied. No migration runner or database is included.

Static synthetic source. Deployment and runtime behavior are unverified.
````

### Evidence ecc177a8-ce3d-4cd8-8667-e25569fd8381

legacy-admin/package.json, lines 1–5. Revision: `831849791b519da2c71f3ee4c918fbc7a6479b52`.

Blob: `8a2fafcf6e18eac9cb4d252ab56977b8015d5a70`. File SHA-256: `013f83e76cc83d49280caf76336a5ec058efd25505971d8b7e623b645585d6d6`. Span SHA-256: `8a93af7de14465b84d9e7dd78a7c50fa0f86b36f2c4cd8c65cb6688e49c7dfb9`.

````text
{
  "name": "@synthetic/legacy-admin",
  "version": "0.0.0",
  "private": true
}
````

### Evidence 8ad507c4-4971-4494-81f3-78857679ca7d

portal/src/orders.ts, lines 1–9. Revision: `603a69798dc12c3205e88d0498881b0c01079932`.

Blob: `cddba340127947346a0c0314c4cd3e4468503c21`. File SHA-256: `39e7b2a6ae1d45a2fbdc3903cd9f4d8c79419c6ba5f72c40de7aca6b5d0da410`. Span SHA-256: `994d43c6d111270cceaed9b5db6474c1442057b3973c9fb8facf2927317e58b8`.

````text
export async function submitOrder(orderId: string, tenantId: string) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': tenantId },
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw new Error('Order submission failed');
  return response.json();
}
````

### Evidence 13fffe6e-e0e4-46ea-a88c-be05b455b194

order-api/contracts/OrderPlaced.json, lines 1–8. Revision: `237510937b4388fc718b7e9f93869954950df1bb`.

Blob: `708bd5aa0ca8726c432bc39dc09bb83072f662cc`. File SHA-256: `b7226f44f281c6ee098c6d652ff33c40b32ca8954b451273c27d47a7579ddb79`. Span SHA-256: `f99a95788043b0b83a79db786345a41095f5e9db561ada837102f83635ff387e`.

````text
{
  "name": "OrderPlaced",
  "version": 2,
  "fields": { "orderId": "string", "tenantId": "string", "createdAtMillis": "epoch milliseconds" },
  "key": "tenantId:orderId",
  "transport": "Kafka",
  "encoding": "unspecified"
}
````

### Evidence 4fa6af99-3214-4a04-8f5f-8633553c1d92

order-api/pom.xml, lines 1–8. Revision: `237510937b4388fc718b7e9f93869954950df1bb`.

Blob: `6cb0850d285e9f774f9e8c554b8c2f22e99697cc`. File SHA-256: `b172e59a5d5d42a72e5ea68af530d6ba7ba489d92de52dba4d2a636febdf1781`. Span SHA-256: `25fd73a9ec439d548e2c0620860fad2bcfc7f3232fffc356edd05dff015c7265`.

````text
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>invalid.example.fixture</groupId>
  <artifactId>order-api</artifactId>
  <version>0.0.0</version>
  <properties><maven.compiler.release>17</maven.compiler.release></properties>
  <description>Static fixture only; no framework or transport implementation supplied.</description>
</project>
````
