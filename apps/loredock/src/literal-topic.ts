/** Exact direct source literals only; no Java evaluation or configuration binding. */
export const topicRule = Object.freeze({ version: 'direct-java-topic-literal/1', maxUtf8Bytes: 256 } as const);

export function literalTopic(expression: unknown): string | null {
  if (typeof expression !== 'string') return null;
  const match = /^"[^"\\\r\n]+"$/u.exec(expression);
  if (!match || match[0] !== expression) return null;
  const value = expression.slice(1, -1);
  return Buffer.byteLength(value, 'utf8') <= topicRule.maxUtf8Bytes ? value : null;
}
