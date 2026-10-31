import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, symlink, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLoreDockFixture, digest, repositoryIds } from './loredock-fixture.mjs';
import { additionalRepositories } from '../fixtures/loredock-scale/corpus.mjs';
import { scaleQuestions } from '../fixtures/loredock-scale/oracle.mjs';

export const scaleRepositoryIds = [...repositoryIds, ...Object.keys(additionalRepositories)];
export function scaleGit(root, id, args, trim = true) {
  if (!scaleRepositoryIds.includes(id)) throw new Error('Unknown scale-fixture repository.');
  const output = execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'user.name=LoreDock Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], {
    cwd: path.join(root, 'sources', id), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C', GIT_AUTHOR_DATE: '2026-02-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-02-01T00:00:00Z' },
  });
  return trim ? output.trimEnd() : output;
}

export async function createScaleFixture() {
  const pilot = await createLoreDockFixture(), { root } = pilot;
  try {
    const sources = pilot.manifest.sources.map(source => ({ ...source, role: ({ portal: 'Order user interfaces', 'order-api': 'Order acceptance and publication', 'order-worker': 'Order projection consumer' })[source.id] }));
    const evidence = [...pilot.manifest.evidence];
    const allowedPaths = { ...pilot.manifest.policy.allowedPaths };
    for (const [id, spec] of Object.entries(additionalRepositories)) {
      const directory = path.join(root, 'sources', id); await mkdir(directory);
      scaleGit(root, id, ['init', '--quiet', '--object-format=sha1', '--initial-branch=main', `--template=${path.join(root, 'empty-template')}`]);
      for (const [relativePath, text] of Object.entries(spec.files)) {
        const target = path.join(directory, relativePath); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text);
      }
      await writeFile(path.join(directory, '.env'), 'SYNTHETIC_EXCLUDED_VALUE=not-a-credential\n');
      await writeFile(path.join(directory, 'opaque.bin'), Buffer.from([0, 255, 0, 1]));
      await symlink('../../outside/canary.txt', path.join(directory, 'outside-link'));
      scaleGit(root, id, ['add', '--all']); scaleGit(root, id, ['commit', '--quiet', '-m', 'Add synthetic scale-system sources']);
      const revision = scaleGit(root, id, ['rev-parse', 'HEAD']);
      sources.push({ id, role: spec.role, kind: 'git', revision, objectFormat: 'sha1', refLabel: 'main',
        excluded: [{ path: '.env', reason: 'policy' }, { path: 'opaque.bin', reason: 'binary' }, { path: 'outside-link', reason: 'symlink' }] });
      allowedPaths[id] = Object.keys(spec.files);
      for (const [relativePath, text] of Object.entries(spec.files)) evidence.push({
        id: `${id}/${relativePath}`, sourceId: id, revision, path: relativePath,
        blobId: scaleGit(root, id, ['rev-parse', `${revision}:${relativePath}`]),
        startLine: 1, endLine: text.trimEnd().split('\n').length, contentHash: digest(text),
      });
    }
    const manifest = { schemaVersion: 'loredock-scale-fixture/1', projectId: 'synthetic-commerce-context',
      environment: 'mixed-declarations', deploymentCoherence: 'unknown', sources,
      revisionVector: Object.fromEntries(sources.map(source => [source.id, source.revision])),
      policy: { ...pilot.manifest.policy, version: 'scale-fixture-policy/1', allowedPaths },
      coverage: { eligibleFiles: evidence.length, excludedFiles: sources.length * 3, extractedFiles: 0,
        reason: 'Fixture generation is not production ingestion.' }, evidence };
    const oracle = { schemaVersion: 'loredock-scale-oracle/1', questions: scaleQuestions };
    // Preserve the original oracle; never treat its small-system answers as expanded-system truth.
    await rename(path.join(root, 'manifest.json'), path.join(root, 'pilot-manifest.json'));
    await rename(path.join(root, 'oracle.json'), path.join(root, 'pilot-oracle.json'));
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(path.join(root, 'oracle.json'), JSON.stringify(oracle, null, 2) + '\n');
    return { root, manifest, oracle, pilotManifest: pilot.manifest, pilotOracle: pilot.oracle };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}

export function scaleBaseline(fixture) {
  return { schemaVersion: 'loredock-scale-baseline/1', sourceCount: fixture.manifest.sources.length,
    eligibleFiles: fixture.manifest.evidence.length, revisionVector: fixture.manifest.revisionVector,
    manifestHash: digest(JSON.stringify(fixture.manifest)), oracleHash: digest(JSON.stringify(fixture.oracle)) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const fixture = await createScaleFixture();
  console.log(JSON.stringify({ root: fixture.root, baseline: scaleBaseline(fixture) }, null, 2));
}
