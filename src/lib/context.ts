import { estimateTokens } from './stats';
import type { ChatMessage } from './types';

/** Default per-request token budget. Sits under Groq's free-tier 8000 TPM limit with room for the reply. */
export const DEFAULT_CONTEXT_BUDGET = 6000;

/** Rough per-message overhead for role and framing tokens. */
const PER_MESSAGE_OVERHEAD = 4;

export interface TrimResult {
  /** Messages to send, in original order. */
  messages: ChatMessage[];
  /** How many non-system messages were dropped from the oldest end. */
  dropped: number;
  /** Estimated tokens of the returned messages. */
  estimatedTokens: number;
  /** True when even the trimmed request is still above the budget (for example, a huge system prompt). */
  overBudget: boolean;
}

export function estimateMessageTokens(message: ChatMessage): number {
  return estimateTokens(message.content) + PER_MESSAGE_OVERHEAD;
}

export function estimateRequestTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

/**
 * Drops the oldest non-system messages until the estimated request fits the budget.
 * All system messages are kept. The newest message is always kept, and the remaining
 * history never starts with an assistant message (some providers reject that).
 * Pure: the input array is not modified.
 */
export function trimToBudget(messages: ChatMessage[], budget: number): TrimResult {
  const limit = Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_CONTEXT_BUDGET;
  const total = estimateRequestTokens(messages);
  if (total <= limit) {
    return { messages, dropped: 0, estimatedTokens: total, overBudget: false };
  }

  const system = messages.filter((m) => m.role === 'system');
  const convo = messages.filter((m) => m.role !== 'system');
  const systemTokens = estimateRequestTokens(system);

  let convoTokens = estimateRequestTokens(convo);
  let start = 0;
  while (start < convo.length - 1 && systemTokens + convoTokens > limit) {
    convoTokens -= estimateMessageTokens(convo[start]);
    start++;
  }
  while (start < convo.length - 1 && convo[start].role === 'assistant') {
    convoTokens -= estimateMessageTokens(convo[start]);
    start++;
  }

  const keep = new Set(convo.slice(start));
  const kept = messages.filter((m) => m.role === 'system' || keep.has(m));
  const estimatedTokens = systemTokens + convoTokens;
  return {
    messages: kept,
    dropped: start,
    estimatedTokens,
    overBudget: estimatedTokens > limit,
  };
}
