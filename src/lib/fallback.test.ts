import { describe, expect, it } from 'vitest';
import {
  defaultFallbackFor,
  DEFAULT_FALLBACK_MODELS,
  effectiveFallbacks,
  isRetryableLimitError,
  modelAttemptOrder,
  parseFallbackModels,
  runWithFallback,
} from './fallback';

describe('isRetryableLimitError', () => {
  it('triggers on 429 and 413 status text from streamChat errors', () => {
    expect(isRetryableLimitError('429 Too Many Requests: slow down')).toBe(true);
    expect(isRetryableLimitError('413 Payload Too Large: no details returned')).toBe(true);
    expect(isRetryableLimitError('413 : Request too large for model openai/gpt-oss-120b on tokens per minute (TPM): Limit 8000, Requested 29518')).toBe(true);
  });

  it('triggers on rate limit and too large wording without a status code', () => {
    expect(isRetryableLimitError('Rate limit reached for requests')).toBe(true);
    expect(isRetryableLimitError('rate_limit_exceeded')).toBe(true);
    expect(isRetryableLimitError('Request is too large')).toBe(true);
  });

  it('does not trigger on unrelated errors or on digits that merely contain 429/413', () => {
    expect(isRetryableLimitError('404 Not Found: model does not exist')).toBe(false);
    expect(isRetryableLimitError('401 Unauthorized: invalid api key')).toBe(false);
    expect(isRetryableLimitError('500 Internal Server Error')).toBe(false);
    expect(isRetryableLimitError('Stopped.')).toBe(false);
    expect(isRetryableLimitError('ref 14291 failed')).toBe(false);
  });
});

describe('parseFallbackModels', () => {
  it('splits on commas, trims blanks, and drops duplicates in order', () => {
    expect(parseFallbackModels(' a , b,,a ,  c ')).toEqual(['a', 'b', 'c']);
    expect(parseFallbackModels('')).toEqual([]);
    expect(parseFallbackModels(['x', ' y '])).toEqual(['x', 'y']);
  });
});

describe('modelAttemptOrder', () => {
  it('puts the primary first and never repeats it', () => {
    expect(modelAttemptOrder('m1', ['m2', 'm1', 'm3'])).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('defaults', () => {
  it('uses the Groq fallback chain only for Groq base urls', () => {
    expect(DEFAULT_FALLBACK_MODELS).toEqual(['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']);
    expect(DEFAULT_FALLBACK_MODELS).not.toContain('llama-3.1-8b-instant');
    expect(defaultFallbackFor({ baseUrl: 'https://api.groq.com/openai/v1' })).toEqual(DEFAULT_FALLBACK_MODELS);
    expect(defaultFallbackFor({ baseUrl: 'https://api.openai.com/v1' })).toEqual([]);
    expect(defaultFallbackFor({ baseUrl: 'http://localhost:11434/v1' })).toEqual([]);
  });

  it('prefers a saved list, including an empty one, over defaults', () => {
    expect(effectiveFallbacks({ baseUrl: 'https://api.groq.com/openai/v1' })).toEqual(DEFAULT_FALLBACK_MODELS);
    expect(effectiveFallbacks({ baseUrl: 'https://api.groq.com/openai/v1', fallbackModels: ['z'] })).toEqual(['z']);
    expect(effectiveFallbacks({ baseUrl: 'https://api.groq.com/openai/v1', fallbackModels: [] })).toEqual([]);
  });
});

describe('runWithFallback', () => {
  it('returns the first model that succeeds and records earlier failures', async () => {
    const tried: string[] = [];
    const outcome = await runWithFallback(['big', 'mid', 'small'], async (model) => {
      tried.push(model);
      if (model === 'big') throw new Error('413 Payload Too Large');
      return `ok:${model}`;
    });
    expect(tried).toEqual(['big', 'mid']);
    expect(outcome.ok).toBe(true);
    expect(outcome.model).toBe('mid');
    expect(outcome.value).toBe('ok:mid');
    expect(outcome.failures).toEqual([{ model: 'big', message: '413 Payload Too Large' }]);
  });

  it('falls through several 429s to the last model', async () => {
    const outcome = await runWithFallback(['a', 'b', 'c'], async (model) => {
      if (model !== 'c') throw new Error('429 Too Many Requests');
      return 'done';
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.model).toBe('c');
    expect(outcome.failures.map((f) => f.model)).toEqual(['a', 'b']);
  });

  it('does not fall back on non-limit errors such as a bad model id', async () => {
    const tried: string[] = [];
    const outcome = await runWithFallback(['missing', 'backup'], async (model) => {
      tried.push(model);
      throw new Error('404 Not Found: model does not exist');
    });
    expect(tried).toEqual(['missing']);
    expect(outcome.ok).toBe(false);
    expect(outcome.model).toBe('missing');
  });

  it('reports failure with every attempt when all models are limited', async () => {
    const outcome = await runWithFallback(['a', 'b'], async () => {
      throw new Error('429 Too Many Requests');
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.model).toBe('b');
    expect(outcome.failures).toHaveLength(2);
  });

  it('does not retry after the user stops the request', async () => {
    const tried: string[] = [];
    let aborted = false;
    const outcome = await runWithFallback(
      ['a', 'b'],
      async (model) => {
        tried.push(model);
        aborted = true;
        throw new Error('429 Too Many Requests');
      },
      () => aborted,
    );
    expect(tried).toEqual(['a']);
    expect(outcome.ok).toBe(false);
  });
});
