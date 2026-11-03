import { Session } from 'node:inspector/promises';

export const normalizedError = cause => ({ name: cause?.name ?? 'Error', code: cause?.code ?? null,
  message: cause?.message ?? String(cause), stack: cause?.stack ?? null });

// Internal session only; no explicit collection or heap snapshot. V8 collects during export.
export async function sampleAllocation(action, parameters, createSession = () => new Session()) {
  let session, connected = false, started = false, actionFailed = false, result, actionError, profile, beforeMemory, afterMemory, wallMs;
  const profilerErrors = [];
  try {
    session = createSession(); session.connect(); connected = true;
    await session.post('HeapProfiler.enable');
    await session.post('HeapProfiler.startSampling', parameters); started = true;
    beforeMemory = process.memoryUsage(); const began = performance.now();
    try { result = await action(); } catch (error) { actionFailed = true; actionError = error; }
    finally { wallMs = performance.now() - began; afterMemory = process.memoryUsage(); }
  } catch (error) { profilerErrors.push({ phase: 'start', ...normalizedError(error) }); }
  finally {
    if (started) {
      try { ({ profile } = await session.post('HeapProfiler.stopSampling')); }
      catch (error) { profilerErrors.push({ phase: 'stop', ...normalizedError(error) }); }
    }
    if (connected) {
      try { session.disconnect(); }
      catch (error) { profilerErrors.push({ phase: 'disconnect', ...normalizedError(error) }); }
    }
  }
  return { result: result ?? null, actionError: actionFailed ? normalizedError(actionError) : null,
    profile: profile ?? null, profilerErrors, parameters, wallMs, beforeMemory, afterMemory,
    resourceAcceptance: 'not-evaluated-profiled' };
}
