import { OperationBudget } from '../../apps/loredock/dist/operation-budget.js';
import { CaptureWork } from '../../apps/loredock/dist/native-capture-work.js';
import { decodeNativeReceipt } from '../../apps/loredock/dist/native-receipt.js';
import { assertAnswerReviewCurrent } from '../../apps/loredock/dist/answer-review.js';
import { bytes, hash, same, requireReceipt } from '../../apps/loredock/dist/native-receipt-json.js';
import { inputSpan, experimentalPrompt } from './compact.mjs';

// An offline retained witness, not a new production answer/history publication path.
// Revalidation uses issued bytes and current authorization only, never analysis/facts.
export async function revalidateWitness(catalog, issued, signal = new AbortController().signal) {
  const budget = new OperationBudget({ signal });
  try {
    const work = new CaptureWork(catalog, budget, signal, {}), { context, compact } = issued;
    requireReceipt(issued.catalogId === catalog.store.receipts.catalogId, 'RECEIPT_CATALOG_MISMATCH');
    const { inputHash, ...content } = context; requireReceipt(hash(JSON.stringify(content)) === inputHash, 'QUESTION_CONTEXT_HASH');
    const decoded = decodeNativeReceipt(Buffer.from(issued.receipt), issued.catalogId, budget);
    work.authorized(decoded.projection, decoded.receipt.dependencies);
    for (const saved of decoded.receipt.originals) { await work.step('originals'); requireReceipt(same(work.original(saved.id), saved)); }
    for (const span of context.spans) { await work.step('originals'); const original = work.original(span.id);
      requireReceipt(original.buildId === context.buildId && same(inputSpan(original), span), 'QUESTION_ORIGINAL_MISMATCH'); }
    requireReceipt(same(issued.dependencies, decoded.receipt.dependencies));
    requireReceipt(compact.item && compact.item.receiptHash === decoded.receipt.receiptHash
      && compact.item.projectionId === decoded.projection.projectionId && compact.item.lexicalInputHash === context.inputHash
      && hash(JSON.stringify(compact.item)) === compact.itemHash);
    const prompt = experimentalPrompt(context, compact.item); budget.charge('receipt', bytes(prompt));
    requireReceipt(prompt === issued.prompt && hash(prompt) === compact.promptHash);
    requireReceipt(issued.witnessHash === hash(JSON.stringify({ catalogId: issued.catalogId, lexicalInputHash: context.inputHash,
      receiptHash: decoded.receipt.receiptHash, itemHash: compact.itemHash, question: context.question, dependencies: issued.dependencies })));
    await work.step('handoff'); work.authorized(decoded.projection, decoded.receipt.dependencies);
    assertAnswerReviewCurrent(catalog, context.review); work.check();
    return { status: 'revalidated', witnessHash: issued.witnessHash, metrics: budget.stats() };
  } finally { budget.close(); }
}
