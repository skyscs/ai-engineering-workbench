import { useEffect, useRef, useState } from 'react';
import type { ProjectOrientation } from '../../loredock/src/orientation-types';
import { api } from './api';

export function ProjectOverview({ buildId, boundary, openEvidence }: { buildId: string; boundary: string; openEvidence(id: string): void }) {
  const key = `${boundary}:${buildId}`;
  const [result, setResult] = useState<{ key: string; value: ProjectOrientation }>(), [error, setError] = useState<{ key: string; text: string }>();
  const [reload, setReload] = useState(0), [notice, setNotice] = useState<{ key: string; text: string }>();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let stopped = false;
    if (!buildId) return;
    void api<ProjectOrientation>(`/orientation?buildId=${encodeURIComponent(buildId)}`).then(value => {
      if (!stopped) { setResult({ key, value }); setError(undefined); }
    }).catch(cause => { if (!stopped) setError({ key, text: (cause as Error).message }); });
    return () => { stopped = true; };
  }, [buildId, key, reload]);
  const value = result?.key === key ? result.value : undefined;
  function navigate(step: 'context' | 'map' | 'flow' | 'gaps') {
    const element = step === 'context' ? root.current?.querySelector<HTMLElement>('.orientation-card h3')
      : step === 'gaps' ? root.current?.querySelector<HTMLElement>('.orientation-coverage > summary')
      : document.querySelector<HTMLElement>(step === 'map' ? '.system-map h2' : '.code-flows .flow-card > summary');
    if (!element) {
      setNotice({ key, text: step === 'flow' ? 'No flow outline is available yet. It may still be loading or outside supported source coverage. Read the source context and gaps, then try again.'
        : 'This view is unavailable for the selected index. Read the source context and gaps, then try again.' }); return;
    }
    let parent = element.parentElement;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    element.tabIndex = -1; element.focus({ preventScroll: true }); element.scrollIntoView({ block: 'start' }); setNotice(undefined);
  }
  if (!buildId) return null;
  return <section className="panel project-overview" ref={root} data-build-id={value?.buildId} aria-label="Project overview">
    <h2>Project overview</h2>
    {error?.key === key ? <div className="error" role="alert"><p>Project orientation is unavailable: {error.text}</p>
      <button className="quiet" onClick={() => setReload(current => current + 1)}>Retry project overview</button></div> : !value ? <p role="status">Reading repository context…</p> : <>
      <p className="overview-intro">Start with what each repository documents, then compare interfaces and follow a source path.</p>
      <p role="status">README context for {value.coverage.withContext} of {value.coverage.repositories} repositories</p>
      <p className="muted">Original README excerpts · documented intent, unverified. Text may be outdated or disagree with code/configuration. Deployment coherence is unknown.</p>
      {value.stale && <p className="notice">This overview uses an older index or source registry. Its text stays pinned to that index; removed sources are excluded.</p>}
      {value.unindexedSources.length > 0 && <div className="notice"><strong>Repositories outside this index</strong>
        <ul>{value.unindexedSources.map(source => <li key={source.sourceId}>{source.sourceName} · not indexed in this snapshot</li>)}</ul>
        <p>Update knowledge to include their content.</p></div>}
      <details className="reading-guide" key={key}><summary>Guide me</summary>
        <p>A short reading route through this saved index. Each view remains partial; source text and engineer review labels stay visible.</p>
        <ol>
          <li><strong>Read repository context</strong><p>Open README evidence before treating its description as the current behavior.</p>
            <button className="quiet" onClick={() => navigate('context')}>Read repository context</button></li>
          <li><strong>Compare declared interfaces</strong><p>Inspect route, contract and configuration clues. Similar names do not establish ownership or deployment.</p>
            <button className="quiet" onClick={() => navigate('map')}>Explore system map</button></li>
          <li><strong>Follow a partial source path</strong><p>Open one supported flow outline, its original evidence, candidate hops and any engineer corrections.</p>
            <button className="quiet" onClick={() => navigate('flow')}>Follow first flow</button></li>
          <li><strong>Check missing context</strong><p>Review exclusions, missing documentation and repositories outside this index before drawing conclusions.</p>
            <button className="quiet" onClick={() => navigate('gaps')}>Review sources and gaps</button></li>
        </ol>
        {notice?.key === key && <p className="notice" role="status">{notice.text}</p>}
      </details>
      <div className="orientation-cards">{value.sources.map(source => <article className={`orientation-card${source.context ? '' : ' orientation-gap'}`} key={source.sourceId} data-source-id={source.sourceId}>
        <h3>{source.sourceName}</h3><p className="muted">Saved revision {source.revision?.slice(0, 8) ?? 'unavailable'} · {source.sourceStatus}</p>
        {source.context ? <><blockquote className="readme-context">{source.context.text}</blockquote>
          <p className="muted">{source.readme.path} · lines {source.context.startLine}–{source.context.endLine}{source.context.truncated ? ' · excerpt limited' : ''}</p>
          <div className="orientation-citations">{source.context.evidenceIds.map((id, index) => <button className="quiet" key={id} onClick={() => openEvidence(id)}>
            Open README evidence{source.context!.evidenceIds.length > 1 ? ` ${index + 1}` : ''}</button>)}</div>
        </> : <div className="notice"><strong>README context unavailable</strong><p>{source.readme.reason}</p></div>}
        {(source.sections?.length > 0 || source.omittedSections > 0) && <details className="readme-sections" key={`${key}:sections`}><summary>Browse README sections</summary>
          <p className="muted">Original headings, not verified system knowledge. Some heading styles may be absent; the full README remains available below.</p>
          <ol>{source.sections.map(section => <li key={section.startLine}>
            <strong>{section.title}</strong><p className="muted">Lines {section.startLine}–{section.endLine}</p>
            <div className="readme-section-links">{section.evidenceIds.map((id, index) => <button className="quiet" key={id}
              aria-label={`Read ${section.title}, original part ${index + 1}`} onClick={() => openEvidence(id)}>
              Read section{section.evidenceIds.length > 1 ? ` part ${index + 1}` : ''}</button>)}</div>
          </li>)}</ol>
          {source.omittedSections > 0 && <p className="notice">{source.omittedSections} additional headings are not listed. Open the full README for complete context.</p>}
        </details>}
        {(source.linkedDocuments?.length > 0 || source.omittedLinkedDocuments > 0) && <details className="linked-reading" key={`${key}:linked-reading`}>
          <summary>Documentation linked from README</summary>
          <p className="muted">Read saved documents referenced by this README. Link labels express documented intent; fragments open the full file.</p>
          <ul>{source.linkedDocuments.map(document => <li key={document.path}>
            <strong>{document.label}</strong><code>{document.path}</code>
            <div className="readme-section-links">{document.evidenceIds.map((id, index) => <button className="quiet" key={id}
              aria-label={`Read ${document.path}, original part ${index + 1}`} onClick={() => openEvidence(id)}>
              Read document{document.evidenceIds.length > 1 ? ` part ${index + 1}` : ''}</button>)}</div>
            {document.state !== 'available' && <p className="notice">{document.reason}</p>}
            <div className="readme-section-links">{document.readmeEvidenceIds.map(id => <button className="quiet" key={id}
              aria-label={`Read README link to ${document.path}`} onClick={() => openEvidence(id)}>Read README link · line {document.line}</button>)}</div>
          </li>)}</ul>
          {source.omittedLinkedDocuments > 0 && <p className="notice">{source.omittedLinkedDocuments} additional local documentation links are not listed.</p>}
          <p className="muted">Up to {value.limits.linkedDocuments} distinct local documents per README. Some link styles are unsupported; the complete README remains available below.</p>
        </details>}
        {source.reading.length > 0 && <details className="orientation-reading"><summary>More source reading</summary>
          {source.reading.map(document => <div key={document.path}><strong>{document.path}</strong>
            {document.evidenceIds.map((id, index) => <button className="quiet" key={id} onClick={() => openEvidence(id)}>Open {document.kind === 'readme' ? 'README' : 'manifest'} part {index + 1}</button>)}
          </div>)}
        </details>}
      </article>)}</div>
      {!value.sources.length && <p>No authorized repositories remain in this index. Add and index sources to build new context.</p>}
      <details className="orientation-coverage"><summary>Overview coverage and gaps</summary>
        <p>Selected index {value.buildId.slice(0, 8)} · {value.coverage.examinedDocuments} documents read · {value.coverage.parsedBytes.toLocaleString()} original source bytes</p>
        {value.sources.map(source => <div key={source.sourceId}><strong>{source.sourceName}</strong>
          <p>{source.coverage.indexed} indexed · {source.coverage.excluded} excluded · {source.coverage.failed} failed · {source.omittedInventory} omitted by inventory limit</p>
          {!source.context && <p>{source.readme.reason}</p>}
          <ul>{source.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
        </div>)}
        <ul>{value.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        <ul>{Object.entries(value.omissions).map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul>
        <p>At most {value.limits.documents} README, manifest and linked documents, {value.limits.fileBytes / 1024} KiB each, {value.limits.textBytes / 1024} KiB source input,
          {' '}{value.limits.fileSpans} spans per file, {value.limits.excerptLines} lines / {value.limits.excerptBytes} UTF-8 bytes per excerpt and {value.limits.outputBytes / 1024} KiB output.</p>
        <p>Section navigation lists up to {value.limits.sections} Markdown-style # headings per README, with labels up to {value.limits.headingBytes} UTF-8 bytes. This is not a complete document outline.</p>
        <p>Linked reading uses remaining capacity after all root READMEs and manifests, in rounds across repositories. Labels are limited to {value.limits.linkLabelBytes} UTF-8 bytes and local paths to {value.limits.linkPathBytes} bytes.</p>
        <p className="muted">{value.adapterVersion} · no model calls · no setup commands executed</p>
      </details>
    </>}
  </section>;
}
