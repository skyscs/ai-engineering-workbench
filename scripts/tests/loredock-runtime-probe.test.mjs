import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectRequest, instructionCanaries, probeRuntime } from '../loredock-runtime-probe.mjs';

test('qualification inspects both direct and additional tool definitions', () => {
  const result = inspectRequest({ tools: [{ name: 'web_search' }], input: [
    { type: 'additional_tools', tools: [{ type: 'namespace', name: 'collaboration', tools: [{ type: 'function', name: 'spawn_agent' }] }] },
    { type: 'message', content: [{ text: instructionCanaries.home }] },
  ] });
  assert.deepEqual(result.tools, ['collaboration.spawn_agent', 'web_search']);
  assert.deepEqual(result.instructionCanaries, { ancestor: false, project: false, home: true });
  assert.equal(result.strictSchema, false);
  assert.equal(result.schemaForwarded, false);
});

test('qualification requires explicit installation selectors and never defaults to an account', async () => {
  await assert.rejects(probeRuntime({}), /Explicit absolute/);
  await assert.rejects(probeRuntime({ executable: 'codex', sandboxHelper: '/bin/true' }), /Explicit absolute/);
  await assert.rejects(probeRuntime({ executable: '/bin/true' }), /Explicit absolute/);
});
