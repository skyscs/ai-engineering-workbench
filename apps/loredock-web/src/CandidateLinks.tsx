import type { CandidateLinkContext } from '../../loredock/src/candidate-links';

export function CandidateLinks({ value, openEvidence }: { value: CandidateLinkContext; openEvidence(id: string): void }) {
  return <details className="candidate-links" aria-label="Related repositories">
    <summary>Related repositories to inspect · {value.sources.length}</summary>
    <p className="muted">Direct code or declaration clues from the primary suggestions · unverified. These may broaden your reading scope.</p>
    {!value.sources.length && <p>No supported direct link was found in this bounded analysis. Other repositories may still be relevant.</p>}
    {value.sources.map(source => <article className="source-candidate" key={source.sourceId} data-source-id={source.sourceId}>
      <h4>{source.sourceName}</h4><p className="muted">Saved revision {source.revision.slice(0, 8)}</p>
      {source.links.map(link => <div className="candidate-link" key={link.id}>
        <p><strong>{link.kind.replaceAll('-', ' ')} · {link.status}</strong>{link.environment ? ` · ${link.environment}` : ' · deployment scope unknown'}</p>
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
    </article>)}
    <details><summary>Relationship coverage and limits</summary>
      <p>{value.eligibleSources} additional sources and {value.eligibleLinks} relationships met the anchoring rules. {value.omittedSources} sources and {value.omittedLinks} relationships were omitted by the reading limits.</p>
      <p>At most {value.limits.sources} repositories and {value.limits.linksPerSource} relationships per repository. No second-hop expansion.</p>
      {Object.entries(value.projections).map(([name, projection]) => <div key={name}>
        <p>{name}: {projection.coverage.examinedDocuments}/{projection.coverage.candidateDocuments} candidate documents examined · {projection.version}</p>
        {Object.entries(projection.omissions).map(([reason, count]) => <p key={reason}>{reason}: {count}</p>)}
      </div>)}
      <ul>{value.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
    </details>
  </details>;
}
