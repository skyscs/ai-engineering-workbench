import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);

async function git(cwd, args) {
  return (await exec('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd })).stdout.trim();
}

async function commit(cwd, message) {
  await git(cwd, ['add', '.']);
  await git(cwd, ['-c', 'user.name=Workbench Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', message]);
}

export async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'aew-runtime-'));
  const client = path.join(root, 'client');
  const service = path.join(root, 'service');
  const artifacts = path.join(root, 'artifacts');
  await Promise.all([client, service, artifacts].map((directory) => mkdir(directory)));
  for (const directory of [client, service]) await git(directory, ['init', '--initial-branch=main']);
  await writeFile(path.join(client, 'request.mjs'),
    'export function requestOptions(config) {\n  return { timeoutMs: config.timeout };\n}\n');
  await commit(client, 'feat: consume service timeout in milliseconds');
  await writeFile(path.join(service, 'config.mjs'),
    'export const config = { timeout: 5000, timeoutUnit: "milliseconds" };\n');
  await commit(service, 'feat: publish timeout in milliseconds');
  await writeFile(path.join(service, 'config.mjs'),
    'export const config = { timeout: 5, timeoutUnit: "seconds" };\n');
  await commit(service, 'refactor: publish timeout in seconds');
  const artifact = path.join(artifacts, 'request.log');
  await writeFile(artifact, 'Expected request timeout: 5000ms\nObserved request timeout after configuration update: 5ms\n');
  const manifest = {
    root, client, service, artifact,
    clientSha: await git(client, ['rev-parse', 'HEAD']),
    serviceSha: await git(service, ['rev-parse', 'HEAD'])
  };
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(root, 'baseline.json'), JSON.stringify(await snapshot(manifest), null, 2));
  return manifest;
}

export async function snapshot(manifest) {
  const files = [path.join(manifest.client, 'request.mjs'), path.join(manifest.service, 'config.mjs'), manifest.artifact];
  const hashes = {};
  for (const file of files) hashes[path.relative(manifest.root, file)] = createHash('sha256').update(await readFile(file)).digest('hex');
  return {
    hashes,
    clientSha: await git(manifest.client, ['rev-parse', 'HEAD']),
    serviceSha: await git(manifest.service, ['rev-parse', 'HEAD']),
    clientStatus: await git(manifest.client, ['status', '--porcelain']),
    serviceStatus: await git(manifest.service, ['status', '--porcelain'])
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await createFixture(), null, 2));
}
