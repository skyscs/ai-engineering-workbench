import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { RuntimeError } from './types.js';

export interface ProcessResult { exitCode: number | null; signal: NodeJS.Signals | null; spawnError: string | null }
/** Own the process group and observed Linux descendants, including separate sessions. */
export function execute(executable: string, args: string[], options: {
  cwd: string; env: NodeJS.ProcessEnv; signal: AbortSignal; timeoutMs: number;
  stdin?: string; stdout(chunk: Buffer): void; stderr(chunk: Buffer): void;
}): Promise<ProcessResult> {
  if (options.signal.aborted) return Promise.reject(new RuntimeError('CANCELLED', 'The run was cancelled.'));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, env: options.env, shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let reason: unknown = null, spawnError: string | null = null, killTimer: NodeJS.Timeout | undefined;
    const descendants = new Map<number, string>();
    function identity(pid: number): string | null {
      try { const stat = readFileSync(`/proc/${pid}/stat`, 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] ?? null; }
      catch { return null; }
    }
    function discover() {
      const seen = new Set<number>();
      const visit = (pid: number) => {
        if (seen.has(pid) || seen.size >= 1024) return; seen.add(pid);
        let threads: string[];
        try { threads = readdirSync(`/proc/${pid}/task`); } catch { return; }
        for (const thread of threads) {
          let children: string;
          try { children = readFileSync(`/proc/${pid}/task/${thread}/children`, 'utf8'); } catch { continue; }
          for (const value of children.trim().split(/\s+/)) {
            const id = Number(value); if (!id) continue;
            const start = identity(id); if (start) { descendants.set(id, start); visit(id); }
          }
        }
      };
      if (child.pid) visit(child.pid);
      for (const [pid, start] of descendants) {
        if (identity(pid) === start) visit(pid); else descendants.delete(pid);
      }
    }
    function kill(signal: NodeJS.Signals) {
      discover();
      // Compare kernel start times before signaling to avoid a reused PID.
      for (const [pid, start] of descendants) if (identity(pid) === start) {
        try { process.kill(pid, signal); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') reason ??= error; }
      }
      if (child.pid) try { process.kill(-child.pid, signal); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') reason ??= error; }
    }
    function stop(error: unknown) {
      if (reason) return; reason = error; kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1000);
    }
    const monitor = setInterval(discover, 50);
    const abort = () => stop(new RuntimeError('CANCELLED', 'The run was cancelled.'));
    options.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop(new RuntimeError('TIMEOUT', 'The runtime exceeded its wall timeout.')), options.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { if (!reason) try { options.stdout(chunk); } catch (error) { stop(error); } });
    child.stderr.on('data', (chunk: Buffer) => { if (!reason) try { options.stderr(chunk); } catch (error) { stop(error); } });
    child.stdin.on('error', () => {});
    child.on('error', (error: NodeJS.ErrnoException) => { spawnError = error.code ?? 'UNKNOWN'; });
    // An exited leader may leave children holding the pipes open. Kill that group.
    child.on('exit', () => kill('SIGKILL'));
    child.on('close', (exitCode, signal) => {
      clearInterval(monitor); clearTimeout(timer); clearTimeout(killTimer); options.signal.removeEventListener('abort', abort); kill('SIGKILL');
      if (reason) reject(reason); else resolve({ exitCode, signal, spawnError });
    });
    child.stdin.end(options.stdin ?? '');
    if (options.signal.aborted) abort();
  });
}
