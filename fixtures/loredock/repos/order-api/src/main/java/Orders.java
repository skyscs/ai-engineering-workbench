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
