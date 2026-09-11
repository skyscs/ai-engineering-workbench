import { DomainError, type Evidence, type EvidenceContent, type StageRun } from '@aew/core';
import { GitClient, readPinnedEvidence } from '@aew/git';
import type { Storage } from '@aew/storage';
import { validateEvidence } from '@aew/workflow';

export class EvidenceService {
  constructor(private readonly storage: Storage, private readonly git: GitClient) {}
  async resolve(run: StageRun, evidence: Evidence): Promise<EvidenceContent> {
    if (!validateEvidence(evidence)) throw new DomainError('CONFLICT', 'Invalid evidence locator.');
    const snapshot = run.inputSnapshot, w = snapshot.task.workspaceId, t = run.taskId;
    if (evidence.kind === 'artifact') {
      const entry = snapshot.context.entries.find(e => e.id === evidence.artifactId);
      if (!entry?.range || entry.kind !== 'text' || evidence.sha256 !== entry.sha256 ||
        evidence.byteStart! < entry.range.start || evidence.byteEnd! > entry.range.end) throw new DomainError('CONFLICT', 'Evidence must stay within a text range supplied to this run.');
      const current = this.storage.tasks.artifacts.get(w, t, entry.id);
      if (current.sha256 !== entry.sha256) throw new DomainError('CONFLICT', 'Artifact identity changed.');
      const selected = this.storage.tasks.artifacts.verifyContext(w, t, { ...snapshot.context,
        entries: [{ ...entry, range: { start: evidence.byteStart!, end: evidence.byteEnd! } }] });
      return { locator: `${entry.originalFilename} [bytes ${evidence.byteStart}, ${evidence.byteEnd}) SHA-256 ${entry.sha256}`, text: selected[0]!.text };
    }
    const selected = snapshot.repositories.find(r => r.id === evidence.repositoryId);
    const record = this.storage.tasks.worktrees.list(w, t).find(r => r.repositoryId === evidence.repositoryId);
    if (!selected?.resolvedCommitSha || !record) throw new DomainError('CONFLICT', 'Evidence must belong to a repository selected for this run.');
    return readPinnedEvidence(this.git, record, evidence, selected.resolvedCommitSha);
  }
  async read(w: string, t: string, reportId: string, evidenceId: string) {
    const report = this.storage.tasks.investigations.get(w, t, reportId);
    const evidence = report.result.evidence.find(e => e.id === evidenceId);
    if (!evidence) throw new DomainError('NOT_FOUND', 'Evidence not found in this report.');
    const run = this.storage.tasks.getRun(w, t, report.stageRunId);
    const record = this.storage.tasks.worktrees.list(w, t).find(r => r.repositoryId === evidence.repositoryId);
    const resolve = () => this.resolve(run, evidence);
    return record?.commonGitDir ? this.git.exclusive(record.commonGitDir, resolve) : resolve();
  }
}
