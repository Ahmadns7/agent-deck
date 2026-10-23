import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadJSON, saveJSON, isObjectArray, STORAGE_KEYS } from './storage';
import { createSSEParser, type SSEEvent } from './sse';
import { parseStreamEvent } from './parse';
import { runWithFallbackChain } from './fallback';

// Minimal in-memory localStorage so the storage paths run under node.
function installStorage(overrides?: Partial<Storage>) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size; },
    ...overrides,
  } as Storage;
  vi.stubGlobal('localStorage', storage);
  return data;
}

describe('loadJSON corrupt-storage recovery', () => {
  beforeEach(() => installStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('returns the fallback when nothing is stored', () => {
    expect(loadJSON('missing', ['x'])).toEqual(['x']);
  });

  it('returns the fallback for invalid JSON instead of throwing', () => {
    localStorage.setItem(STORAGE_KEYS.conversations, '{not json');
    expect(loadJSON(STORAGE_KEYS.conversations, [])).toEqual([]);
  });

  it('returns the fallback when the stored shape is wrong (string where an array belongs)', () => {
    localStorage.setItem(STORAGE_KEYS.providers, JSON.stringify('oops'));
    const fallback: unknown[] = [];
    expect(loadJSON(STORAGE_KEYS.providers, fallback, isObjectArray)).toBe(fallback);
  });

  it('rejects arrays containing non-object items so render never touches them', () => {
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify([{ id: 'a' }, null, 3]));
    expect(loadJSON(STORAGE_KEYS.conversations, [], isObjectArray)).toEqual([]);
  });

  it('keeps a valid object array untouched', () => {
    const good = [{ id: 'a', messages: [] }];
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(good));
    expect(loadJSON(STORAGE_KEYS.conversations, [], isObjectArray)).toEqual(good);
  });

  it('returns the fallback when storage access itself throws (privacy mode)', () => {
    vi.unstubAllGlobals();
    installStorage({
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(loadJSON('k', 'fallback')).toBe('fallback');
  });
});

describe('saveJSON quota handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports success when the write lands', () => {
    installStorage();
    expect(saveJSON('k', { a: 1 })).toBe(true);
    expect(JSON.parse(localStorage.getItem('k') as string)).toEqual({ a: 1 });
  });

  it('returns false instead of throwing when the quota is exceeded', () => {
    installStorage({
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });
    expect(saveJSON('k', 'x'.repeat(10))).toBe(false);
  });
});

describe('SSE parser edge cases', () => {
  function collect(chunks: string[]): SSEEvent[] {
    const events: SSEEvent[] = [];
    const parser = createSSEParser((e) => events.push(e));
    for (const chunk of chunks) parser.push(chunk);
    parser.flush();
    return events;
  }

  it('reassembles an event split across arbitrary chunk boundaries', () => {
    const events = collect(['da', 'ta: {"a"', ':1}\n', '\ndata: second\n\n']);
    expect(events.map((e) => e.data)).toEqual(['{"a":1}', 'second']);
  });

  it('handles CRLF line endings', () => {
    expect(collect(['data: one\r\n\r\ndata: two\r\n\r\n']).map((e) => e.data)).toEqual(['one', 'two']);
  });

  it('emits a final event even when the stream ends without a trailing blank line', () => {
    expect(collect(['data: tail']).map((e) => e.data)).toEqual(['tail']);
  });

  it('drops a truncated event cut off mid-line without emitting garbage', () => {
    // Stream dropped before the newline: the partial line is flushed as a line; it is JSON-invalid
    // and parseStreamEvent must treat it as nothing rather than throwing.
    const events = collect(['data: {"choices":[{"delta":{"content":"hel']);
    expect(events).toHaveLength(1);
    expect(parseStreamEvent('openai', events[0])).toBeNull();
  });

  it('ignores comments, keep-alives and unknown fields', () => {
    expect(collect([': ping\n\nid: 7\ndata: ok\n\n']).map((e) => e.data)).toEqual(['ok']);
  });

  it('joins multi-line data fields with newlines', () => {
    expect(collect(['data: a\ndata: b\n\n']).map((e) => e.data)).toEqual(['a\nb']);
  });
});

describe('parseStreamEvent malformed input', () => {
  it('returns null for non-JSON data without throwing', () => {
    expect(parseStreamEvent('openai', { data: 'not json' })).toBeNull();
  });

  it('throws a readable error when the provider reports an in-stream error', () => {
    const ev = { data: JSON.stringify({ type: 'error', error: { message: 'overloaded' } }) };
    expect(() => parseStreamEvent('anthropic', ev)).toThrow('overloaded');
  });

  it('recognises the [DONE] sentinel', () => {
    expect(parseStreamEvent('openai', { data: '[DONE]' })).toEqual({ done: true });
  });
});

describe('fallback chain abort and failure paths', () => {
  it('stops retrying once the caller aborted, even on a retryable error', async () => {
    let aborted = false;
    const attempt = vi.fn(async (item: string) => {
      if (item === 'a') {
        aborted = true;
        throw new Error('429 rate limit');
      }
      return 'ok';
    });
    const outcome = await runWithFallbackChain(['a', 'b'], attempt, () => aborted, (x) => x);
    expect(outcome.ok).toBe(false);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('reports every failure in order when all attempts fail', async () => {
    const outcome = await runWithFallbackChain(
      ['a', 'b'],
      async (item: string) => {
        throw new Error(`429 ${item}`);
      },
      () => false,
      (x) => x,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.failures.map((f) => f.label)).toEqual(['a', 'b']);
  });
});
