import type { CandidateLink, CandidateLinkContext } from '../../loredock/src/candidate-links';

const linkLabels: Record<CandidateLink['kind'], string> = {
  'http-target': 'HTTP route clue', 'event-delivery': 'Event delivery clue',
  'contract-match': 'Matching contract declarations', 'contract-difference': 'Different contract declarations',
  'setting-match': 'Matching setting declarations', 'setting-difference': 'Different setting declarations',
};
const subject = (link: CandidateLink) => [...new Set([link.from.label, link.to.label])].join(link.origin === 'code' ? ' → ' : ' ↔ ');
function linkSummaries(links: CandidateLink[]) {
  const groups = new Map<string, Set<string>>();
  for (const link of links) {
    const label = linkLabels[link.kind], subjects = groups.get(label) ?? new Set<string>();
    subjects.add(subject(link)); groups.set(label, subjects);
  }
  return [...groups].map(([label, subjects]) => `${label} · ${[...subjects].join(', ')}`);
}

export function CandidateLinks({ value, busy, openEvidence, changePage }: {
  value: CandidateLinkContext; busy: boolean; openEvidence(id: string): void; changePage(offset: number): void;
}) {
  return <details className="candidate-links" aria-label="Related repositories" data-related-offset={value.page.offset}>
    <summary>Related repositories to inspect · {value.eligibleSources}</summary>
    <p className="muted">Direct code or declaration clues from the primary suggestions · unverified. These may broaden your reading scope.</p>
    {!value.sources.length && <p>No supported direct link was found in this bounded analysis. Other repositories may still be relevant.</p>}
    {value.sources.length > 0 && <p role="status">{busy ? 'Loading repositories…' : `Showing ${value.page.offset + 1}–${value.page.offset + value.sources.length} of ${value.page.total} related repositories.`}</p>}
    {value.page.total > value.page.limit && <nav className="related-pages" aria-label="Related repository pages">
      <button className="quiet" disabled={busy || value.page.previousOffset === null} onClick={() => changePage(value.page.previousOffset!)}>Previous repositories</button>
      <button className="quiet" disabled={busy || value.page.nextOffset === null} onClick={() => changePage(value.page.nextOffset!)}>Next repositories</button>
    </nav>}
    {value.sources.map(source => <details className="source-candidate related-source" key={source.sourceId} data-source-id={source.sourceId}>
      <summary>
        <strong className="related-source-name">{source.sourceName}</strong>
        <span className="related-source-count muted">{source.links.length} {source.links.length === 1 ? 'clue' : 'clues'} shown · unverified</span>
        {linkSummaries(source.links).map(summary => <span className="related-source-subject" key={summary}>{summary}</span>)}
      </summary>
      <p className="muted">Saved revision {source.revision.slice(0, 8)}</p>
      {source.links.map(link => <div className="candidate-link" key={link.id}>
        <p><strong>{linkLabels[link.kind]} · {link.status}</strong>{link.environment ? ` · ${link.environment}` : ' · deployment scope unknown'}</p>
        <p>{link.reason}</p>
        <p>{link.from.sourceName}: {link.from.label} {link.origin === 'code' ? '→' : '↔'} {link.to.sourceName}: {link.to.label}</p>
        {[link.from, link.to].map((endpoint, index) => <div className="candidate-support" key={index}>
          <p>{link.origin === 'declaration' ? index === 0 ? 'Side A' : 'Side B' : index === 0 ? 'From' : 'To'}: {endpoint.sourceName}</p>
          {endpoint.evidenceIds.map(id => { const ref = link.evidence.find(ref => ref.id === id)!;
            return <button className="quiet" key={id} onClick={() => openEvidence(id)}>{ref.path}:{ref.startLine}–{ref.endLine}</button>; })}
        </div>)}
        {link.evidence.filter(ref => !link.from.evidenceIds.includes(ref.id) && !link.to.evidenceIds.includes(ref.id)).map(ref =>
          <button className="quiet" key={ref.id} onClick={() => openEvidence(ref.id)}>Supporting declaration: {ref.sourceName}/{ref.path}:{ref.startLine}–{ref.endLine}</button>)}
        {!!link.gaps.length && <ul>{link.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>}
      </div>)}
      {source.omittedLinks > 0 && <p className="muted">{source.omittedLinks} additional relationships are outside this reading sample.</p>}
    </details>)}
    <details><summary>Relationship coverage and limits</summary>
      <p>{value.eligibleSources} additional sources and {value.eligibleLinks} relationships met the anchoring rules. {value.omittedSources} sources are outside this page; {value.omittedLinks} relationships are outside this page or its per-source reading sample.</p>
      <p>At most {value.limits.sources} repositories per page and {value.limits.linksPerSource} relationships per repository. Pages preserve saved source order. No second-hop expansion.</p>
      {Object.entries(value.projections).map(([name, projection]) => <div key={name}>
        <p>{name}: {projection.coverage.examinedDocuments}/{projection.coverage.candidateDocuments} candidate documents examined · {projection.version}</p>
        {Object.entries(projection.omissions).map(([reason, count]) => <p key={reason}>{reason}: {count}</p>)}
      </div>)}
      <ul>{value.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
    </details>
  </details>;
}
