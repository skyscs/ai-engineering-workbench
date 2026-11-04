import { createHash } from 'node:crypto';
import { OperationBudget } from './operation-budget.js';

export class NativeReceiptError extends Error {
  constructor(readonly code: string, message = 'The native receipt failed validation.') { super(message); }
}
export function requireReceipt(ok: unknown, code = 'CORRUPT_RECEIPT'): asserts ok {
  if (!ok) throw new NativeReceiptError(code);
}
export const receiptLimits = Object.freeze({ projectionBytes: 512 * 1024, receiptBytes: 640 * 1024,
  spans: 30, textBytes: 64 * 1024, sources: 20, depth: 40 });
export type ReceiptLimits = { [K in keyof typeof receiptLimits]: number };
export function receiptContext(budget: OperationBudget, reductions: Partial<ReceiptLimits> = {}) {
  requireReceipt(budget instanceof OperationBudget, 'INVALID_CAPTURE_BUDGET'); budget.check();
  requireReceipt(record(reductions), 'INVALID_RECEIPT_LIMIT');
  const limits = { ...receiptLimits, ...reductions };
  for (const [key, value] of Object.entries(limits)) requireReceipt(Object.hasOwn(receiptLimits, key)
    && Number.isSafeInteger(value) && value >= 0 && value <= receiptLimits[key as keyof ReceiptLimits], 'INVALID_RECEIPT_LIMIT');
  return { budget, limits };
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const bytes = (value: string) => Buffer.byteLength(value, 'utf8');
export const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export type Check = (value: unknown) => boolean;
export const text: Check = value => typeof value === 'string' && Buffer.from(value).toString('utf8') === value;
export const string = (maximum = 512, minimum = 0): Check => value => text(value) && (value as string).length >= minimum && (value as string).length <= maximum;
export const integer = (maximum = Number.MAX_SAFE_INTEGER, minimum = 0): Check => value => Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
export const oneOf = (...values: unknown[]): Check => value => values.includes(value);
export const nullable = (check: Check): Check => value => value === null || check(value);
export const hex: Check = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const uuid: Check = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const gitId: Check = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
export const array = (check: Check, maximum: number, minimum = 0): Check => value => Array.isArray(value)
  && value.length >= minimum && value.length <= maximum && value.every(check);
export const dictionary = (check: Check, maximum = 20000): Check => value => record(value) && Object.keys(value).length <= maximum && Object.values(value).every(check);
export const shape = (required: Record<string, Check>, optional: Record<string, Check> = {}): Check => value => record(value)
  && Object.keys(value).every(key => Object.hasOwn(required, key) || Object.hasOwn(optional, key))
  && Object.entries(required).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]))
  && Object.entries(optional).every(([key, check]) => !Object.hasOwn(value, key) || check(value[key]));
export const sortedUnique = (values: string[]) => values.every((value, index) => index === 0 || values[index - 1]! < value);
export const unique = (values: string[]) => new Set(values).size === values.length;
export const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Bounded JSON only. No custom serializers, undefined values or lossy Unicode. */
export function canonical(value: unknown, maximum = receiptLimits.receiptBytes, depthLimit = receiptLimits.depth, budget?: OperationBudget): string {
  const parts: string[] = []; let size = 0;
  const add = (part: string) => { size += bytes(part); requireReceipt(size <= maximum, 'RECEIPT_BYTES_LIMIT'); parts.push(part); };
  const visit = (item: unknown, depth: number) => {
    budget?.check(); requireReceipt(depth <= depthLimit, 'RECEIPT_DEPTH_LIMIT');
    if (item === null || typeof item === 'boolean' || typeof item === 'number') {
      requireReceipt(typeof item !== 'number' || Number.isFinite(item)); add(JSON.stringify(item)); return;
    }
    if (typeof item === 'string') { requireReceipt(bytes(item) <= maximum, 'RECEIPT_BYTES_LIMIT'); requireReceipt(text(item)); add(JSON.stringify(item)); return; }
    if (Array.isArray(item)) {
      add('['); item.forEach((child, index) => { if (index) add(','); visit(child, depth + 1); }); add(']'); return;
    }
    requireReceipt(record(item) && [null, Object.prototype].includes(Object.getPrototypeOf(item)));
    add('{'); Object.keys(item).sort().forEach((key, index) => {
      requireReceipt(bytes(key) <= maximum, 'RECEIPT_BYTES_LIMIT'); requireReceipt(text(key)); if (index) add(','); add(JSON.stringify(key)); add(':'); visit(item[key], depth + 1);
    }); add('}');
  };
  visit(value, 0); return parts.join('');
}
export function parseJson(serialized: string, maximum: number, context: ReturnType<typeof receiptContext>): unknown {
  requireReceipt(typeof serialized === 'string'); const size = bytes(serialized);
  requireReceipt(size <= maximum, 'RECEIPT_BYTES_LIMIT'); requireReceipt(text(serialized)); context.budget.charge('receipt', size);
  let result: unknown;
  try { result = JSON.parse(serialized); } catch { throw new NativeReceiptError('CORRUPT_RECEIPT'); }
  // Bound traversal before shape validation or recursive comparisons. This also
  // rejects escaped lone surrogates and nonfinite numeric JSON values.
  canonical(result, maximum, context.limits.depth, context.budget); return result;
}
