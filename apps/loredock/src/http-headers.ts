export const headerLimits = { names: 16, nameCharacters: 128, serializedCharacters: 512 } as const;
export interface HeaderCheck { status: 'match' | 'gap' | 'unknown'; detail: string }
// RFC 9110 field-name tokens; only ASCII case folding is meaningful here.
export const headerName = (value: unknown): value is string => typeof value === 'string'
  && value.length <= headerLimits.nameCharacters && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value);

export function requestHeaderProperties(names?: string[]): Record<string, string> {
  const valid = names && names.length <= headerLimits.names && names.every(headerName)
    && new Set(names.map(name => name.toLowerCase())).size === names.length;
  const serialized = valid ? JSON.stringify([...names].sort()) : '[]';
  return valid && serialized.length <= headerLimits.serializedCharacters
    ? { requestHeaderStatus: 'literal', requestHeaderNames: serialized }
    : { requestHeaderStatus: 'unknown', requestHeaderNames: '[]' };
}

/** Same-document, exact handler.parameter bindings only; never infer aliases. */
export function routeHeaderProperties(value: unknown, handler: string): Record<string, string> {
  const unresolved = { headerBindingStatus: value === undefined ? 'not-declared' : 'unknown', headerBindings: '[]' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unresolved;
  const entries = Object.entries(value); if (entries.length > headerLimits.names) return unresolved;
  const bindings: { parameter: string; name: string }[] = [];
  for (const [key, name] of entries) {
    if (!key.startsWith(handler + '.')) continue;
    const parameter = key.slice(handler.length + 1);
    if (!/^[A-Za-z_$][\w$]{0,127}$/.test(parameter) || !headerName(name)) return unresolved;
    bindings.push({ parameter, name });
  }
  bindings.sort((a, b) => a.parameter < b.parameter ? -1 : a.parameter > b.parameter ? 1 : 0);
  const serialized = JSON.stringify(bindings);
  if (serialized.length > headerLimits.serializedCharacters) return unresolved;
  return { headerBindingStatus: bindings.length ? 'literal' : 'not-declared', headerBindings: serialized };
}

export function compareHeaders(request: Record<string, string>, route: Record<string, string>): HeaderCheck {
  if (route.headerBindingStatus !== 'literal') return { status: 'unknown',
    detail: 'No complete supported header binding is declared for this handler in the route document.' };
  if (request.requestHeaderStatus !== 'literal') return { status: 'unknown',
    detail: 'Client header names are dynamic, unsupported or beyond the analysis bound; their mapping remains unresolved.' };
  const names = JSON.parse(request.requestHeaderNames!) as string[];
  const bindings = JSON.parse(route.headerBindings!) as { parameter: string; name: string }[];
  const supplied = new Set(names.map(name => name.toLowerCase()));
  const missing = bindings.filter(binding => !supplied.has(binding.name.toLowerCase()));
  if (missing.length) return { status: 'gap', detail:
    `Route bindings ${missing.map(binding => `${binding.parameter} ← ${binding.name}`).join(', ')} have no matching literal client header among ${names.join(', ') || '(none declared)'}.` };
  return { status: 'match', detail: `Literal header names match the declared bindings (${bindings.map(binding => `${binding.parameter} ← ${binding.name}`).join(', ')}), ignoring ASCII case.` };
}
