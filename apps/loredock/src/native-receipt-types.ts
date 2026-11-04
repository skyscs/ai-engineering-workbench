import type { BuildSource, Evidence } from './types.js';
import type { CodePathsAvailableV2, CodePathGraphV2 } from './code-paths-v2-types.js';

export type ReceiptOriginal = Omit<Evidence, 'snippet' | 'metadata'>;
export type ReceiptDependency = Pick<BuildSource, 'sourceId' | 'name' | 'revision' | 'tree' | 'status' | 'omitted'>;
export interface ReceiptProjection extends CodePathsAvailableV2 { kind: 'paths'; graph: CodePathGraphV2 }
export interface NativeReceiptContent {
  schemaVersion: 'loredock-code-path-receipt/1'; catalogId: string; projectionJson: string;
  originals: ReceiptOriginal[]; dependencies: ReceiptDependency[];
}
export interface NativeReceipt extends NativeReceiptContent { receiptHash: string }
/** Structural integrity only; a service must separately reopen current authorization. */
export interface DecodedNativeReceipt { receipt: NativeReceipt; projection: ReceiptProjection; serialized: string }
