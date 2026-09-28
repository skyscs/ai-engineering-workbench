# Order API

Synthetic Java source samples with application-specific transport interfaces.
POST /api/orders accepts an orderId and the X-Tenant header, then publishes OrderPlaced.
The order event topic is orders.created.v1.
Production may override the topic using ORDER_TOPIC; deployment values are absent.
No architecture decision explains the choice of Kafka instead of synchronous HTTP.
Billing behavior is outside this repository set.
