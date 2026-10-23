import { describe, expect, it } from 'vitest';
import {
  defaultFallbackFor,
  DEFAULT_FALLBACK_MODELS,
  effectiveFallbacks,
  isRetryableLimitError,
  modelAttemptOrder,
  parseFallbackModels,
  runWithFallback,
  resolveCrossProviderAttempts,
  runWithFallbackChain,
  isProviderUsable,
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

describe('runWithFallbackChain across providers', () => {
  it('falls through to another provider after every model on the first hits a limit', async () => {
    const calls: string[] = [];
    const items = [
      { label: 'groq: a' },
      { label: 'groq: b' },
      { label: 'gemini: c' },
    ];
    const out = await runWithFallbackChain(
      items,
      async (item) => {
        calls.push(item.label);
        if (item.label.startsWith('gemini')) return 'ok';
        throw new Error('429 Too Many Requests');
      },
      () => false,
      (item) => item.label,
    );
    expect(calls).toEqual(['groq: a', 'groq: b', 'gemini: c']);
    expect(out.ok).toBe(true);
    expect(out.label).toBe('gemini: c');
  });

  it('stops on a non-limit error and does not move to another provider', async () => {
    const calls: string[] = [];
    const out = await runWithFallbackChain(
      [{ label: 'groq: a' }, { label: 'gemini: c' }],
      async (item) => {
        calls.push(item.label);
        throw new Error('401 Unauthorized: invalid api key');
      },
      () => false,
      (item) => item.label,
    );
    expect(calls).toEqual(['groq: a']);
    expect(out.ok).toBe(false);
  });
});

describe('resolveCrossProviderAttempts', () => {
  const providers = [
    { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k1', model: 'm1', kind: 'openai' },
    { id: 'gem', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'k2', model: 'g1', kind: 'openai' },
    { id: 'nokey', name: 'No key', baseUrl: 'https://example.com/v1', apiKey: '', model: 'x', kind: 'openai' },
    { id: 'local', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'llama', kind: 'openai' },
  ];

  it('keeps configured providers with keys, in chain order, dropping the current one', () => {
    const out = resolveCrossProviderAttempts(
      [
        { providerId: 'gem', model: 'g1' },
        { providerId: 'groq', model: 'm2' },
        { providerId: 'gem', model: 'g1' },
      ],
      providers,
      'groq',
    );
    expect(out.map((a) => `${a.provider.id}:${a.model}`)).toEqual(['gem:g1']);
  });

  it('skips unknown providers, blank models, and keyless remote providers, but keeps localhost', () => {
    const out = resolveCrossProviderAttempts(
      [
        { providerId: 'missing', model: 'x' },
        { providerId: 'nokey', model: 'x' },
        { providerId: 'gem', model: '  ' },
        { providerId: 'local', model: 'llama' },
      ],
      providers,
      'groq',
    );
    expect(out.map((a) => a.provider.id)).toEqual(['local']);
  });
});

describe('isProviderUsable', () => {
  it('needs a key unless it is a localhost OpenAI-compatible endpoint', () => {
    expect(isProviderUsable({ apiKey: '', baseUrl: 'https://x.com/v1', kind: 'openai' })).toBe(false);
    expect(isProviderUsable({ apiKey: 'k', baseUrl: 'https://x.com/v1', kind: 'openai' })).toBe(true);
    expect(isProviderUsable({ apiKey: '', baseUrl: 'http://localhost:11434/v1', kind: 'openai' })).toBe(true);
  });
});
