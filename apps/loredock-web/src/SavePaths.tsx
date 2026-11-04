import { useEffect, useRef, useState } from 'react';
import type { CodePathsAvailableV2 } from '../../loredock/src/code-paths-v2-types';
import type { PathCaptureResult } from '../../loredock/src/native-capture-api';
import { api } from './api';

// Mounted by projection identity; navigation invalidates confirmations and pending work.
export function SavePaths({ value }: { value: CodePathsAvailableV2 }) {
  const [saved, setSaved] = useState<{ id: string; created: boolean }>();
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const active = useRef<AbortController | undefined>(undefined), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); }; }, []);
  async function save() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setPending(true); setError('');
    const valid = () => alive.current && active.current === controller;
    const params = new URLSearchParams({ buildId: value.identity.buildId, inventoryId: value.identity.inventoryId, generationId: value.generationId });
    if (value.selection.rootId) params.set('rootId', value.selection.rootId);
    try {
      const result = await api<PathCaptureResult>('/path-captures?' + params, 'POST', undefined, controller.signal);
      if (result.status !== 'captured' || !/^[a-f0-9]{64}$/.test(result.receiptId) || typeof result.created !== 'boolean')
        throw new Error('The save confirmation is out of date. Reload LoreDock.');
      if (valid()) setSaved({ id: result.receiptId, created: result.created });
    } catch (cause) { if (valid()) setError((cause as Error).message); }
    finally { if (valid()) { active.current = undefined; setPending(false); } }
  }
  function cancel() {
    active.current?.abort(); active.current = undefined; setPending(false);
    setError('Save confirmation was cancelled. A completed save may still exist; saving these paths again will reuse it.');
  }
  return <div className="save-paths">
    <div className="actions"><button disabled={pending} onClick={() => void save()}>{pending ? 'Saving paths…' : 'Save paths'}</button>
      {pending && <button className="quiet" onClick={cancel}>Cancel save</button>}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {saved && <div className="saved-path-confirmation" role="status"><p>{saved.created ? 'Paths saved.' : 'These paths were already saved.'}
      {' '}<a href={'/?savedPath=' + saved.id}>Open saved paths</a></p>
      <p className="muted">Bookmark the link to reopen this record later. Saved paths are kept in this catalog; a list of all saved paths is not available yet.</p></div>}
  </div>;
}
