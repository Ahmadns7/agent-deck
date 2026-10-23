import { describe, expect, it } from 'vitest';
import {
  agentRouterHint,
  autoFillFallbackChain,
  buildModelsRequest,
  efficiencyScore,
  isAgentRouterUrl,
  parseModelsResponse,
  parseSizeB,
  sortByEfficiency,
  type ModelInfo,
} from './models';

const m = (id: string, extra: Partial<ModelInfo> = {}): ModelInfo => ({
  id,
  free: false,
  sizeB: parseSizeB(id),
  ...extra,
});

describe('parseSizeB', () => {
  it('reads parameter counts from common name shapes', () => {
    expect(parseSizeB('openai/gpt-oss-20b')).toBe(20);
    expect(parseSizeB('qwen/qwen3.8-27b')).toBe(27);
    expect(parseSizeB('llama-3.1-8b-instant')).toBe(8);
    expect(parseSizeB('gemma4:31b')).toBe(31);
    expect(parseSizeB('mistralai/mixtral-8x7b')).toBe(56);
  });
  it('returns undefined when no size is in the name', () => {
    expect(parseSizeB('gemini-2.5-flash')).toBeUndefined();
    expect(parseSizeB('openrouter/free')).toBeUndefined();
  });
});

describe('efficiencyScore and sortByEfficiency', () => {
  it('ranks smaller models ahead of larger ones', () => {
    const sorted = sortByEfficiency([m('qwen/qwen3.8-27b'), m('openai/gpt-oss-120b'), m('openai/gpt-oss-20b')]);
    expect(sorted.map((x) => x.id)).toEqual(['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b']);
  });
  it('halves the effective size for fast/small variant names', () => {
    expect(efficiencyScore(m('llama-3.1-8b-instant'))).toBe(4);
    expect(efficiencyScore(m('llama-3.1-8b'))).toBe(8);
  });
  it('puts free models ahead of paid ones regardless of size', () => {
    const sorted = sortByEfficiency([m('paid-7b'), m('big-120b:free', { free: true })]);
    expect(sorted[0].id).toBe('big-120b:free');
  });
  it('breaks size ties by larger context first', () => {
    const sorted = sortByEfficiency([
      m('a-8b', { contextLength: 8000 }),
      m('b-8b', { contextLength: 128000 }),
    ]);
    expect(sorted[0].id).toBe('b-8b');
  });
  it('treats unknown-size models as neutral (30B), not tiny', () => {
    expect(efficiencyScore(m('gemini-2.5-flash'))).toBe(30 * 0.5); // flash is a fast-variant name
    expect(efficiencyScore(m('some-model'))).toBe(30);
  });
});

describe('autoFillFallbackChain', () => {
  it('drops the primary, skips non-chat ids, and orders most efficient first', () => {
    const models = [
      m('gpt-oss-120b'),
      m('gpt-oss-20b'),
      m('llama-guard-4-12b'),
      m('whisper-large-v3'),
      m('qwen3.8-27b'),
    ];
    expect(autoFillFallbackChain(models, 'gpt-oss-120b')).toEqual(['gpt-oss-20b', 'qwen3.8-27b']);
  });
  it('uses only free-flagged models when the provider flags any (openrouter)', () => {
    const models = [
      m('meta/llama-3.1-8b:free', { free: true }),
      m('openai/gpt-4o'),
      m('mistral/small-24b:free', { free: true }),
    ];
    expect(autoFillFallbackChain(models, 'openrouter/free')).toEqual([
      'meta/llama-3.1-8b:free',
      'mistral/small-24b:free',
    ]);
  });
});

describe('parseModelsResponse', () => {
  it('reads OpenAI-shape data arrays and marks :free slugs', () => {
    const out = parseModelsResponse({
      data: [{ id: 'openai/gpt-oss-20b:free', context_length: 131072 }, { id: 'openai/gpt-4o' }],
    });
    expect(out[0]).toMatchObject({ id: 'openai/gpt-oss-20b:free', free: true, sizeB: 20, contextLength: 131072 });
    expect(out[1].free).toBe(false);
  });
  it('treats zero pricing as free', () => {
    const out = parseModelsResponse({ data: [{ id: 'x/y', pricing: { prompt: '0', completion: '0' } }] });
    expect(out[0].free).toBe(true);
  });
  it('strips the models/ prefix Gemini adds and de-duplicates', () => {
    const out = parseModelsResponse({ data: [{ id: 'models/gemini-2.5-flash' }, { id: 'gemini-2.5-flash' }] });
    expect(out.map((x) => x.id)).toEqual(['gemini-2.5-flash']);
  });
  it('returns empty for an unexpected body', () => {
    expect(parseModelsResponse({ error: 'nope' })).toEqual([]);
    expect(parseModelsResponse(null)).toEqual([]);
  });
});

describe('buildModelsRequest', () => {
  it('sends the key as Bearer to {baseUrl}/models for OpenAI-compatible providers', () => {
    const req = buildModelsRequest({
      name: 'Groq',
      kind: 'openai',
      baseUrl: 'https://api.groq.com/openai/v1/',
      apiKey: 'k',
    });
    expect(req.url).toBe('https://api.groq.com/openai/v1/models');
    expect(req.init.method).toBe('GET');
    expect((req.init.headers as Record<string, string>).authorization).toBe('Bearer k');
  });
  it('uses x-api-key on /v1/models for Anthropic', () => {
    const req = buildModelsRequest({ name: 'A', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'k' });
    expect(req.url).toBe('https://api.anthropic.com/v1/models');
    expect((req.init.headers as Record<string, string>)['x-api-key']).toBe('k');
  });
  it('rejects an invalid base url', () => {
    expect(() => buildModelsRequest({ name: 'X', kind: 'openai', baseUrl: 'ftp://x', apiKey: '' })).toThrow();
  });
});

describe('agentrouter hint', () => {
  it('detects the agentrouter host only', () => {
    expect(isAgentRouterUrl('https://agentrouter.org/v1')).toBe(true);
    expect(isAgentRouterUrl('https://notagentrouter.org/v1')).toBe(false);
  });
  it('gives the discord hint on 401 from agentrouter, nothing elsewhere', () => {
    expect(agentRouterHint('https://agentrouter.org/v1', 401)).toContain('https://discord.gg/HgekCyHJqB');
    expect(agentRouterHint('https://api.groq.com/openai/v1', 401)).toBe('');
    expect(agentRouterHint('https://agentrouter.org/v1', 500)).toBe('');
  });
});
