import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Answers, AnswerAttempt } from '../../loredock/src/answers';
import type { AnswerContext } from '../../loredock/src/answer-context';
import { api } from './api';

type State = ReturnType<Answers['state']>;
export function AnswerPanel({ buildId, boundary, openEvidence }: { buildId: string; boundary: string; openEvidence(id: string): void }) {
  const [state, setState] = useState<State>();
  const [question, setQuestion] = useState('');
  const [preview, setPreview] = useState<{ boundary: string; context: AnswerContext }>();
  const [selected, setSelected] = useState('');
  const [answer, setAnswer] = useState<{ boundary: string; attempt: AnswerAttempt }>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [executable, setExecutable] = useState<string | null>(null), [configHome, setConfigHome] = useState<string | null>(null), [profile, setProfile] = useState<string | null>(null);
  const request = useRef<{ requestId: string; question: string; buildId: string; inputHash: string } | undefined>(undefined);
  const currentBoundary = useRef(boundary); currentBoundary.current = boundary;
  useEffect(() => {
    let stopped = false;
    const refresh = async () => { try { const next = await api<State>('/answers'); if (!stopped) setState(next); } catch (cause) { if (!stopped) setError((cause as Error).message); } };
    void refresh(); const timer = setInterval(() => { void refresh(); }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);
  useEffect(() => { request.current = undefined; setPreview(undefined); }, [boundary]);
  const answerId = selected || state?.publishedAnswerId || '';
  const answerStatus = state?.attempts.find(attempt => attempt.id === answerId)?.status;
  useEffect(() => {
    let stopped = false;
    if (!answerId) { setAnswer(undefined); return; }
    void api<AnswerAttempt>(`/answers/${answerId}`).then(attempt => { if (!stopped) setAnswer({ boundary, attempt }); }).catch(cause => { if (!stopped) setError((cause as Error).message); });
    return () => { stopped = true; };
  }, [answerId, answerStatus, boundary]);
  const context = preview?.boundary === boundary ? preview.context : undefined;
  const displayed = answer?.boundary === boundary ? answer.attempt : undefined;
  const active = state?.attempts.find(attempt => ['preparing', 'running'].includes(attempt.status));
  const last = state?.attempts[0];
  async function action(fn: () => Promise<void>) {
    if (busy) return; setBusy(true); setError('');
    try { await fn(); setState(await api<State>('/answers')); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  function prepare(event: FormEvent) {
    event.preventDefault(); void action(async () => {
      const expected = currentBoundary.current;
      const context = await api<AnswerContext>('/answers/preview', 'POST', { question, buildId });
      if (expected === currentBoundary.current) setPreview({ boundary: expected, context });
    });
  }
  function generate() { void action(async () => {
    if (!context) return;
    request.current ??= { requestId: crypto.randomUUID(), question: context.question, buildId: context.buildId, inputHash: context.inputHash };
    await api('/answers', 'POST', request.current); request.current = undefined; setSelected('');
  }); }
  return <section className="panel answer-panel">
    <h2>Ask about your system</h2>
    <p className="muted">First review the context found for your question. Generating an answer sends that text through your selected Codex connection.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <details open={state ? !state.connection : false}><summary>Codex setup {state?.connection ? '· saved' : '· required for answers'}</summary>
      <p>Use a configuration signed into the intended personal or work account. LoreDock does not verify account identity or copy credentials.</p>
      <form onSubmit={event => { event.preventDefault(); void action(async () => { await api('/answers/configuration', 'PUT', { executable: executable ?? state?.connection?.executable, configHome: configHome ?? state?.connection?.configHome, profile: (profile ?? state?.connection?.profile) || null }); }); }}>
        <label htmlFor="answer-home">Configuration directory</label><input id="answer-home" value={configHome ?? state?.connection?.configHome ?? ''} onChange={event => setConfigHome(event.target.value)} placeholder="/home/you/.codex-personal" required />
        <label htmlFor="answer-executable">Codex executable</label><input id="answer-executable" value={executable ?? state?.connection?.executable ?? ''} onChange={event => setExecutable(event.target.value)} placeholder="/absolute/path/to/codex" required />
        <label htmlFor="answer-profile">Named CLI profile (optional)</label><input id="answer-profile" value={profile ?? state?.connection?.profile ?? ''} onChange={event => setProfile(event.target.value)} />
        <p className="muted">Pilot runtime: Codex 0.159.2 · gpt-5.6-terra · medium. No shell, network tools or delegation.</p>
        <button disabled={busy || Boolean(active)}>Save Codex setup</button>
      </form>
    </details>
    <form onSubmit={prepare}>
      <label htmlFor="project-question">Your question</label><textarea id="project-question" value={question} maxLength={2000} rows={3} placeholder="How does an order reach the database?" onChange={event => { setQuestion(event.target.value); setPreview(undefined); request.current = undefined; }} required disabled={busy || Boolean(active)} />
      <button disabled={busy || Boolean(active) || !buildId || !question.trim()}>Find context</button>
    </form>
    {context && <div className="question-context">
      <p role="status">{context.spans.length} source passages · {context.textBytes.toLocaleString()} UTF-8 bytes · deployment environment unknown</p>
      <details><summary>Context, coverage and gaps</summary><p>{context.coverage.indexed} files indexed · {context.coverage.excluded} excluded · {context.coverage.failed} failed</p>
        <ul>{context.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        <ul>{context.spans.map(span => <li key={span.id}><button className="quiet" onClick={() => openEvidence(span.id)}>{span.sourceName} / {span.path}:{span.startLine}–{span.endLine}</button></li>)}</ul>
      </details>
      <p className="muted">One attempt, up to two minutes. Failed or cancelled attempts keep the last successful answer. A retry is a new request and can consume more usage.</p>
      <button className="primary" disabled={busy || Boolean(active) || !state?.connection} onClick={generate}>Generate answer</button>
    </div>}
    {active && <div className="progress" role="status"><strong>{active.status === 'preparing' ? 'Checking Codex setup…' : 'Generating answer…'}</strong>
      <button disabled={busy} onClick={() => void action(async () => { await api(`/answers/${active.id}/cancel`, 'POST'); })}>Cancel answer</button></div>}
    {last && ['failed', 'cancelled', 'interrupted', 'fenced'].includes(last.status) && <p className="notice" role="status">Latest attempt: {last.status}. {last.reason} The last authorized successful answer stays available below.</p>}
    {!!state?.attempts.length && <label className="history">Answer history<select aria-label="Answer history" value={selected} onChange={event => setSelected(event.target.value)}>
      <option value="">Latest successful answer</option>{state.attempts.map(attempt => <option key={attempt.id} value={attempt.id}>{attempt.status} · {attempt.question.slice(0, 60)} · {attempt.id.slice(0, 8)}</option>)}
    </select></label>}
    {displayed && <article className="answer-result">
      <h3>{displayed.question}</h3>
      <p className="muted">Saved answer · index {displayed.buildId.slice(0, 8)}{displayed.buildId !== buildId ? ' · different from the selected index' : ''}</p>
      {displayed.stale && <p className="notice">A newer index or source registry is available. Review this answer's saved sources before relying on it.</p>}
      {displayed.reason && <p className="notice">{displayed.reason}</p>}
      {displayed.answer?.claims.map((claim, index) => <div className={`claim ${claim.kind}`} key={index}>
        <strong>{claim.kind === 'conflict' ? 'Conflicting sources' : claim.kind === 'inference' ? 'Inference' : 'Source-backed statement'}</strong><p>{claim.text}</p>
        <div className="citations">{claim.evidenceIds.map(id => { const span = displayed.context?.spans.find(span => span.id === id); return <button className="quiet" key={id} onClick={() => openEvidence(id)}>{span ? `${span.sourceName} / ${span.path}:${span.startLine}–${span.endLine}` : 'Open source'}</button>; })}</div>
      </div>)}
      {!!displayed.answer?.unknowns.length && <div className="notice"><h4>What remains unknown</h4><ul>{displayed.answer.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul></div>}
      <details><summary>Attempt details</summary><p>{displayed.model} · {displayed.effort} · {displayed.runtime?.version ?? 'Runtime not dispatched'}</p>
        <p>{displayed.usage ? `${displayed.usage.inputTokens} input tokens · ${displayed.usage.outputTokens} output tokens` : displayed.usageUnknownReason ?? 'Usage unknown'}</p>
        <p>Claims are model-generated and have not been human-approved. Citations resolve mechanically; verify their semantic support.</p>
      </details>
    </article>}
  </section>;
}
