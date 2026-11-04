import { pathRequest } from './code-paths.js';
import type { NativeCaptures } from './native-capture.js';
import { NativeReceiptError } from './native-receipt-json.js';
import { CatalogError } from './types.js';

export type PathCaptureResult = Awaited<ReturnType<NativeCaptures['capture']>>;
export type PathHistoryResult = Awaited<ReturnType<NativeCaptures['history']>>;

export function captureSelection(parameters: URLSearchParams, text: string) {
  if (text.trim()) throw new CatalogError('INVALID_REQUEST', 'Saving a path takes query parameters and an empty body.');
  return pathRequest(parameters, 'paths');
}

export function historyReceiptId(id: string, parameters: URLSearchParams, headers: Headers) {
  // The Node Fetch adapter omits GET bodies; reject their framing before service work.
  if (parameters.size || headers.has('transfer-encoding')
    || (headers.has('content-length') && headers.get('content-length') !== '0')) {
    throw new CatalogError('INVALID_REQUEST', 'Opening a saved path takes only its receipt ID and no body.');
  }
  if (!/^[a-f0-9]{64}$/.test(id)) throw new CatalogError('INVALID_RECEIPT_ID', 'Choose an issued saved-path receipt ID.');
  return id;
}

const knownErrors = new Map<string, { status: 400 | 404 | 409; message: string }>([
  ['INVALID_RECEIPT_SELECTION', { status: 400, message: 'Choose an index and a matching saved path generation.' }],
  ['INVALID_RECEIPT_ID', { status: 400, message: 'Choose an issued saved-path receipt ID.' }],
  ['RECEIPT_NOT_FOUND', { status: 404, message: 'The saved path is unavailable.' }],
  ['CAPTURE_BUSY', { status: 409, message: 'A saved-path operation is active. Retry after it completes.' }],
  ['RECEIPT_STORAGE_BUSY', { status: 409, message: 'Saved-path storage is busy. Retry after the active operation completes.' }],
  ['SERVICE_STOPPED', { status: 409, message: 'Saved-path operations are stopping.' }],
  ['RECEIPT_UNAVAILABLE', { status: 409, message: 'No compatible path can be saved. Inspect Code coverage.' }],
  ['CAPTURE_STORAGE_FULL', { status: 409, message: 'Saved-path storage is full. Existing records are retained.' }],
  ['RECEIPT_FENCED', { status: 409, message: 'Sources or policy changed during the saved-path operation. Refresh and retry.' }],
  ['RECEIPT_SCOPE_FENCED', { status: 409, message: 'The saved path source scope is no longer authorized.' }],
  ['RECEIPT_BYTES_LIMIT', { status: 409, message: 'This selection exceeds the saved-path size limit.' }],
  ['RECEIPT_TEXT_LIMIT', { status: 409, message: 'This selection exceeds the saved original-text limit.' }],
  ['RECEIPT_SOURCE_LIMIT', { status: 409, message: 'This selection exceeds the saved source-count limit.' }],
  ['CANCELLED', { status: 409, message: 'The saved-path request was cancelled.' }],
  ['CAPTURE_TIME_LIMIT', { status: 409, message: 'The saved-path request reached its time limit.' }],
  ['CAPTURE_WORK_LIMIT', { status: 409, message: 'The saved-path request reached its work limit.' }],
]);

export function nativeCaptureError(error: Error) {
  if (!(error instanceof NativeReceiptError)) return undefined;
  const known = knownErrors.get(error.code);
  return known ? { status: known.status, error: { code: error.code, message: known.message } } : undefined;
}
