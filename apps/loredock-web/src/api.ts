let session: Promise<string> | undefined;
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}
export async function api<T>(url: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  session ??= fetch('/api/session', { method: 'POST', headers: { 'x-loredock-client': 'web' } }).then(async response => {
    if (!response.ok) throw new Error('Cannot connect to LoreDock. Reload to retry.');
    return (await response.json() as { token: string }).token;
  });
  const token = await session;
  signal?.throwIfAborted();
  const response = await fetch('/api' + url, { method, ...signal ? { signal } : {}, headers: { 'Content-Type': 'application/json', 'x-loredock-csrf': token }, ...body === undefined ? {} : { body: JSON.stringify(body) } });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error = (result as { error?: { message?: string; code?: string } }).error;
    throw new ApiError(error?.message ?? 'The request failed.', response.status, error?.code);
  }
  return result as T;
}
