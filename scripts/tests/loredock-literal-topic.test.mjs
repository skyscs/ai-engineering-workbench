import assert from 'node:assert/strict';
import { test } from 'node:test';
import { literalTopic } from '../loredock-literal-topics/topic.mjs';
test('direct topic profile uses exact strings and a UTF-8 byte bound without evaluating Java', () => {
  assert.equal(literalTopic('" audit "'), ' audit ');
  assert.equal(literalTopic('"' + 'é'.repeat(128) + '"'), 'é'.repeat(128));
  assert.equal(literalTopic('"' + 'é'.repeat(129) + '"'), null);
  for (const value of ['channel', 'Constants.channel', 'topic()', '("audit")', '"a"+"b"', '""', '"a\\n"', '"\\u0061"', '"a\nb"', '"""a"""', null]) assert.equal(literalTopic(value), null);
  assert.notEqual(literalTopic('"é"'), literalTopic('"é"'));
  for (const suffix of ['\n', '\r', '\u2028', '\u2029']) assert.equal(literalTopic('"audit"' + suffix), null);
});
