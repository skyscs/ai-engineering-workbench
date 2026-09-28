define(['dojo/request'], function (request) {
  return function submitLegacy(orderId, tenantId) {
    return request.post('/legacy/orders', {
      headers: { 'Content-Type': 'application/json', 'X-Tenant': tenantId },
      data: JSON.stringify({ orderId: orderId }),
      handleAs: 'json'
    });
  };
});
