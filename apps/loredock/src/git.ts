import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { devNull } from 'node:os';
import path from 'node:path';
import { CatalogError } from './types.js';

export interface RepositoryIdentity { path: string; gitDir: string }
export interface TreeEntry { path: string; mode: string; blob: string; size: number }
const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
export function safePath(value: string): boolean {
  return value.length > 0 && value.length <= 4096 && !/[\\\u0000-\u001f\u007f]/.test(value)
    && !path.posix.isAbsolute(value) && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
const decode = (buffer: Buffer) => new TextDecoder('utf-8', { fatal: true }).decode(buffer);

/** Byte-preserving, bounded reads only. Never call checkout, fetch, hooks or filters. */
export class SourceGit {
  constructor(private readonly timeoutMs = 15000) {}
  async run(cwd: string, args: string[], signal: AbortSignal, maxBytes = 4 * 1024 * 1024): Promise<Buffer> {
    if (signal.aborted) throw new CatalogError('CANCELLED', 'Indexing was cancelled.', 409);
    return new Promise((resolve, reject) => {
      const child = spawn('git', ['--no-replace-objects', '-c', `core.hooksPath=${devNull}`,
        '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
        cwd, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull,
          GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0',
          GIT_ALLOW_PROTOCOL: '', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C' },
      });
      const chunks: Buffer[] = []; let bytes = 0, stderr = '', failure: string | null = null;
      const stop = (reason: string) => {
        failure ??= reason;
        try { if (child.pid) { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); } }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') failure = 'Unable to stop Git.'; }
      };
      const abort = () => stop('Indexing was cancelled.');
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => stop('Git exceeded its execution deadline.'), this.timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > maxBytes) stop('Git output exceeded its byte limit.'); else chunks.push(chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(0, 2048); });
      child.on('error', () => { failure = 'Cannot start system Git.'; });
      child.on('close', (code, exitSignal) => {
        clearTimeout(timer); signal.removeEventListener('abort', abort);
        if (failure || code !== 0) {
          const diagnostic = stderr.replace(/(https?:\/\/)[^\s/]*@/gi, '$1[redacted]@')
            .replace(/((?:password|token|authorization)\s*[:=]\s*)[^\r\n]+/gi, '$1[redacted]');
          reject(new CatalogError('GIT_FAILED', `${failure ?? 'Git failed.'} Exit: ${code ?? exitSignal}. ${diagnostic}`.trim(), 422));
        } else resolve(Buffer.concat(chunks));
      });
      if (signal.aborted) abort();
    });
  }
  async identity(value: string, signal: AbortSignal): Promise<RepositoryIdentity> {
    if (!path.isAbsolute(value) || /[\u0000-\u001f\u007f]/.test(value)) throw new CatalogError('INVALID_PATH', 'Enter an absolute local repository path.');
    let directory: string;
    try { directory = await realpath(value); if (!(await stat(directory)).isDirectory()) throw new Error(); }
    catch { throw new CatalogError('SOURCE_UNAVAILABLE', 'The repository directory is unavailable.', 422); }
    const root = decode(await this.run(directory, ['rev-parse', '--show-toplevel'], signal)).trim();
    const gitDir = decode(await this.run(directory, ['rev-parse', '--path-format=absolute', '--git-common-dir'], signal)).trim();
    return { path: await realpath(root), gitDir: await realpath(gitDir) };
  }
  async snapshot(identity: RepositoryIdentity, signal: AbortSignal) {
    const actual = await this.identity(identity.path, signal);
    if (actual.path !== identity.path || actual.gitDir !== identity.gitDir) throw new CatalogError('SOURCE_CHANGED', 'The registered repository identity changed.', 409);
    const revision = decode(await this.run(identity.path, ['rev-parse', '--verify', '--end-of-options', 'HEAD^{commit}'], signal)).trim();
    if (!oid.test(revision)) throw new CatalogError('INVALID_REVISION', 'Git returned an unsupported revision.', 422);
    const tree = decode(await this.run(identity.path, ['rev-parse', '--verify', `${revision}^{tree}`], signal)).trim();
    if (!oid.test(tree)) throw new CatalogError('INVALID_TREE', 'Git returned an unsupported tree.', 422);
    // Avoid `status`: content refresh can invoke repository-configured clean filters.
    // ls-files reports conservative stat changes without converting working content.
    const working = await this.run(identity.path, ['ls-files', '--modified', '--deleted', '--others', '--exclude-standard', '-z'], signal);
    const staged = await this.run(identity.path, ['diff-index', '--cached', '--name-only', '--no-ext-diff', '--no-textconv', '-z', revision, '--'], signal);
    const dirty = working.length > 0 || staged.length > 0;
    return { revision, tree, dirty };
  }
  async inventory(identity: RepositoryIdentity, revision: string, signal: AbortSignal): Promise<TreeEntry[]> {
    if (!oid.test(revision)) throw new CatalogError('INVALID_REVISION', 'An exact Git revision is required.');
    const output = decode(await this.run(identity.path, ['ls-tree', '-r', '-l', '-z', '--full-tree', revision], signal));
    return output.split('\0').filter(Boolean).map(line => {
      const match = /^(\d{6}) (blob|commit) ([a-f0-9]+) +([0-9]+|-)\t([\s\S]+)$/.exec(line);
      if (!match || !oid.test(match[3]!)) throw new CatalogError('INVALID_TREE', 'Unsupported Git tree entry.', 422);
      return { mode: match[1]!, blob: match[3]!, size: match[4] === '-' ? 0 : Number(match[4]), path: match[5]! };
    });
  }
  async blob(identity: RepositoryIdentity, blob: string, signal: AbortSignal, maxBytes: number): Promise<Buffer> {
    if (!oid.test(blob)) throw new CatalogError('INVALID_BLOB', 'An exact Git object ID is required.');
    const actual = await this.identity(identity.path, signal);
    if (actual.gitDir !== identity.gitDir || actual.path !== identity.path) throw new CatalogError('SOURCE_CHANGED', 'The repository identity changed.', 409);
    return this.run(identity.path, ['cat-file', 'blob', blob], signal, maxBytes);
  }
}
