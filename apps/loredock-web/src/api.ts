let session: Promise<string> | undefined;
export async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  session ??= fetch('/api/session', { method: 'POST', headers: { 'x-loredock-client': 'web' } }).then(async response => {
    if (!response.ok) throw new Error('Cannot connect to LoreDock. Reload to retry.');
    return (await response.json() as { token: string }).token;
  });
  const token = await session;
  const response = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', 'x-loredock-csrf': token }, ...body === undefined ? {} : { body: JSON.stringify(body) } });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error((result as { error?: { message?: string } }).error?.message ?? 'The request failed.');
  return result as T;
}
