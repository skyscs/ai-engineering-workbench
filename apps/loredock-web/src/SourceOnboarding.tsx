import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SourcePreview } from '../../loredock/src/types';
import { api } from './api';

export function SourceOnboarding({ refresh }: { refresh: () => Promise<void> }) {
  const [value, setValue] = useState(''), [preview, setPreview] = useState<SourcePreview>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), alive = useRef(true);
  const request = useRef<{ requestId: string; paths: string[]; previewHash: string } | undefined>(undefined);
  useEffect(() => () => { alive.current = false; generation.current++; }, []);
  const paths = () => value.split('\n').map(line => line.trim()).filter(Boolean);
  async function inspect(event: FormEvent) {
    event.preventDefault(); const current = ++generation.current;
    setBusy(true); setError(''); setPreview(undefined); request.current = undefined;
    try {
      const result = await api<SourcePreview>('/sources/preview', 'POST', { paths: paths() });
      if (alive.current && current === generation.current) setPreview(result);
    } catch (cause) { if (alive.current && current === generation.current) setError((cause as Error).message); }
    finally { if (alive.current && current === generation.current) setBusy(false); }
  }
  async function register() {
    if (!preview || busy) return;
    request.current ??= { requestId: crypto.randomUUID(), paths: paths(), previewHash: preview.previewHash };
    setBusy(true); setError('');
    try {
      await api('/sources/register', 'POST', request.current);
      if (alive.current) { setValue(''); setPreview(undefined); request.current = undefined; }
      await refresh();
    } catch (cause) { if (alive.current) setError((cause as Error).message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="source-onboarding" aria-label="Add repositories">
    <form onSubmit={inspect}>
      <label htmlFor="repository-path">Repository paths</label>
      <textarea id="repository-path" rows={4} placeholder={'/home/you/projects/order-api\n/home/you/projects/portal'} value={value}
        disabled={busy} maxLength={8192} required onChange={event => { generation.current++; setValue(event.target.value); setPreview(undefined); request.current = undefined; setError(''); }} />
      <p className="muted">One absolute local path per line. Preview up to 40 entries; keep up to 20 repositories connected.</p>
      <button disabled={busy || !value.trim()} type="submit">{busy ? 'Checking repositories…' : 'Preview repositories'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {preview && <div className="source-preview">
      <h3>Review repositories</h3>
      <p>{preview.ready} new repositories · {preview.available} available slots. Only entries marked ready will be added.</p>
      <ol>{preview.rows.map((row, index) => <li key={index}><strong>{row.status}</strong> <code>{row.input}</code>
        {row.path && row.path !== row.input && <p>Repository root: <code>{row.path}</code></p>}
        <p>{row.reason}</p></li>)}</ol>
      {preview.ready > preview.available && <p role="alert">The valid set exceeds the available slots. Edit the list and preview again; nothing has been added.</p>}
      <button className="primary" disabled={busy || !preview.canRegister} onClick={() => void register()}>Add {preview.ready} {preview.ready === 1 ? 'repository' : 'repositories'}</button>
      <p className="muted">This saves the reviewed sources. Choose Index sources when ready to read committed files.</p>
    </div>}
  </section>;
}
