import { useEffect, useState } from 'react';

type HealthResponse = {
  status: 'ok';
  service: string;
  version: string;
};

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/session', {
      method: 'POST', headers: { 'x-aew-client': 'web' }, signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Session request failed with ${response.status}`);
        return fetch('/api/health', { signal: controller.signal });
      })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health request failed with ${response.status}`);
        }

        return (await response.json()) as HealthResponse;
      })
      .then(setHealth)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unknown health-check error');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Local-first developer tool</p>
        <h1>AI Engineering Workbench</h1>
        <p className="lede">
          A local workspace for evidence-backed AI engineering investigations.
        </p>

        <div className="status" aria-live="polite">
          <span className="status-dot" data-state={health ? 'ok' : error ? 'error' : 'pending'} />
          {health ? 'Local daemon connected.' : error ? `Daemon unavailable: ${error}` : 'Connecting to local daemon…'}
        </div>
      </section>
    </main>
  );
}
