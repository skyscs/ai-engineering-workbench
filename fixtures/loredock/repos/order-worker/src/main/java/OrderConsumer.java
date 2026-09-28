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
