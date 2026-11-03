import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const weight = value => Number.isFinite(value) && value >= 0;
const location = frame => ({ url: frame.url, functionName: frame.functionName, lineNumber: frame.lineNumber, columnNumber: frame.columnNumber });
function applicationFrame(frame, root) {
  let file;
  try { file = frame.url.startsWith('file:') ? fileURLToPath(frame.url) : frame.url; } catch { return false; }
  if (!path.isAbsolute(file)) return false;
  const relative = path.relative(root, file);
  return ['apps' + path.sep, 'packages' + path.sep, 'scripts' + path.sep].some(prefix => relative.startsWith(prefix));
}

// Disjoint node weights only; raw tree retains ancestor stacks and unranked locations.
export function summarizeProfile(profile, limits, root) {
  assert.ok(profile && typeof profile === 'object' && Array.isArray(profile.samples), 'Missing allocation profile.');
  assert.ok(profile.samples.length <= limits.samples, 'Profile sample bound exceeded.');
  const nodes = new Map(), frames = new Map(), owners = new Map(), ordinals = new Set();
  const pending = [{ node: profile.head, depth: 0, owner: null }];
  let totalSelfBytes = 0, unattributedSelfBytes = 0, sampleBytes = 0, mappedSampleBytes = 0, unmappedSampleBytes = 0, unmappedSamples = 0;
  function add(map, frame, bytes) {
    const key = JSON.stringify(frame), previous = map.get(key);
    if (previous) { previous.selfBytes += bytes; previous.nodes++; }
    else map.set(key, { frame, selfBytes: bytes, nodes: 1 });
  }
  while (pending.length) {
    const { node, depth, owner } = pending.pop();
    assert.ok(depth <= limits.depth && node && integer(node.id) && !nodes.has(node.id), 'Invalid profile tree identity/depth.');
    assert.ok(nodes.size < limits.treeNodes && Array.isArray(node.children)
      && node.children.length <= limits.treeNodes - nodes.size - 1, 'Profile node bound exceeded.');
    assert.ok(weight(node.selfSize), 'Invalid node allocation weight.');
    const frame = node.callFrame;
    assert.ok(frame && typeof frame.url === 'string' && typeof frame.functionName === 'string'
      && typeof frame.scriptId === 'string' && integer(frame.lineNumber, -1) && integer(frame.columnNumber, -1), 'Invalid allocation frame.');
    const current = applicationFrame(frame, root) ? location(frame) : owner;
    nodes.set(node.id, node); totalSelfBytes += node.selfSize;
    add(frames, location(frame), node.selfSize);
    if (current) add(owners, current, node.selfSize); else unattributedSelfBytes += node.selfSize;
    for (const child of node.children) pending.push({ node: child, depth: depth + 1, owner: current });
    assert.ok(pending.length + nodes.size <= limits.treeNodes, 'Profile node bound exceeded.');
  }
  for (const sample of profile.samples) {
    assert.ok(sample && weight(sample.size) && integer(sample.nodeId)
      && integer(sample.ordinal) && !ordinals.has(sample.ordinal), 'Invalid allocation sample reference/ordinal.');
    ordinals.add(sample.ordinal); sampleBytes += sample.size;
    if (nodes.has(sample.nodeId)) mappedSampleBytes += sample.size;
    else {
      assert.equal(limits.allowUnmappedSamples, true, 'Unmapped allocation sample.');
      unmappedSamples++; unmappedSampleBytes += sample.size;
    }
  }
  assert.ok(weight(totalSelfBytes) && weight(sampleBytes));
  const rank = (map, count) => {
    const rows = [...map.values()].sort((a, b) => b.selfBytes - a.selfBytes || JSON.stringify(a.frame).localeCompare(JSON.stringify(b.frame)));
    return { groups: rows.length, top: rows.slice(0, count),
      otherSelfBytes: rows.slice(count).reduce((sum, row) => sum + row.selfBytes, 0) };
  };
  const summary = { schemaVersion: 'loredock-allocation-summary/2', nodes: nodes.size, samples: profile.samples.length,
    sampleReferenceStatus: unmappedSamples ? 'partial-unmapped-samples' : 'complete',
    totalSelfBytes, sampleBytes, mappedSampleBytes, unmappedSampleBytes, unmappedSamples, unattributedSelfBytes,
    frames: rank(frames, Math.ceil(limits.summaryFrames / 2)),
    nearestApplicationCallers: rank(owners, Math.floor(limits.summaryFrames / 2)),
    interpretation: 'Sampled weights include collected objects and backend GC/export effects. Unmapped samples have no assigned owner. Not exact live bytes, native RSS or resource acceptance.' };
  assert.ok(Buffer.byteLength(JSON.stringify(profile)) <= limits.validationBytes, 'Raw profile validation byte bound exceeded.');
  assert.ok(Buffer.byteLength(JSON.stringify(summary)) <= limits.summaryBytes, 'Profile summary byte bound exceeded.');
  return summary;
}
