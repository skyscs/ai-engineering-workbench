import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError, parseSelections, type Artifact, type ArtifactLimits, type ContextManifest, type Task } from '@aew/core';
import { transaction } from './tasks.js';

type ImportRow = { id: string; task_id: string; destination: string; state: string; original_filename: string; mime_type: string; expected_size: number; sha256: string | null; created_at: string };
const artifactColumns = 'id, task_id AS taskId, original_filename AS originalFilename, mime_type AS mimeType, byte_size AS byteSize, sha256, kind, created_at AS createdAt';
function exists(file: string) {
  try { return lstatSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
function directory(file: string, create = false) {
  if (create && !exists(file)) mkdirSync(file, { mode: 0o700 });
  if (!lstatSync(file).isDirectory()) throw new DomainError('CONFLICT', 'Artifact storage contains a redirected directory.');
}
function syncDirectory(file: string) { const fd = openSync(file, constants.O_RDONLY); try { fsyncSync(fd); } finally { closeSync(fd); } }
function regular(file: string) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1) throw new DomainError('CONFLICT', 'Artifact storage requires regular files without links.');
}
function readFileHandle(file: string) {
  regular(file);
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  const stat = fstatSync(fd);
  if (!stat.isFile() || stat.nlink !== 1) { closeSync(fd); throw new DomainError('CONFLICT', 'Invalid artifact file.'); }
  return fd;
}
function hashFile(fd: number) {
  const hash = createHash('sha256'), buffer = Buffer.alloc(65536);
  let position = 0, count: number;
  while ((count = readSync(fd, buffer, 0, buffer.length, position)) > 0) { hash.update(buffer.subarray(0, count)); position += count; }
  return { size: position, hash: hash.digest('hex') };
}
function kind(name: string): Artifact['kind'] {
  const extension = path.extname(name).toLowerCase();
  return ['.txt', '.md', '.markdown', '.log'].includes(extension) ? 'text' : ['.png', '.jpg', '.jpeg'].includes(extension) ? 'image' : 'unsupported';
}

