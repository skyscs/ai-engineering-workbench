import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

export async function until(check, message) {
  const end = performance.now() + 10000;
  for (;;) { const value = await check(); if (value) return value;
    assert(performance.now() < end, message); await delay(50); }
}

export async function client(port) {
  let cookie, token;
  async function request(route, method = 'GET', body, overrides = {}) {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port, path: '/api' + route, method, agent: false,
        headers: { host: '127.0.0.1:4244', origin: 'http://127.0.0.1:4244', 'x-loredock-client': 'web',
          ...cookie ? { cookie, 'x-loredock-csrf': token } : {}, ...raw ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } : {}, ...overrides } }, response => {
        let value = ''; response.setEncoding('utf8');
        response.on('data', chunk => { value += chunk; if (Buffer.byteLength(value) > 1048576) response.destroy(new Error('Controlled HTTP response exceeds 1 MiB.')); });
        response.once('error', reject); response.once('end', () => { try { resolve({ status: response.statusCode, value: JSON.parse(value), headers: response.headers }); } catch (error) { reject(error); } });
      });
      req.setTimeout(5000, () => req.destroy(new Error('Controlled HTTP request timed out.'))); req.once('error', reject); req.end(raw);
    });
  }
  const session = await request('/session', 'POST'); assert.equal(session.status, 200);
  cookie = session.headers['set-cookie'][0].split(';')[0]; token = session.value.token;
  return { request, async json(route, method, body, status = 200) { const response = await request(route, method, body); assert.equal(response.status, status, JSON.stringify(response.value)); return response.value; } };
}
