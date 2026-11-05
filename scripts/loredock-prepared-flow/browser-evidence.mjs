import assert from 'node:assert/strict';
import { hash } from './io.mjs';

export function sanitized(value) {
  if (Array.isArray(value)) return value.map(sanitized);
  if (!value || typeof value !== 'object') return value;
  if (typeof value.name === 'string' && /^(cookie|set-cookie|x-loredock-csrf)$/i.test(value.name) && Object.hasOwn(value, 'value'))
    return { ...value, value: '[removed-session-material]' };
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    /^(cookie|set-cookie|x-loredock-csrf|token)$/i.test(key) ? '[removed-session-material]'
      : key === 'headersText' && typeof child === 'string' ? child.replace(/^(set-cookie|cookie|x-loredock-csrf):[^\r\n]*/gim, '$1: [removed-session-material]')
        : sanitized(child)]));
}

export function browserBody(body, url) {
  assert.equal(typeof body.body, 'string'); assert.equal(typeof body.base64Encoded, 'boolean');
  const location = new URL(url);
  assert.equal(location.origin, 'http://127.0.0.1:4244'); assert(location.pathname.startsWith('/api/'));
  const raw = Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8');
  assert(raw.length <= 2 * 1024 * 1024, 'Browser API body exceeds retention cap.');
  assert(raw.equals(Buffer.from(raw.toString('utf8'))), 'Browser JSON body must preserve UTF-8 bytes.');
  const value = JSON.parse(raw.toString('utf8')), redacted = location.pathname === '/api/session';
  const retained = redacted ? Buffer.from(JSON.stringify({ ...sanitized(value), token: '[removed-session-token]' }) + '\n') : raw;
  return { value: sanitized(value), retained, metadata: { url, bytes: raw.length, rawSha256: redacted ? null : hash(raw),
    retainedBytes: retained.length, retainedSha256: hash(retained), redacted } };
}
