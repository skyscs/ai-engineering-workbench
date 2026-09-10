export async function api<T>(route: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${route}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string; stderr?: string } } | null;
    throw new Error((body?.error?.message ?? `Request failed (${response.status}).`) + (body?.error?.stderr ? `\n${body.error.stderr}` : ''));
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
