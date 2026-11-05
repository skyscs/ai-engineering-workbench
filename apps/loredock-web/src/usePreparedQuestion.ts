import { useEffect, useRef, useState } from 'react';
import type { AnswerAttempt } from '../../loredock/src/answers';
import type { QuestionPreparationState, QuestionPreview } from '../../loredock/src/question-preparation-types';
import { api, ApiError } from './api';

const delay = () => new Promise<void>(resolve => setTimeout(resolve, 250));
const explanation = (state: QuestionPreparationState) => {
  if (state.status === 'expired') return 'This context expired. Find context again.';
  if (state.status === 'fenced') return 'Sources, index or engineer review changed. Find context again.';
  if (state.status === 'consumed') return 'This context was already used. Find context for a new answer.';
  if (state.status === 'cancelled') return 'Context preparation was cancelled.';
  if (state.reason === 'CAPTURE_WORK_LIMIT' || state.reason === 'CAPTURE_TIME_LIMIT') return 'Context preparation reached its limit. Try a more specific question.';
  return 'Context could not be prepared. Find context again after checking source analysis.';
};
const refused = new Set(['INVALID_REQUEST', 'CONFIGURATION_REQUIRED', 'BUSY', 'QUESTION_BUSY', 'QUESTION_ANALYSIS_BUSY',
  'QUESTION_NOT_READY', 'QUESTION_NOT_FOUND', 'QUESTION_REVIEW_CHANGED', 'ANSWER_WITNESS_LIMIT', 'SERVICE_STOPPED', 'CONFLICT']);

/** One browser operation; all authoritative input remains with the server. */
export function usePreparedQuestion(binding: string, enabled: boolean) {
  const current = useRef(binding); current.current = binding;
  const generation = useRef(0), owned = useRef<string | undefined>(undefined);
  const startRequest = useRef<{ binding: string; requestId: string; question: string; buildId: string } | undefined>(undefined);
  const admission = useRef<{ requestId: string; preparationId: string; reviewedHash: string } | undefined>(undefined);
  const [value, setValue] = useState<{ binding: string; preview: QuestionPreview }>();
  const [finding, setFinding] = useState(false), [pending, setPending] = useState(false), [notice, setNotice] = useState('');
  const preview = value?.binding === binding ? value.preview : undefined;
  const cancelOwned = (id: string) => api(`/question-preparations/${id}/cancel`, 'POST', {});
  const discardOwned = () => {
    const id = owned.current; owned.current = undefined;
    if (id) void cancelOwned(id).catch(() => console.warn('Context cancellation could not be confirmed; the server still enforces its expiry.'));
  };
  useEffect(() => {
    generation.current++; setValue(undefined); setFinding(false); setPending(false); setNotice('');
    startRequest.current = undefined; admission.current = undefined;
    return () => { generation.current++; discardOwned(); };
  }, [binding, enabled]);
  async function find(question: string, buildId: string) {
    if (!enabled) return;
    const expected = binding, serial = ++generation.current;
    const live = () => generation.current === serial && current.current === expected;
    if (startRequest.current?.binding !== expected) discardOwned();
    admission.current = undefined; setPending(false); setValue(undefined); setNotice(''); setFinding(true);
    if (startRequest.current?.binding !== expected) startRequest.current = { binding: expected, requestId: crypto.randomUUID(), question, buildId };
    const { binding: _, ...input } = startRequest.current;
    try {
      let state = await api<QuestionPreparationState>('/question-preparations', 'POST', input);
      if (!live()) { void cancelOwned(state.id).catch(() => console.warn('Obsolete context cancellation could not be confirmed.')); return; }
      owned.current = state.id;
      while (state.status === 'preparing') {
        await delay(); if (!live()) return;
        state = await api<QuestionPreparationState>(`/question-preparations/${state.id}`);
        if (!live()) return;
      }
      startRequest.current = undefined;
      if (state.status !== 'ready') { owned.current = undefined; setNotice(explanation(state)); return; }
      const reviewed = await api<QuestionPreview>(`/question-preparations/${state.id}/review`);
      if (live()) setValue({ binding: expected, preview: reviewed });
    } catch (cause) {
      if (live()) {
        setNotice((cause as Error).message);
        if (cause instanceof ApiError) startRequest.current = undefined;
      }
    } finally { if (live()) setFinding(false); }
  }
  useEffect(() => {
    if (!enabled || !preview) return;
    let stopped = false, checking = false;
    const expected = binding, serial = generation.current, id = preview.id;
    const live = () => !stopped && current.current === expected && generation.current === serial;
    const timer = setInterval(() => {
      if (checking || admission.current) return; checking = true;
      void api<QuestionPreparationState>(`/question-preparations/${id}`).then(state => {
        if (live() && state.status !== 'ready') { setValue(undefined); setNotice(explanation(state)); owned.current = undefined; }
      }).catch(cause => { if (live()) { setValue(undefined); setNotice((cause as Error).message); } }).finally(() => { checking = false; });
    }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [enabled, binding, preview?.id]);
  async function cancel() {
    generation.current++; setFinding(false); setValue(undefined); startRequest.current = undefined;
    const id = owned.current; owned.current = undefined;
    setNotice('Context preparation was cancelled.');
    if (id) try { await cancelOwned(id); } catch (cause) { setNotice(`Cancellation could not be confirmed. ${(cause as Error).message}`); }
  }
  async function generate(): Promise<AnswerAttempt | undefined> {
    if (!enabled || (!preview && !admission.current)) return;
    const expected = binding, serial = generation.current;
    admission.current ??= { requestId: crypto.randomUUID(), preparationId: preview!.id, reviewedHash: preview!.reviewedHash! };
    setPending(true); setNotice('');
    try {
      const result = await api<AnswerAttempt>('/prepared-answers', 'POST', admission.current);
      if (current.current === expected && generation.current === serial) {
        admission.current = undefined; owned.current = undefined; setPending(false); setValue(undefined); return result;
      }
    } catch (cause) {
      if (current.current === expected && generation.current === serial && cause instanceof ApiError && refused.has(cause.code ?? '')) {
        admission.current = undefined; setPending(false);
        if (['QUESTION_NOT_READY', 'QUESTION_NOT_FOUND', 'QUESTION_REVIEW_CHANGED'].includes(cause.code!)) setValue(undefined);
      }
      throw cause;
    }
  }
  return { preview, finding, pending, notice, find, cancel, generate };
}
