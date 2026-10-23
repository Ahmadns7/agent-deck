import type { ChatMessage, ProviderConfig } from './types';

export type ProviderPreset = Omit<ProviderConfig, 'id' | 'apiKey'>;

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest' },
  { name: 'Ollama (local)', kind: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  { name: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { name: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
];

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function isValidBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeBaseUrl(url));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ChatRequest {
  url: string;
  init: RequestInit;
}

/** Builds the HTTP request for a streamed chat completion. Pure: no network I/O. */
export function buildChatRequest(provider: ProviderConfig, messages: ChatMessage[]): ChatRequest {
  if (!isValidBaseUrl(provider.baseUrl)) {
    throw new Error(`Invalid base URL for ${provider.name}: ${provider.baseUrl}`);
  }
  const base = normalizeBaseUrl(provider.baseUrl);

  if (provider.kind === 'anthropic') {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const body: Record<string, unknown> = {
      model: provider.model,
      max_tokens: 1024,
      stream: true,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map(({ role, content }) => ({ role, content })),
    };
    if (system) body.system = system;

    const origin = base.replace(/\/v1$/, '');
    return {
      url: `${origin}/v1/messages`,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      },
    };
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;

  return {
    url: `${base}/chat/completions`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages: messages.map(({ role, content }) => ({ role, content })),
        stream: true,
        stream_options: { include_usage: true },
      }),
    },
  };
}

export interface ModelPreset {
  id: string;
  provider: 'Groq' | 'Gemini';
  tier: 'free';
  /** Docs page the ID was verified against. */
  source: string;
}

const GROQ_DOCS = 'console.groq.com/docs/models';
const GEMINI_DOCS = 'ai.google.dev/gemini-api/docs/models';

/** Free-tier chat models verified against the official model docs on 2026-10-23. */
export const MODEL_PRESETS: ModelPreset[] = [
  { id: 'openai/gpt-oss-120b', provider: 'Groq', tier: 'free', source: GROQ_DOCS },
  { id: 'openai/gpt-oss-20b', provider: 'Groq', tier: 'free', source: GROQ_DOCS },
  { id: 'qwen/qwen3.8-27b', provider: 'Groq', tier: 'free', source: `${GROQ_DOCS} (preview)` },
  { id: 'gemini-3.5-flash-lite', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
  { id: 'gemini-3.1-flash-lite', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
  { id: 'gemini-3.6-flash', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
  { id: 'gemini-3.8-flash', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
  { id: 'gemini-2.5-flash', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
  { id: 'gemini-2.5-flash-lite', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
  { id: 'gemini-2.5-pro', provider: 'Gemini', tier: 'free', source: GEMINI_DOCS },
];
