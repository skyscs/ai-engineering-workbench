import { pathRequest } from './code-paths.js';
import type { NativeCaptures } from './native-capture.js';
import { NativeReceiptError } from './native-receipt-json.js';
import { CatalogError } from './types.js';
import { captureListRequest, type CaptureListRequest } from './native-capture-list.js';

export type PathCaptureResult = Awaited<ReturnType<NativeCaptures['capture']>>;
export type PathHistoryResult = Awaited<ReturnType<NativeCaptures['history']>>;
export type PathCaptureListResult = Awaited<ReturnType<NativeCaptures['list']>>;

export function captureListSelection(parameters: URLSearchParams, headers: Headers): CaptureListRequest {
  if (headers.has('transfer-encoding') || (headers.has('content-length') && headers.get('content-length') !== '0'))
    throw new CatalogError('INVALID_REQUEST', 'Listing saved paths takes no body.');
  if (Buffer.byteLength(parameters.toString(), 'utf8') > 1024) throw new CatalogError('INVALID_CAPTURE_LIST', 'The saved-path page request is too large.');
  for (const key of parameters.keys()) if (!['pageSize', 'generationId', 'offset'].includes(key) || parameters.getAll(key).length !== 1)
    throw new CatalogError('INVALID_CAPTURE_LIST', 'Choose an available saved-path page.');
  const selection: CaptureListRequest = {};
  if (parameters.has('pageSize')) {
    const size = parameters.get('pageSize');
    if (size !== '1' && size !== '4') throw new CatalogError('INVALID_CAPTURE_LIST', 'Choose a supported saved-path page size.');
    selection.pageSize = size === '1' ? 1 : 4;
  }
  if (parameters.has('generationId')) selection.generationId = parameters.get('generationId')!;
  if (parameters.has('offset')) {
    const offset = parameters.get('offset')!;
    if (!/^(0|[1-9]\d?)$/.test(offset)) throw new CatalogError('INVALID_CAPTURE_LIST', 'Choose an available saved-path page.');
    selection.offset = Number(offset);
  }
  captureListRequest(selection); return selection;
}

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
  ['INVALID_CAPTURE_LIST', { status: 400, message: 'Choose an available saved-path page.' }],
  ['CAPTURE_LIST_CHANGED', { status: 409, message: 'Saved paths changed. Refresh the list to continue.' }],
  ['CAPTURE_LIST_BYTES_LIMIT', { status: 409, message: 'This saved-path page is too large. Show one saved path at a time.' }],
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
