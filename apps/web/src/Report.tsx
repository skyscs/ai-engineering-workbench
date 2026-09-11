import { Interventions } from './Interventions';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EvidenceContent, Intervention, InvestigationReport } from '@aew/core';
import { api } from './api';

/** Deliberately small Markdown subset; raw HTML and images are always inert text. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      try {
        const url = new URL(link[2]!);
        if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return <a key={i} href={url.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{link[1]}</a>;
      } catch { /* Unsupported links remain text. */ }
    }
    return part;
  });
}
export function Markdown({ text }: { text: string }) {
  return <div className="report-prose">{text.split(/(```[^\n]*\n[\s\S]*?```)/g).map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```') && part.includes('\n')) return <pre key={i}>{part.slice(part.indexOf('\n') + 1, -3)}</pre>;
    return <div key={i}>{part.split(/\n\s*\n/).filter(Boolean).map((block, j) => {
      const lines = block.split('\n');
      if (lines.every(line => /^[-*] /.test(line))) return <ul key={j}>{lines.map((line, k) => <li key={k}>{inline(line.slice(2))}</li>)}</ul>;
      return <p key={j}>{inline(block)}</p>;
    })}</div>;
  })}</div>;
}
export function Report({ base, revision, runId, runStatus, disabled, canChallenge, modelProfileId, submit }: {
  base: string; revision: number; runId: string | undefined; runStatus: string | undefined;
  disabled: boolean; canChallenge: boolean; modelProfileId: string | null; submit(route: string, body: unknown): Promise<void>;
}) {
  const [reports, setReports] = useState<InvestigationReport[]>([]), [selected, setSelected] = useState('');
  const [source, setSource] = useState<EvidenceContent | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cause, setCause] = useState<Intervention | null>(null);
  const sourceGeneration = useRef(0);
  useEffect(() => {
    let disposed = false;
    sourceGeneration.current++; setLoading(false);
    void api<{reports: InvestigationReport[]}>(`${base}/investigations`).then(value => {
      if (!disposed) { setReports(value.reports); setSelected(value.reports[0]?.id ?? ''); setSource(null); setError(''); }
    }).catch((e: Error) => { if (!disposed) setError(e.message); });
    return () => { disposed = true; sourceGeneration.current++; };
  }, [base, revision, runId, runStatus]);
  const report = reports.find(r => r.id === selected);
  useEffect(() => {
    let disposed = false; setCause(null);
    if (report?.triggeredByInterventionId) {
      void api<import('@aew/shared').RuntimeDetail>(`${base}/runtime-runs/${report.stageRunId}`).then(value => {
        if (!disposed) setCause(value.run.inputSnapshot.revision?.intervention ?? null);
      }).catch((e: Error) => { if (!disposed) setError(e.message); });
    }
    return () => { disposed = true; };
  }, [base, report?.id]);
  async function evidence(id: string) {
    if (!report) return;
    const generation = ++sourceGeneration.current;
    setSource(null); setError(''); setLoading(true);
    try { const content = await api<EvidenceContent>(`${base}/investigations/${report.id}/evidence/${id}`); if (generation === sourceGeneration.current) setSource(content); }
    catch (e) { if (generation === sourceGeneration.current) setError(`Evidence unavailable: ${e instanceof Error ? e.message : 'Cannot read the recorded source.'}`); }
    finally { if (generation === sourceGeneration.current) setLoading(false); }
  }
  async function download() {
    if (!report) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api${base}/investigations/${report.id}/export`);
      if (!response.ok) throw new Error(`Cannot export this report (${response.status}). Refresh the task and try again.`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `investigation-${report.id}-v${report.version}.md`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Cannot export the report.'); }
    finally { setLoading(false); }
  }
  const refs = (ids: string[]) => <span className="evidence-references">{ids.map(id => <button className="secondary" key={id} disabled={loading} onClick={() => void evidence(id)}>{id}</button>)}</span>;
  return <section aria-label="Investigation reports"><h3>Investigation reports</h3>
    {error && <p role="alert" className="error">{error}</p>}
    {!report ? <p>No published report yet.</p> : <>
      <label>Report version<select value={selected} disabled={loading} onChange={e => { sourceGeneration.current++; setSelected(e.target.value); setSource(null); setError(''); }}>
        {reports.map(r => <option key={r.id} value={r.id}>Version {r.version} · {r.status} · {r.freshness}</option>)}
      </select></label>
      <p>Version {report.version} · {report.status} · {report.freshness} · {report.createdAt}</p>
      <button className="secondary" disabled={loading} onClick={() => void download()}>Export Markdown</button>
      {report.previousVersionId && <p>Revises version {reports.find(r => r.id === report.previousVersionId)?.version ?? 'from earlier history'}.</p>}
      {cause && <div><h4>Triggered by this challenge</h4><p className="task-description">{cause.text}</p></div>}
      {report.freshness === 'stale' && <p role="status">Context changed since this report. Run another investigation to use the current context.</p>}
      <p className="hint">Locators were checked at publication. Review whether the cited material supports the conclusion. Source availability is checked again when opened.</p>
      <h4>Investigation</h4><Markdown text={report.result.investigation.summary} />
      <h4>Historical timeline</h4><ol>{report.result.investigation.timeline.map((entry, i) => <li key={i}><Markdown text={entry.description} />{refs(entry.evidenceIds)}</li>)}</ol>
      <h4>Root cause: {report.result.rootCause.status === 'identified' ? 'identified' : 'insufficient evidence'}</h4>
      <Markdown text={report.result.rootCause.summary} />{refs(report.result.rootCause.evidenceIds)}
      <h4>Unresolved questions</h4>{report.result.rootCause.unresolvedQuestions.length ? <ul>{report.result.rootCause.unresolvedQuestions.map((q, i) => <li key={i}><Markdown text={q} /></li>)}</ul> : <p>None reported.</p>}
      <h4>Evidence</h4><ul>{report.result.evidence.map(e => <li key={e.id}>{refs([e.id])}<Markdown text={e.description} /><code>{e.kind === 'artifact' ? `${e.artifactId} bytes [${e.byteStart}, ${e.byteEnd})` : `${e.repositoryId} @ ${e.revision}${e.path ? `:${e.path}:${e.lineStart}-${e.lineEnd}` : ''}`}</code></li>)}</ul>
      {loading && <p>Reading recorded evidence…</p>}
      {source && <section aria-label="Evidence source"><h4>Recorded source</h4><p><code>{source.locator}</code></p><pre>{source.text}</pre></section>}
    </>}
    <Interventions key={`${report?.id ?? 'initial'}:${revision}`} base={base} revision={revision} runId={runId} runStatus={runStatus}
      report={report} reports={reports} disabled={disabled} canChallenge={canChallenge} modelProfileId={modelProfileId} submit={submit}
      selectReport={id => { sourceGeneration.current++; setSelected(id); setSource(null); setError(''); }} />
  </section>;
}
