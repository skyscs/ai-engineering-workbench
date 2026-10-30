export interface CodeRange { start: number; end: number }
export interface SymbolFact extends CodeRange {
  key: string; name: string; qualifiedName: string; role: 'function' | 'vue-action' | 'amd-function' | 'java-method';
  exported: boolean; className?: string; parameterTypes?: string[];
}
export interface OperationFact extends CodeRange {
  owner: string; kind: 'http-request' | 'event-publish' | 'event-subscribe' | 'document-write';
  properties: Record<string, string>;
}
export interface CallFact { owner: string; local: string; imported: string; module: string }
export interface CodeFacts {
  symbols: SymbolFact[]; operations: OperationFact[]; calls: CallFact[];
  records: Record<string, string>; gaps: string[];
}
export const emptyFacts = (): CodeFacts => ({ symbols: [], operations: [], calls: [], records: Object.create(null) as Record<string, string>, gaps: [] });