export function createArtifactStore(db: DatabaseSync, root: string, limits: ArtifactLimits, tasks: {
  get(workspaceId: string, taskId: string): Task; editable(workspaceId: string, taskId: string): void; bump(taskId: string): void;
}) {
  const active = new Set<Promise<unknown>>();
  const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  let closing = false;
  function paths(taskId: string, id: string, create = false) {
    if (![taskId, id].every((v) => /^[a-f0-9-]{36}$/.test(v))) throw new DomainError('INVALID_INPUT', 'Invalid artifact storage identifier.');
    directory(root);
    const taskRoot = path.join(root, taskId), artifactRoot = path.join(taskRoot, 'artifacts');
    directory(taskRoot, create); directory(artifactRoot, create);
    if (create) { syncDirectory(root); syncDirectory(taskRoot); }
    return { dir: artifactRoot, final: path.join(artifactRoot, id), staging: path.join(artifactRoot, `${id}.upload`) };
  }
  function list(workspaceId: string, taskId: string): Artifact[] {
    tasks.get(workspaceId, taskId);
    return db.prepare(`SELECT ${artifactColumns} FROM artifacts WHERE task_id = ? ORDER BY created_at, id`).all(taskId) as unknown as Artifact[];
  }
  function get(workspaceId: string, taskId: string, id: string): Artifact {
    tasks.get(workspaceId, taskId);
    const row = db.prepare(`SELECT ${artifactColumns} FROM artifacts WHERE task_id = ? AND id = ?`).get(taskId, id);
    if (!row) throw new DomainError('NOT_FOUND', 'Artifact not found in this task.');
    return row as unknown as Artifact;
  }
  function open(workspaceId: string, taskId: string, id: string) {
    const artifact = get(workspaceId, taskId, id);
    try {
      const fd = readFileHandle(paths(taskId, id).final);
      if (fstatSync(fd).size !== artifact.byteSize) { closeSync(fd); throw new DomainError('CONFLICT', 'Artifact size has changed.'); }
      return { artifact, fd };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('CONFLICT', 'The stored artifact is unavailable. Restore the original data directory.');
    }
  }
  function context(workspaceId: string, taskId: string): ContextManifest {
    const task = tasks.get(workspaceId, taskId);
    const selected = db.prepare('SELECT artifact_id, byte_start, byte_end FROM artifact_context WHERE task_id = ?').all(taskId);
    const descriptionBytes = Buffer.byteLength(task.description);
    return { revision: task.contextRevision, descriptionBytes, limitBytes: limits.contextBytes,
      includedBytes: descriptionBytes + selected.reduce((sum, r) => sum + Number(r.byte_end) - Number(r.byte_start), 0),
      entries: list(workspaceId, taskId).map((artifact) => {
        const range = selected.find((r) => r.artifact_id === artifact.id);
        return { ...artifact, range: range ? { start: Number(range.byte_start), end: Number(range.byte_end) } : null,
          reason: range ? 'Included UTF-8 text range.' : artifact.kind === 'text' ? 'Excluded until explicitly selected as UTF-8 text.' :
            artifact.kind === 'image' ? 'Not analyzed: image runtime capability has not been verified.' : 'Not analyzed in v0.1; available for download.' };
      }) };
  }
  function verifyContext(workspaceId: string, taskId: string, manifest: ContextManifest) {
    if (manifest.includedBytes > limits.contextBytes) throw new DomainError('INVALID_INPUT', 'Selected text exceeds the context limit. Choose smaller ranges.');
    const selected: { artifactId: string; text: string }[] = [];
    for (const entry of manifest.entries) {
      if (!entry.range) continue;
      if (entry.kind !== 'text' || entry.range.end > entry.byteSize) throw new DomainError('INVALID_INPUT', 'Only valid text artifact byte ranges can be selected.');
      const { fd } = open(workspaceId, taskId, entry.id);
      try {
        if (hashFile(fd).hash !== entry.sha256) throw new DomainError('CONFLICT', 'An artifact hash no longer matches its imported bytes.');
        const buffer = Buffer.alloc(entry.range.end - entry.range.start);
        let offset = 0;
        while (offset < buffer.length) {
          const count = readSync(fd, buffer, offset, buffer.length - offset, entry.range.start + offset);
          if (!count) throw new DomainError('CONFLICT', 'An artifact range is unavailable.');
          offset += count;
        }
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
          if (text.includes('\u0000')) throw new Error('Binary text');
          selected.push({ artifactId: entry.id, text });
        } catch { throw new DomainError('INVALID_INPUT', 'Select valid UTF-8 text with complete character boundaries and no NUL bytes.'); }
      } finally { closeSync(fd); }
    }
    return selected;
  }
  function finalize(row: ImportRow) {
    transaction(db, () => {
      db.prepare(`INSERT INTO artifacts (id, task_id, original_filename, mime_type, byte_size, sha256, kind, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(row.id, row.task_id, row.original_filename, row.mime_type, row.expected_size, row.sha256, kind(row.original_filename), row.created_at);
      db.prepare("UPDATE artifact_imports SET state = 'ready', error_code = NULL WHERE id = ?").run(row.id);
      tasks.bump(row.task_id);
    });
  }
  function fail(row: ImportRow, code: string) {
    // Only the recorded operation's regular staging file may be removed.
    const p = paths(row.task_id, row.id);
    if (exists(p.staging)) { regular(p.staging); unlinkSync(p.staging); syncDirectory(p.dir); }
    db.prepare("UPDATE artifact_imports SET state = 'failed', error_code = ? WHERE id = ?").run(code, row.id);
  }
  function recover() {
    for (const row of db.prepare("SELECT * FROM artifact_imports WHERE state IN ('uploading', 'prepared')").all() as unknown as ImportRow[]) {
      try {
        const p = paths(row.task_id, row.id, true);
        if (row.destination !== `${row.task_id}/artifacts/${row.id}`) throw new Error('Unexpected destination');
        if (row.state === 'prepared') {
          const candidate = exists(p.final) ? p.final : p.staging;
          const fd = readFileHandle(candidate);
          try {
            const actual = hashFile(fd);
            if (actual.size !== row.expected_size || actual.hash !== row.sha256) throw new Error('Hash mismatch');
          } finally { closeSync(fd); }
          if (candidate === p.staging) renameSync(p.staging, p.final);
          syncDirectory(p.dir); finalize(row);
        } else { fail(row, 'INTERRUPTED'); }
      } catch {
        // Retain uncertain paths and quota; retry recovery after local repair.
        db.prepare("UPDATE artifact_imports SET error_code = 'RECOVERY_REQUIRED' WHERE id = ?").run(row.id);
      }
    }
  }
  async function upload(workspaceId: string, taskId: string, metadata: { name: string; mimeType: string; size: number }, body: ReadableStream<Uint8Array>) {
    tasks.editable(workspaceId, taskId);
    if (closing) throw new DomainError('CONFLICT', 'The daemon is shutting down.');
    if (typeof metadata.name !== 'string' || !metadata.name.trim() || metadata.name.length > 255 || /[\u0000-\u001f\u007f]/.test(metadata.name) ||
      typeof metadata.mimeType !== 'string' || !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(metadata.mimeType) || metadata.mimeType.length > 128 ||
      !Number.isSafeInteger(metadata.size) || metadata.size < 0 || metadata.size > limits.fileBytes) {
      throw new DomainError('INVALID_INPUT', 'Provide a filename, MIME type and file size within the configured limit.');
    }
    const used = Number(db.prepare("SELECT coalesce(sum(expected_size), 0) AS size FROM artifact_imports WHERE task_id = ? AND state != 'failed'").get(taskId)!.size);
    if (metadata.size > limits.taskBytes - used) throw new DomainError('INVALID_INPUT', 'This import would exceed the task artifact limit.');
    const row: ImportRow = { id: randomUUID(), task_id: taskId, destination: '', state: 'uploading', original_filename: metadata.name,
      mime_type: metadata.mimeType, expected_size: metadata.size, sha256: null, created_at: new Date().toISOString() };
    row.destination = `${taskId}/artifacts/${row.id}`;
    db.prepare(`INSERT INTO artifact_imports (id, task_id, destination, state, original_filename, mime_type, expected_size, created_at)
      VALUES (?, ?, ?, 'uploading', ?, ?, ?, ?)`).run(row.id, taskId, row.destination, row.original_filename, row.mime_type, row.expected_size, row.created_at);
    let fd: number | undefined, reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let prepared = false;
    try {
      const p = paths(taskId, row.id, true);
      if (exists(p.final)) throw new Error('Destination exists');
      fd = openSync(p.staging, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      reader = body.getReader(); readers.add(reader);
      const hash = createHash('sha256'); let size = 0;
      while (true) {
        const next = await reader.read();
        if (closing) throw new Error('Shutdown');
        if (next.done) break;
        size += next.value.byteLength;
        if (size > metadata.size || size > limits.fileBytes) throw new DomainError('INVALID_INPUT', 'The streamed file exceeds its declared size or upload limit.');
        hash.update(next.value);
        let offset = 0;
        while (offset < next.value.length) {
          const written = writeSync(fd, next.value, offset, Math.min(65536, next.value.length - offset));
          if (!written) throw new Error('Incomplete write');
          offset += written;
        }
      }
      if (size !== metadata.size) throw new DomainError('INVALID_INPUT', 'The upload ended before its declared file size was received.');
      fchmodSync(fd, 0o400); fsyncSync(fd); closeSync(fd); fd = undefined; syncDirectory(p.dir);
      row.sha256 = hash.digest('hex'); row.state = 'prepared';
      db.prepare("UPDATE artifact_imports SET state = 'prepared', sha256 = ? WHERE id = ?").run(row.sha256, row.id);
      prepared = true;
      renameSync(p.staging, p.final); syncDirectory(p.dir); finalize(row);
      return get(workspaceId, taskId, row.id);
    } catch (error) {
      if (fd !== undefined) { closeSync(fd); fd = undefined; }
      if (!prepared) { try { fail(row, (error as NodeJS.ErrnoException).code === 'ENOSPC' ? 'DISK_FULL' : 'UPLOAD_FAILED'); } catch { /* Recovery retains uncertain paths. */ } }
      if (error instanceof DomainError) throw error;
      throw new DomainError('CONFLICT', prepared ? 'The file was staged but metadata finalization failed. Restart the daemon to recover the import.' :
        (error as NodeJS.ErrnoException).code === 'ENOSPC' ? 'The artifact import failed because the disk is full. Free space and retry.' : 'The artifact upload failed. Check local storage and retry.');
    } finally {
      if (reader) { readers.delete(reader); void reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
  }
  return {
    list, get, open, context, verifyContext, recover,
    import(workspaceId: string, taskId: string, metadata: { name: string; mimeType: string; size: number }, body: ReadableStream<Uint8Array>) {
      const job = upload(workspaceId, taskId, metadata, body); active.add(job);
      void job.finally(() => active.delete(job)).catch(() => {});
      return job;
    },
    selectContext(workspaceId: string, taskId: string, value: unknown) {
      tasks.editable(workspaceId, taskId);
      const selections = parseSelections(value), manifest = context(workspaceId, taskId);
      for (const selected of selections) if (!manifest.entries.some((entry) => entry.id === selected.artifactId)) throw new DomainError('NOT_FOUND', 'Selected artifact does not belong to this task.');
      manifest.entries = manifest.entries.map((entry) => {
        const selected = selections.find((s) => s.artifactId === entry.id);
        return { ...entry, range: selected ? { start: selected.start, end: selected.end } : null };
      });
      manifest.includedBytes = manifest.descriptionBytes + selections.reduce((sum, s) => sum + s.end - s.start, 0);
      verifyContext(workspaceId, taskId, manifest);
      transaction(db, () => {
        db.prepare('DELETE FROM artifact_context WHERE task_id = ?').run(taskId);
        for (const s of selections) db.prepare('INSERT INTO artifact_context (artifact_id, task_id, byte_start, byte_end) VALUES (?, ?, ?, ?)').run(s.artifactId, taskId, s.start, s.end);
        tasks.bump(taskId);
      });
      return context(workspaceId, taskId);
    },
    async close() {
      closing = true;
      for (const reader of readers) void reader.cancel().catch(() => {});
      await Promise.allSettled([...active]);
    }
  };
}
