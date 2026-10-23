import type { ChatMessage, ContentPart, ProviderConfig } from './types';

function contentToText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map((p) => (p.type === 'text' ? p.text : '')).join('\n');
}

/** Anthropic takes base64 image blocks rather than image_url data URLs. */
function toAnthropicContent(content: ChatMessage['content']): string | Record<string, unknown>[] {
  if (typeof content === 'string') return content;
  return content.map((part: ContentPart) => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    const match = /^data:([^;]+);base64,(.*)$/s.exec(part.image_url.url);
    if (!match) return { type: 'text', text: '[image not sent: unsupported encoding]' };
    return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
  });
}

export type ProviderPreset = Omit<ProviderConfig, 'id' | 'apiKey'>;

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-latest' },
  { name: 'Ollama (local)', kind: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  { name: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { name: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  { name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  // Direct cloud API (docs.ollama.com/api/authentication): Bearer key, OpenAI-compatible at /v1.
  { name: 'Ollama Cloud', kind: 'openai', baseUrl: 'https://ollama.com/v1', model: 'gpt-oss:120b' },
  // OpenAI-compatible, base url per openrouter.ai/docs/quickstart.
  { name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/free' },
  // Custom OpenAI-compatible endpoint from agentrouter.org's own docs (pi integration page). Unverified against an official API reference.
  { name: 'AgentRouter', kind: 'openai', baseUrl: 'https://agentrouter.org/v1', model: 'deepseek-v4-flash' },
];

/** Optional attribution headers OpenRouter documents for leaderboards; not required for auth. */
export const OPENROUTER_ATTRIBUTION_HEADERS: Record<string, string> = {
  'HTTP-Referer': 'https://github.com/Ahmadns7/agent-deck',
  'X-OpenRouter-Title': 'agent-deck',
};

export function isOpenRouterUrl(url: string): boolean {
  try {
    return new URL(normalizeBaseUrl(url)).hostname === 'openrouter.ai';
  } catch {
    return false;
  }
}

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
      .map((m) => contentToText(m.content))
      .join('\n\n');
    const body: Record<string, unknown> = {
      model: provider.model,
      max_tokens: 1024,
      stream: true,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map(({ role, content }) => ({ role, content: toAnthropicContent(content) })),
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
  if (isOpenRouterUrl(base)) Object.assign(headers, OPENROUTER_ATTRIBUTION_HEADERS);
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
  provider: 'Groq' | 'Gemini' | 'OpenRouter' | 'Ollama Cloud';
  tier: 'free' | 'cloud';
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
  // Ollama Cloud model names as shown in the API docs (docs.ollama.com/api/authentication, /cloud).
  { id: 'gpt-oss:120b', provider: 'Ollama Cloud', tier: 'cloud', source: 'docs.ollama.com/api/authentication' },
  { id: 'gemma4:31b', provider: 'Ollama Cloud', tier: 'cloud', source: 'docs.ollama.com/cloud' },
  // OpenRouter: openrouter/free is the documented free router (openrouter.ai/openrouter/free).
  { id: 'openrouter/free', provider: 'OpenRouter', tier: 'free', source: 'openrouter.ai/openrouter/free' },
  { id: 'openai/gpt-oss-20b:free', provider: 'OpenRouter', tier: 'free', source: 'third-party guide (UCSF LMA), not checked on openrouter.ai' },
];
