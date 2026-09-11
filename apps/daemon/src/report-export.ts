import { redact } from '@aew/ai';
import type { Evidence } from '@aew/core';
import type { RuntimeService } from './runtime-service.js';

/** Export an explicit projection, never a serialized run snapshot or diagnostic payload. */
export async function exportReport(service: RuntimeService, w: string, t: string, id: string) {
  const report = service.storage.tasks.investigations.get(w, t, id);
  const { run, metadata } = service.storage.tasks.journal.detail(w, t, report.stageRunId);
  const snapshot = run.inputSnapshot;
  const records = service.storage.tasks.worktrees.list(w, t);
  const localPaths = [snapshot.connection.configHome, snapshot.connection.executablePath,
    service.storage.paths.root, ...snapshot.repositories.map(r => r.worktreePath),
    ...records.flatMap(r => [r.sourcePath, r.commonGitDir])].filter((s): s is string => !!s).sort((a, b) => b.length - a.length);
  const text = (value: string) => {
    let safe = redact(value);
    for (const localPath of localPaths) safe = safe.replaceAll(localPath, '[local path]');
    safe = safe.replace(/(^|[\s("'`])(?:[A-Za-z]:[\\/]|\\\\|\/)[^\s<>"'`)]+/gm, '$1[local path]');
    return safe.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&');
  };
  const lines: string[] = [];
  const field = (name: string, value: string | number | null | undefined) => lines.push(`- ${name}: ${text(String(value ?? 'Not recorded'))}`);
  const prose = (value: string) => lines.push('', ...text(value).split('\n').map(line => `> ${line}`), '');
  const refs = (ids: string[]) => ids.length ? ids.join(', ') : 'None';
  lines.push(`# Investigation report — version ${report.version}`, '');
  field('Title at run time', snapshot.task.title); field('Task ID', t); field('Report ID', report.id);
  field('Root cause ID', report.rootCauseId); field('Stage run ID', run.id); field('Published', report.createdAt);
  field('Exported', new Date().toISOString()); field('Lifecycle at export', report.status); field('Freshness at export', report.freshness);
  field('Context revision', report.contextRevision); field('Previous report ID', report.previousVersionId);
  field('Triggering intervention ID', report.triggeredByInterventionId);
  lines.push('', '## Runtime provenance', '');
  field('Runtime', snapshot.connection.runtimeType); field('Connection ID', run.aiConnectionId);
  field('Model profile ID', run.modelProfileId); field('Requested model', snapshot.profile?.modelIdentifier ?? 'CLI default');
  field('Requested reasoning effort', snapshot.profile?.reasoningEffort ?? 'CLI default');
  field('Prompt version', snapshot.promptVersion); field('Schema version', snapshot.schemaVersion);
  field('Recorded CLI version', metadata && typeof metadata === 'object' && 'version' in metadata && typeof metadata.version === 'string' ? metadata.version : null);
  lines.push('', '## Task description at run time'); prose(snapshot.task.description);
  lines.push('## Constraints at run time', '');
  if (!snapshot.constraints.length) lines.push('No active constraints were recorded.');
  for (const constraint of snapshot.constraints) prose(constraint);
  if (snapshot.revision) { lines.push('', '## Triggering challenge'); prose(snapshot.revision.intervention.text); }
  lines.push('', '## Selected repository pins', '');
  for (const repository of snapshot.repositories) field(repository.id, repository.resolvedCommitSha);
  lines.push('', '## Selected artifact ranges', '');
  if (!snapshot.context.entries.some(e => e.range)) lines.push('No artifact text was selected.');
  for (const entry of snapshot.context.entries.filter(e => e.range)) {
    field('Artifact ID', entry.id); field('SHA-256', entry.sha256); field('UTF-8 byte range', `[${entry.range!.start}, ${entry.range!.end})`);
  }
  lines.push('', '## Investigation'); prose(report.result.investigation.summary);
  lines.push('## Historical timeline', '');
  for (const entry of report.result.investigation.timeline) { prose(entry.description); field('Evidence IDs', refs(entry.evidenceIds)); }
  lines.push('', '## Root cause', ''); field('Conclusion', report.result.rootCause.status); prose(report.result.rootCause.summary);
  field('Evidence IDs', refs(report.result.rootCause.evidenceIds));
  lines.push('', '## Unresolved questions', '');
  if (!report.result.rootCause.unresolvedQuestions.length) lines.push('None reported.');
  for (const question of report.result.rootCause.unresolvedQuestions) prose(question);
  lines.push('', '## Evidence locators', '');
  for (const evidence of report.result.evidence) {
    lines.push(`### ${text(evidence.id)}`, ''); prose(evidence.description);
    for (const [label, value] of locator(evidence)) field(label, value);
    // Reuse the owned, pinned reader. Errors never copy filesystem paths or raw diagnostics into exports.
    try { await service.readEvidence(w, t, id, evidence.id); field('Source at export', 'Available; locator rechecked'); }
    catch { field('Source at export', 'Unavailable or busy; locator could not be rechecked'); }
    lines.push('');
  }
  lines.push('## Limitations', '',
    'This is an AI-generated explanation for human review. Locator validation does not prove causality.',
    'Sources were validated at publication. Availability above is checked during export and can change afterward.',
    'Lifecycle and freshness describe export time. The report content and input provenance describe its original run.',
    'Source bodies, executable/configuration paths, configuration fingerprints and raw diagnostics are omitted.',
    'Known credential patterns, URLs and absolute paths in prose are redacted. Review before sharing: this is not a complete secret scanner.',
    'Untrusted prose is escaped as text. Requested settings do not certify provider/account identity or exact outbound data.', '');
  return { filename: `investigation-${report.id}-v${report.version}.md`, markdown: lines.join('\n') };
}

function locator(e: Evidence): [string, string | number | null][] {
  return e.kind === 'artifact'
    ? [['Kind', e.kind], ['Artifact ID', e.artifactId], ['SHA-256', e.sha256], ['Byte start (inclusive)', e.byteStart], ['Byte end (exclusive)', e.byteEnd]]
    : [['Kind', e.kind], ['Repository ID', e.repositoryId], ['Commit SHA', e.revision],
      ...(e.kind === 'repository_file' ? [['Repository-relative path', e.path], ['Line start', e.lineStart], ['Line end', e.lineEnd]] as [string, string | number | null][] : [])];
}
