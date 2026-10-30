import { useEffect, useState } from 'react';
import type { DeclarationMap, MapNode } from '../../loredock/src/system-map-types';
import { api } from './api';

const kinds: Record<MapNode['kind'], string> = { repository: 'Repository', package: 'Package declaration',
  'http-route': 'HTTP route', 'handler-reference': 'Handler reference', 'event-contract': 'Event contract', setting: 'Configuration value' };

export function SystemMap({ buildId, boundary, openEvidence }: { buildId: string; boundary: string; openEvidence(id: string): void }) {
  const key = `${boundary}:${buildId}`;
  const [result, setResult] = useState<{ key: string; map: DeclarationMap }>();
  const [error, setError] = useState<{ key: string; text: string }>();
  useEffect(() => {
    let stopped = false;
    if (!buildId) return;
    void api<DeclarationMap>(`/system-map?buildId=${encodeURIComponent(buildId)}`).then(map => {
      if (!stopped) { setResult({ key, map }); setError(undefined); }
    }).catch(cause => { if (!stopped) { setResult(undefined); setError({ key, text: (cause as Error).message }); } });
    return () => { stopped = true; };
  }, [buildId, key]);
  const map = result?.key === key ? result.map : undefined;
  function citations(ids: string[]) {
    return <div className="citations">{ids.map(id => { const span = map?.evidence[id]; return span && <button className="quiet" key={id} onClick={() => openEvidence(id)}>{span.sourceName} / {span.path}:{span.startLine}–{span.endLine}</button>; })}</div>;
  }
  return <section className="panel system-map">
    <h2>System map</h2>
    <p className="muted">Explore declared interfaces, contracts and settings. This view uses saved source text and makes no model calls.</p>
    {!buildId ? <p>Index sources to see their declarations.</p> : error?.key === key ? <p className="error" role="alert">{error.text}</p> : !map ? <p role="status">Reading indexed declarations…</p> : <>
      <p role="status">{map.nodes.filter(node => node.kind === 'repository').length} repositories · {map.nodes.filter(node => node.kind !== 'repository').length} declarations · {map.edges.filter(edge => edge.status !== 'declared').length} cross-repository clues</p>
      <p className="notice">Partial map · deployment coherence unknown. Repository identity and matching declarations do not establish service ownership or runtime connections.</p>
      {map.stale && <p className="notice">This map uses an older index or source registry. Removed sources are excluded.</p>}
      <div className="map-repositories">{map.nodes.filter(node => node.kind === 'repository').map(repository => <details className="map-repository" key={repository.id}>
        <summary>{repository.label}</summary><p className="muted">Repository · {repository.properties.status} · revision {repository.revision?.slice(0, 8) ?? 'unavailable'}</p>
        <ul className="map-declarations">{map.nodes.filter(node => node.sourceId === repository.sourceId && node.kind !== 'repository').map(node => <li key={node.id}>
          <span className="tag">{kinds[node.kind]}</span><strong>{node.label}</strong>
          {node.kind === 'handler-reference' && <p className="muted">Implementation unresolved; this is a declared reference.</p>}
          {node.kind === 'setting' && <p>{node.properties.value} <span className="muted">· environment {node.environment ?? 'unspecified'}</span></p>}
          {node.kind === 'http-route' && <p>→ {map.nodes.find(target => map.edges.some(edge => edge.kind === 'routes-to' && edge.from === node.id && edge.to === target.id))?.label ?? 'Handler not included in this projection'}</p>}
          <details><summary>Declaration details</summary><dl>{Object.entries(node.properties).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>
          {citations(node.evidenceIds)}
        </li>)}</ul>
        {!map.nodes.some(node => node.sourceId === repository.sourceId && node.kind !== 'repository') && <p>No supported declarations in the bounded projection. Check source coverage and gaps.</p>}
      </details>)}</div>
      <h3>Cross-repository clues</h3>
      <p className="muted">Compare the original declarations before treating a match as a connection.</p>
      {map.edges.filter(edge => edge.status !== 'declared').map(edge => {
        const from = map.nodes.find(node => node.id === edge.from)!, to = map.nodes.find(node => node.id === edge.to)!;
        return <article className={`map-clue ${edge.status}`} key={edge.id}>
          <strong>{edge.status === 'candidate' ? 'Candidate match' : 'Different declarations'} · {edge.kind.startsWith('contract-') ? 'event contract' : 'configuration'}</strong>
          <p>{from.sourceName} / {from.label} ↔ {to.sourceName} / {to.label}</p>
          {edge.kind.startsWith('setting-') && <p>{from.properties.value} ↔ {to.properties.value} · environment {edge.environment ?? 'unspecified'}</p>}
          <p>{edge.reason}</p>{citations(edge.evidenceIds)}
        </article>;
      })}
      {!map.edges.some(edge => edge.status !== 'declared') && <p>No comparable cross-repository declarations in this projection. This does not establish absence of connections.</p>}
      <details className="map-coverage"><summary>Map coverage and gaps</summary>
        <p>{map.coverage.examinedDocuments} documents examined out of {map.coverage.candidateDocuments} candidate documents · {map.coverage.indexedFiles} indexed files · {map.coverage.parsedBytes.toLocaleString()} UTF-8 source bytes</p>
        <ul>{map.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        <ul>{Object.entries(map.omissions).map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul>
        <p>At most {map.limits.documents} documents, {map.limits.fileBytes / 1024} KiB per document, {map.limits.textBytes / 1024} KiB total, {map.limits.nodes} entities and {map.limits.edges} links.</p>
        <p className="muted">{map.adapterVersion} · saved index {map.buildId.slice(0, 8)}</p>
      </details>
    </>}
  </section>;
}
