import { describe, expect, it } from 'vitest';
import { buildChatRequest } from './providers';
import { clampMaxTokens, clampTemperature, FONT_SIZES, normalizeFontSize } from './chatSettings';
import type { ProviderConfig } from './types';

const base: ProviderConfig = {
  id: 'p',
  name: 'Test',
  kind: 'openai',
  baseUrl: 'https://example.com/v1',
  model: 'm',
  apiKey: 'k',
};

describe('clampTemperature', () => {
  it('keeps values in the 0 to 2 range, rounded to two decimals', () => {
    expect(clampTemperature(0.734)).toBe(0.73);
    expect(clampTemperature(-1)).toBe(0);
    expect(clampTemperature(9)).toBe(2);
    expect(clampTemperature(Number.NaN)).toBeUndefined();
  });
});

describe('clampMaxTokens', () => {
  it('requires a positive whole number', () => {
    expect(clampMaxTokens(512.9)).toBe(512);
    expect(clampMaxTokens(0)).toBeUndefined();
    expect(clampMaxTokens(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('normalizeFontSize', () => {
  it('accepts the three sizes and falls back to medium', () => {
    expect(normalizeFontSize('small')).toBe('small');
    expect(normalizeFontSize('large')).toBe('large');
    expect(normalizeFontSize('huge')).toBe('medium');
    expect(FONT_SIZES.medium).toBe(16);
  });
});

describe('buildChatRequest tuning', () => {
  it('sends temperature and max_tokens to OpenAI-compatible providers when set', () => {
    const req = buildChatRequest({ ...base, temperature: 0.2, maxTokens: 300 }, [{ role: 'user', content: 'hi' }]);
    const body = JSON.parse(req.init.body as string) as Record<string, unknown>;
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(300);
  });

  it('omits tuning fields when they are unset', () => {
    const req = buildChatRequest(base, [{ role: 'user', content: 'hi' }]);
    const body = JSON.parse(req.init.body as string) as Record<string, unknown>;
    expect('temperature' in body).toBe(false);
    expect('max_tokens' in body).toBe(false);
  });

  it('uses the configured max tokens for Anthropic and clamps temperature to 1', () => {
    const req = buildChatRequest(
      { ...base, kind: 'anthropic', baseUrl: 'https://api.anthropic.com', maxTokens: 2048, temperature: 1.7 },
      [{ role: 'user', content: 'hi' }],
    );
    const body = JSON.parse(req.init.body as string) as Record<string, unknown>;
    expect(body.max_tokens).toBe(2048);
    expect(body.temperature).toBe(1);
  });

  it('keeps Anthropic default max tokens at 1024 when unset', () => {
    const req = buildChatRequest({ ...base, kind: 'anthropic', baseUrl: 'https://api.anthropic.com' }, [{ role: 'user', content: 'hi' }]);
    const body = JSON.parse(req.init.body as string) as Record<string, unknown>;
    expect(body.max_tokens).toBe(1024);
  });
});
