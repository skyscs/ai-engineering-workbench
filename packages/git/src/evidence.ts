import { DomainError, type Evidence, type EvidenceContent, type TaskWorktree } from '@aew/core';
import { GitClient } from './index.js';

/** Read Git objects anchored to the retained task pin, including available ancestors. */
export async function readPinnedEvidence(git: GitClient, record: TaskWorktree, evidence: Evidence, pinnedSha: string): Promise<EvidenceContent> {
  if (!record.sourcePath || !record.commonGitDir || !record.managedPinRef || record.resolvedCommitSha !== pinnedSha) {
    throw new DomainError('CONFLICT', 'The recorded repository pin is unavailable.');
  }
  const identity = await git.identity(record.sourcePath);
  if (identity.localPath !== record.sourcePath || identity.commonGitDir !== record.commonGitDir) throw new DomainError('CONFLICT', 'The repository identity changed.');
  const read = async (args: string[]) => (await git.run(['--no-replace-objects', ...args], record.sourcePath!)).stdout;
  if ((await read(['rev-parse', '--verify', '--end-of-options', `${record.managedPinRef}^{commit}`])).trim() !== pinnedSha) throw new DomainError('CONFLICT', 'The retained revision pin changed.');
  const revision = evidence.revision!;
  if ((await read(['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`])).trim() !== revision) throw new DomainError('CONFLICT', 'Evidence must name an exact commit.');
  await read(['merge-base', '--is-ancestor', revision, pinnedSha]);
  const locator = `${record.repositoryName} @ ${revision}`;
  if (evidence.kind === 'git_commit') {
    return { locator, text: await read(['show', '--no-patch', '--format=commit %H%nParents: %P%nDate: %aI%n%n%B', revision, '--']) };
  }
  const entry = await read(['ls-tree', '-z', revision, '--', `:(literal)${evidence.path}`]);
  const match = /^(100644|100755) blob ([a-f0-9]+)\t([^\0]+)\0$/.exec(entry);
  if (!match || match[3] !== evidence.path) throw new DomainError('CONFLICT', 'Evidence must reference an existing regular Git file; links and submodules are unsupported.');
  const size = Number((await read(['cat-file', '-s', match[2]!])).trim());
  if (!Number.isSafeInteger(size) || size > 256 * 1024) throw new DomainError('CONFLICT', 'Evidence files must not exceed 256 KiB.');
  const content = await read(['cat-file', 'blob', match[2]!]);
  // The shared Git transport decodes UTF-8. Reject replacement characters conservatively.
  if (content.includes('\u0000') || content.includes('\ufffd') || Buffer.byteLength(content) !== size) throw new DomainError('CONFLICT', 'Evidence requires supported UTF-8 text.');
  const lines = content.split('\n');
  if (content.endsWith('\n') || !content.length) lines.pop();
  if (evidence.lineEnd! > lines.length) throw new DomainError('CONFLICT', 'Evidence line range exceeds the pinned file.');
  return { locator: `${locator}:${evidence.path}:${evidence.lineStart}-${evidence.lineEnd}`,
    text: lines.slice(evidence.lineStart! - 1, evidence.lineEnd!).map((line, i) => `${evidence.lineStart! + i}: ${line}`).join('\n') };
}
