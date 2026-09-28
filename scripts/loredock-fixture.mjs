import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evidenceFiles, questions, routingCases } from '../fixtures/loredock/oracle.mjs';

const templates = fileURLToPath(new URL('../fixtures/loredock/repos/', import.meta.url));
export const repositoryIds = ['portal', 'order-api', 'order-worker'];
export const digest = value => createHash('sha256').update(value).digest('hex');

export function fixtureGit(root, repositoryId, args, trimOutput = true) {
  if (!repositoryIds.includes(repositoryId)) throw new Error('Unknown fixture repository');
  const output = execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'user.name=LoreDock Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], {
    cwd: path.join(root, 'sources', repositoryId), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' },
  });
  return trimOutput ? output.trimEnd() : output;
}

export async function createLoreDockFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-fixture-'));
  try {
    const evidence = [];
    const sources = [];
    for (const id of repositoryIds) {
      const directory = path.join(root, 'sources', id);
      await mkdir(directory, { recursive: true });
      // An empty template avoids machine-specific Git templates and hooks.
      await mkdir(path.join(root, 'empty-template'), { recursive: true });
      fixtureGit(root, id, ['init', '--quiet', '--object-format=sha1', '--initial-branch=main', `--template=${path.join(root, 'empty-template')}`]);
      for (const [repositoryId, relativePath] of Object.values(evidenceFiles)) {
        if (repositoryId !== id) continue;
        const target = path.join(directory, relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, await readFile(path.join(templates, id, relativePath)));
      }
      // All canaries are artificial. They test coverage/exclusion handling in L1.
      await writeFile(path.join(directory, '.env'), 'SYNTHETIC_EXCLUDED_VALUE=not-a-credential\n');
      await writeFile(path.join(directory, 'opaque.bin'), Buffer.from([0, 255, 0, 1]));
      await symlink('../../outside/canary.txt', path.join(directory, 'outside-link'));
      fixtureGit(root, id, ['add', '--all']);
      fixtureGit(root, id, ['commit', '--quiet', '-m', 'Add synthetic system sources']);
      const revision = fixtureGit(root, id, ['rev-parse', 'HEAD']);
      sources.push({ id, kind: 'git', revision, objectFormat: 'sha1', refLabel: 'main',
        excluded: [{ path: '.env', reason: 'policy' }, { path: 'opaque.bin', reason: 'binary' },
          { path: 'outside-link', reason: 'symlink' }] });
      for (const [key, [repositoryId, relativePath]] of Object.entries(evidenceFiles)) {
        if (repositoryId !== id) continue;
        const bytes = await readFile(path.join(directory, relativePath));
        evidence.push({ id: key, sourceId: id, revision, path: relativePath,
          blobId: fixtureGit(root, id, ['rev-parse', `${revision}:${relativePath}`]),
          startLine: 1, endLine: bytes.toString('utf8').trimEnd().split('\n').length,
          contentHash: digest(bytes) });
      }
    }
    await mkdir(path.join(root, 'outside'));
    await writeFile(path.join(root, 'outside', 'canary.txt'), 'SYNTHETIC_OUTSIDE_READ_CANARY\n');
    const manifest = { schemaVersion: 'loredock-fixture/1', projectId: 'synthetic-orders',
      environment: 'local', deploymentCoherence: 'unknown', sources,
      revisionVector: Object.fromEntries(sources.map(source => [source.id, source.revision])),
      policy: { version: 'fixture-policy/1', sourceMode: 'committed-only',
        modelExecution: 'disabled', executeSourceCommands: false, followSymlinks: false,
        allowedPaths: Object.fromEntries(repositoryIds.map(id => [id,
          Object.values(evidenceFiles).filter(([repo]) => repo === id).map(([, file]) => file)])) },
      coverage: { eligibleFiles: evidence.length, excludedFiles: sources.length * 3,
        extractedFiles: 0, reason: 'Fixture generation is not ingestion.' }, evidence };
    const oracle = { schemaVersion: 'loredock-oracle/1', questions, routingCases };
    // The oracle and manifest are deliberately outside every source repository.
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(path.join(root, 'oracle.json'), JSON.stringify(oracle, null, 2) + '\n');
    return { root, manifest, oracle };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export function validateFixtureAnswer(value, manifest) {
  const invalid = () => { throw new Error('Invalid fixture answer'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'claims,unknowns'
    || !Array.isArray(value.claims) || value.claims.length > 20
    || !Array.isArray(value.unknowns) || value.unknowns.length > 20) invalid();
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
  if (!value.unknowns.every(text) || (!value.claims.length && !value.unknowns.length)) invalid();
  const ids = new Set(manifest.evidence.map(span => span.id));
  for (const claim of value.claims) {
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)
      || Object.keys(claim).sort().join(',') !== 'evidence,text'
      || !text(claim.text) || !Array.isArray(claim.evidence) || !claim.evidence.length
      || claim.evidence.length > 20 || !claim.evidence.every(id => typeof id === 'string' && ids.has(id))) invalid();
  }
  // Locator/schema validity is not semantic grounding or instruction resistance.
  return value;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const fixture = await createLoreDockFixture();
  console.log(JSON.stringify({ root: fixture.root, manifest: fixture.manifest }, null, 2));
}
