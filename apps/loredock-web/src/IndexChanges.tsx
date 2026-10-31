import { useEffect, useState } from 'react';
import type { IndexChanges } from '../../loredock/src/index-change-types';
import { api } from './api';

export function IndexChangeView({ buildId, boundary, openEvidence }: { buildId: string; boundary: string; openEvidence(id: string): void }) {
  const key = `${boundary}:${buildId}`;
  const [result, setResult] = useState<{ key: string; value: IndexChanges }>(), [error, setError] = useState<{ key: string; text: string }>();
  useEffect(() => {
    let stopped = false;
    if (!buildId) return;
    void api<IndexChanges>(`/builds/${encodeURIComponent(buildId)}/changes`).then(value => {
      if (!stopped) { setResult({ key, value }); setError(undefined); }
    }).catch(cause => { if (!stopped) setError({ key, text: (cause as Error).message }); });
    return () => { stopped = true; };
  }, [buildId, key]);
  const value = result?.key === key ? result.value : undefined;
  if (!buildId) return null;
  return <div className="index-changes"><h3>Changes in the selected index</h3>
    {error?.key === key ? <p className="error" role="alert">{error.text}</p> : !value ? <p role="status">Reading index changes…</p> : <>
      <p role="status">{value.comparison === 'legacy' ? 'Changes were not recorded for this earlier index.' : value.comparison === 'initial'
        ? 'Initial index; no earlier index to compare.' : value.complete && value.counts.added + value.counts.changed + value.counts.removed + value.counts.coverageChanged + value.counts.uncompared === 0
          ? 'No committed file changes since the previous index.' : `${value.counts.added} added · ${value.counts.changed} changed · ${value.counts.removed} removed · ${value.counts.coverageChanged} coverage changes · ${value.counts.uncompared} not comparable`}</p>
      {!value.complete && <p className="notice">Comparison has coverage gaps. Unexamined entries are not confirmed additions or deletions.</p>}
      {value.stale && <p className="notice">This comparison uses an older index or source registry. Revoked source scopes are excluded.</p>}
      <details className="change-details"><summary>Update details</summary>
        <p>Committed inventory only. Reuse does not confirm deployment or carry old answers and engineer corrections into this index.</p>
        {value.metrics && <p className="refresh-metrics">{value.metrics.reusedFiles} text files reused · {value.metrics.gitReadAttempts} Git file read attempts · {value.metrics.cacheRejections} cache validation failures</p>}
        <p>Read attempts include interrupted retries. Unsupported byte-dependent inputs may be read again.</p>
        <ul>{value.sources.map(source => <li key={source.sourceId}><strong>{source.name}</strong>{source.isNew && <span className="tag">New source</span>}
          <p className="muted">{source.previousRevision?.slice(0, 8) ?? 'No earlier revision'} → {source.revision?.slice(0, 8) ?? 'Revision unavailable'}</p></li>)}</ul>
        <ul className="changed-files">{value.files.map(file => <li key={`${file.sourceId}:${file.path}`}><span className="tag">{file.change === 'coverageChanged' ? 'Coverage changed' : file.change}</span>
          <strong>{file.sourceName} / {file.path}</strong>
          <div className="change-citations">{file.previousEvidenceId && <button className="quiet" onClick={() => openEvidence(file.previousEvidenceId!)}>Previous evidence</button>}
            {file.evidenceId && <button className="quiet" onClick={() => openEvidence(file.evidenceId!)}>Selected index evidence</button>}</div>
        </li>)}</ul>
        {value.omittedDetails > 0 && <p>{value.omittedDetails} file details omitted by preview limits; totals cover the bounded inventories.</p>}
        <ul>{value.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
      </details>
    </>}
  </div>;
}
