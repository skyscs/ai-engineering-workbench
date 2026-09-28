export async function submitOrder(orderId: string, tenantId: string) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': tenantId },
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw new Error('Order submission failed');
  return response.json();
}
