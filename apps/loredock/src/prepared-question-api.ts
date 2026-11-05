import { CatalogError } from './types.js';
import { NativeReceiptError, uuid, hex } from './native-receipt-json.js';
import { OperationBudgetError } from './operation-budget.js';
import type { QuestionPreview } from './question-preparation-types.js';

export function questionFields(input: Record<string, unknown>, keys: string[]) {
  if (Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key)))
    throw new CatalogError('INVALID_REQUEST', 'Use only the fields required for this question operation.');
}
const requestId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export function preparationInput(input: Record<string, unknown>, publishedBuildId: string | null) {
  questionFields(input, ['requestId', 'question', 'buildId']);
  if (!requestId(input.requestId) || typeof input.question !== 'string' || !input.question.trim()
    || Buffer.byteLength(input.question, 'utf8') > 2000 || !uuid(input.buildId))
    throw new CatalogError('INVALID_REQUEST', 'Enter a question of at most 2,000 UTF-8 bytes and select the current index.');
  if (input.buildId !== publishedBuildId) throw new CatalogError('QUESTION_STALE', 'Select the current index, then find context again.', 409);
  return { requestId: input.requestId, question: input.question };
}
export function preparedAnswerInput(input: Record<string, unknown>) {
  questionFields(input, ['requestId', 'preparationId', 'reviewedHash']);
  if (!requestId(input.requestId) || !uuid(input.preparationId) || !hex(input.reviewedHash))
    throw new CatalogError('INVALID_REQUEST', 'Use the exact reviewed question context.');
  return { requestId: input.requestId, preparationId: input.preparationId as string, reviewedHash: input.reviewedHash as string };
}
export function preparationId(value: string) {
  if (!uuid(value)) throw new CatalogError('INVALID_REQUEST', 'Use a valid question preparation ID.');
  return value;
}
export function serializedQuestionReview(value: QuestionPreview) {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > 1024 * 1024)
    throw new CatalogError('QUESTION_RESPONSE_LIMIT', 'This context exceeds the review limit. Try a more specific question.', 409);
  return serialized;
}
/** Applied only to question/answer routes; existing path-capture errors stay unchanged. */
export function preparedQuestionError(error: Error) {
  if (error instanceof OperationBudgetError) {
    const messages: Record<string, string> = {
      CANCELLED: 'Context validation was cancelled. Find context again.',
      CAPTURE_TIME_LIMIT: 'Context validation reached its time limit. Try a more specific question.',
      CAPTURE_WORK_LIMIT: 'Context validation reached its work limit. Try a more specific question.',
    };
    return new CatalogError(messages[error.code] ? error.code : 'QUESTION_INPUT_INVALID',
      messages[error.code] ?? 'This context could not be validated. Find context again.', 409);
  }
  if (error instanceof NativeReceiptError)
    return new CatalogError('QUESTION_INPUT_INVALID', 'The saved question context is unavailable or no longer valid. Find context again.', 409);
  return undefined;
}
