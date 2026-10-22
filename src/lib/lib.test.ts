import { describe, expect, it } from 'vitest';
import { createSSEParser, type SSEEvent } from './sse';
import { computeTokensPerSecond, estimateTokens, formatDuration } from './stats';
import { buildChatRequest, isValidBaseUrl, normalizeBaseUrl } from './providers';
import { parseStreamEvent } from './parse';
import type { ProviderConfig } from './types';

function collect(chunks: string[]): SSEEvent[] {
  const events: SSEEvent[] = [];
  const parser = createSSEParser((e) => events.push(e));
  for (const c of chunks) parser.push(c);
  parser.flush();
  return events;
}

describe('createSSEParser', () => {
  it('parses events split across arbitrary chunk boundaries', () => {
    const events = collect(['da', 'ta: {"a":1}\n', '\ndata: {"b"', ':2}\n\n']);
    expect(events).toEqual([
      { event: undefined, data: '{"a":1}' },
      { event: undefined, data: '{"b":2}' },
    ]);
  });

  it('joins multi-line data, reads event names, and ignores comments and CRLF', () => {
    const events = collect([': keep-alive\r\nevent: message_start\r\ndata: line1\r\ndata: line2\r\n\r\n']);
    expect(events).toEqual([{ event: 'message_start', data: 'line1\nline2' }]);
  });
});

describe('estimateTokens / computeTokensPerSecond', () => {
  it('estimates about four characters per token', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('returns undefined when throughput cannot be computed', () => {
    expect(computeTokensPerSecond(100, 2000)).toBe(50);
    expect(computeTokensPerSecond(0, 2000)).toBeUndefined();
    expect(computeTokensPerSecond(10, 0)).toBeUndefined();
    expect(computeTokensPerSecond(Number.NaN, 1000)).toBeUndefined();
  });

  it('formats durations for display', () => {
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(420)).toBe('420 ms');
    expect(formatDuration(1500)).toBe('1.50 s');
  });
});

describe('providers', () => {
  const openai: ProviderConfig = {
    id: '1',
    name: 'Test',
    kind: 'openai',
    baseUrl: 'https://api.example.com/v1/',
    model: 'm',
    apiKey: 'sk-test',
  };

  it('normalizes trailing slashes and validates http(s) URLs only', () => {
    expect(normalizeBaseUrl(' https://x.io/v1/// ')).toBe('https://x.io/v1');
    expect(isValidBaseUrl('https://x.io/v1')).toBe(true);
    expect(isValidBaseUrl('ftp://x.io')).toBe(false);
    expect(isValidBaseUrl('not a url')).toBe(false);
  });

  it('builds an OpenAI-compatible request with the key only in the auth header', () => {
    const { url, init } = buildChatRequest(openai, [{ role: 'user', content: 'hi' }]);
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string).stream).toBe(true);
  });

  it('builds an Anthropic request that moves system prompts to the top-level field', () => {
    const anth: ProviderConfig = { ...openai, kind: 'anthropic', baseUrl: 'https://api.anthropic.com' };
    const { url, init } = buildChatRequest(anth, [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('be brief');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('refuses to build a request for an invalid base URL', () => {
    expect(() => buildChatRequest({ ...openai, baseUrl: 'javascript:alert(1)' }, [])).toThrow(/Invalid base URL/);
  });

  it('parses OpenAI and Anthropic stream events into normalized pieces', () => {
    const oa = parseStreamEvent('openai', { data: '{"choices":[{"delta":{"content":"Hi"}}]}' });
    expect(oa).toEqual({ delta: 'Hi' });
    const ant = parseStreamEvent('anthropic', {
      data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"yo"}}',
    });
    expect(ant).toEqual({ delta: 'yo' });
    expect(parseStreamEvent('openai', { data: '[DONE]' })).toEqual({ done: true });
    expect(() => parseStreamEvent('anthropic', { data: '{"type":"error","error":{"message":"boom"}}' })).toThrow('boom');
  });
});
