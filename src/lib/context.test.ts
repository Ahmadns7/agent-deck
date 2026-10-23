import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTEXT_BUDGET, estimateRequestTokens, trimToBudget } from './context';
import type { ChatMessage } from './types';

/** A message whose estimate is exactly `tokens` (content length 4 * (tokens - 4) chars, plus 4 overhead). */
function msg(role: ChatMessage['role'], tokens: number, tag = ''): ChatMessage {
  const chars = Math.max(0, (tokens - 4) * 4);
  const body = tag + 'x'.repeat(Math.max(0, chars - tag.length));
  return { role, content: body };
}

describe('trimToBudget', () => {
  it('leaves a request that already fits untouched', () => {
    const messages = [msg('user', 100), msg('assistant', 100), msg('user', 100)];
    const result = trimToBudget(messages, 1000);
    expect(result.dropped).toBe(0);
    expect(result.messages).toBe(messages);
    expect(result.overBudget).toBe(false);
  });

  it('drops the oldest messages until the estimate fits the budget', () => {
    const messages = [
      msg('user', 1000, 'A'),
      msg('assistant', 1000, 'B'),
      msg('user', 1000, 'C'),
      msg('assistant', 1000, 'D'),
      msg('user', 1000, 'E'),
    ];
    const result = trimToBudget(messages, 2500);
    // Dropping 3 oldest fits, but that would leave an assistant message first, so it is dropped too.
    expect(result.messages).toEqual([messages[4]]);
    expect(result.dropped).toBe(4);
    expect(result.estimatedTokens).toBe(1000);
    expect(result.overBudget).toBe(false);
    expect(result.messages[result.messages.length - 1]).toBe(messages[4]);
  });

  it('keeps as many recent messages as fit when the oldest kept one is a user message', () => {
    const messages = [msg('user', 1000, 'A'), msg('assistant', 1000, 'B'), msg('user', 1000, 'C'), msg('assistant', 100, 'D'), msg('user', 100, 'E')];
    const result = trimToBudget(messages, 1500);
    expect(result.messages).toEqual([messages[2], messages[3], messages[4]]);
    expect(result.dropped).toBe(2);
    expect(result.estimatedTokens).toBe(1200);
  });

  it('never starts the trimmed history with an assistant message', () => {
    const messages = [msg('user', 1000), msg('assistant', 1000), msg('user', 1000), msg('assistant', 100), msg('user', 100)];
    const result = trimToBudget(messages, 2500);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[result.messages.length - 1]).toBe(messages[4]);
  });

  it('keeps every system message and drops only conversation messages', () => {
    const system = msg('system', 200, 'SYS');
    const messages = [system, msg('user', 1000), msg('assistant', 1000), msg('user', 1000), msg('user', 100)];
    const result = trimToBudget(messages, 1500);
    expect(result.messages[0]).toBe(system);
    expect(result.messages[result.messages.length - 1]).toBe(messages[4]);
    expect(result.messages.filter((m) => m.role === 'system')).toHaveLength(1);
    expect(result.estimatedTokens).toBeLessThanOrEqual(1500);
  });

  it('keeps the newest message even when it alone exceeds the budget and reports overBudget', () => {
    const messages = [msg('user', 100), msg('assistant', 100), msg('user', 9000)];
    const result = trimToBudget(messages, 6000);
    expect(result.messages).toEqual([messages[2]]);
    expect(result.dropped).toBe(2);
    expect(result.overBudget).toBe(true);
  });

  it('reports overBudget when a large system prompt alone does not fit', () => {
    const messages = [msg('system', 7000), msg('user', 100)];
    const result = trimToBudget(messages, 6000);
    expect(result.overBudget).toBe(true);
    expect(result.messages).toHaveLength(2);
  });

  it('falls back to the default budget for invalid budgets', () => {
    const messages = [msg('user', DEFAULT_CONTEXT_BUDGET + 500)];
    expect(trimToBudget(messages, 0).overBudget).toBe(true);
    expect(trimToBudget(messages, Number.NaN).messages).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const messages = [msg('user', 1000), msg('assistant', 1000), msg('user', 100)];
    const copy = [...messages];
    trimToBudget(messages, 500);
    expect(messages).toEqual(copy);
  });

  it('estimated tokens match estimateRequestTokens on the returned messages', () => {
    const messages = [msg('user', 800), msg('assistant', 800), msg('user', 800), msg('user', 200)];
    const result = trimToBudget(messages, 1200);
    expect(result.estimatedTokens).toBe(estimateRequestTokens(result.messages));
  });
});
