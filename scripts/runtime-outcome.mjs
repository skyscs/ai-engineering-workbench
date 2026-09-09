/** Classify a completed probe without exposing provider messages or credentials. */
export function classifyFailure({ events, stderr = '', exitCode, stopped = null, spawnError = null }) {
  if (stopped) return stopped;
  if (spawnError) return 'spawn_failed';
  if (exitCode === 0 && events.some((event) => event.type === 'turn.completed')
    && !events.some((event) => event.type === 'turn.failed')) return null;
  const text = events.filter((event) => event.type === 'error' || event.type === 'turn.failed')
    .map((event) => event.message ?? event.error?.message ?? '').join('\n') + stderr;
  if (/usage limit/i.test(text)) return 'usage_limit';
  if (/authentication required|not logged in|unauthorized|invalid api key|\b401\b/i.test(text)) return 'authentication_required';
  if (/profile.*(?:not found|does not exist|missing)/i.test(text)) return 'missing_profile';
  if (/unexpected argument|unknown option|unrecognized (?:option|argument)/i.test(text)) return 'unsupported_option';
  if (/permission denied|operation not permitted|read-only file system/i.test(text)) return 'permission_denied';
  return 'process_failed';
}

export function parseInvestigation(text, events, exitCode, stopped = null) {
  if (exitCode !== 0 || stopped || !events.some((event) => event.type === 'turn.completed')
    || events.some((event) => event.type === 'turn.failed')) return null;
  try {
    const value = JSON.parse(text);
    const fields = ['summary', 'clientEvidence', 'serviceEvidence', 'artifactEvidence'];
    if (value && fields.every((field) => typeof value[field] === 'string' && value[field].trim())
      && Array.isArray(value.unresolvedQuestions)
      && value.unresolvedQuestions.every((question) => typeof question === 'string')
      && Object.keys(value).length === 5) return value;
  } catch { /* Invalid or partial messages are not completed investigation results. */ }
  return null;
}
