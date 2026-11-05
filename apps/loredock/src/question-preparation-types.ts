import type { AnswerContext } from './answer-context.js';
import type { CodePathGraphV2 } from './code-paths-v2-types.js';
import type { FlowNode, FlowEdge, StaticFlow } from './code-flow-types.js';
import type { HeaderCheck } from './http-headers.js';
import type { ReceiptDependency } from './native-receipt-types.js';
import type { SelectionObservation } from './question-path-selection.js';

export const questionPreparationVersion = 'loredock-prepared-question/1';
export const legacyQuestionCompactVersion = 'native-question-item/1';
export const questionCompactVersion = 'native-question-item/2';
export const legacyQuestionPromptVersion = 'loredock-prepared-answer-v1';
export const questionPromptVersion = 'loredock-prepared-answer-v2';
export type QuestionPromptVersion = typeof legacyQuestionPromptVersion | typeof questionPromptVersion;
export type QuestionCompactVersion = typeof legacyQuestionCompactVersion | typeof questionCompactVersion;
export const questionWitnessVersion = 'loredock-prepared-witness/1';
export const questionPreparationLimits = Object.freeze({ readyMs: 10 * 60 * 1000, metadataBytes: 1024, retainedBytes: 1024 * 1024, witnessBytes: 768 * 1024 });
export interface CompactTopicWitness {
  rule: string; value: string;
  publisher: { expression: string; evidenceIds: number[] };
  subscriber: { expression: string; evidenceIds: number[] };
}
export type CompactNode = [FlowNode['kind'], string, number, number, Record<string, string>, number[]];
export type CompactEdge<Header = HeaderCheck> = [FlowEdge['kind'], number, number, FlowEdge['status'], string, string | null, string[], number[], Header | null, CompactTopicWitness | null];
export interface NativeQuestionItemV1 {
  schemaVersion: typeof legacyQuestionCompactVersion; provenance: 'static-analysis'; verification: 'unverified'; currentApplicability: 'not-checked';
  receiptHash: string; projectionId: string; lexicalInputHash: string; selectionVersion: string; flowId: string; originals: string[];
  nodeColumns: string[]; nodes: CompactNode[]; edgeColumns: string[]; edges: CompactEdge[];
  flow: Pick<StaticFlow, 'title' | 'status' | 'environment' | 'gaps'> & { nodeIndexes: number[]; edgeIndexes: number[]; evidenceIndexes: number[] };
  partial: true; deploymentCoherence: 'unknown'; gaps: string[]; omissions: Record<string, number>; declarationOmissions: Record<string, number>;
  coverage: CodePathGraphV2['coverage']; limits: CodePathGraphV2['limits']; duplicateClues: { legacyId: string; nativeEdge: number }[];
}
export interface LegacyHeaderReference { legacyHeader: number }
export interface NativeQuestionItemV2 extends Omit<NativeQuestionItemV1, 'schemaVersion' | 'lexicalInputHash' | 'edges' | 'duplicateClues'> {
  schemaVersion: typeof questionCompactVersion;
  edges: CompactEdge<HeaderCheck | LegacyHeaderReference>[];
  duplicateClues: [legacyComparisonIndex: number, nativeEdgeIndex: number][];
}
export type NativeQuestionItem = NativeQuestionItemV1 | NativeQuestionItemV2;
export interface NativeQuestionCompact {
  item: NativeQuestionItem | null; reason: string | null; missing?: string[]; attemptedBytes?: number;
  derivedBytes?: number; promptBytes?: number; itemHash?: string; promptHash?: string;
  duplicateClues?: NativeQuestionItem['duplicateClues'];
}
export interface QuestionWitness {
  schemaVersion: typeof questionWitnessVersion; compositionVersion: typeof questionPreparationVersion;
  promptVersion: QuestionPromptVersion; catalogId: string; lexicalInputHash: string;
  receipt: string | null; compact: NativeQuestionCompact; selection: SelectionObservation | null;
  dependencies: ReceiptDependency[]; sourceIds: string[]; prompt: string; promptHash: string;
}
/** Server-held bytes; callers receive copies, never the owner's mutable context. */
export interface QuestionSnapshot {
  readonly contextJson: string; readonly witnessJson: string; readonly reviewedHash: string; readonly retainedBytes: number;
}
export type QuestionPreparationStatus = 'preparing' | 'ready' | 'cancelled' | 'failed' | 'expired' | 'fenced' | 'consumed';
export interface QuestionPreparationState {
  id: string; requestId: string; status: QuestionPreparationStatus; reason: string | null; reviewedHash: string | null;
}
export interface QuestionPreview extends QuestionPreparationState {
  context: AnswerContext; compact: NativeQuestionCompact; selection: SelectionObservation | null; promptVersion: QuestionPromptVersion;
}
