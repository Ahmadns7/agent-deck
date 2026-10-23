import { normalizeBaseUrl, isValidBaseUrl } from './providers';
import type { ProviderConfig } from './types';

/** One model returned by a provider's GET /models endpoint, normalized. */
export interface ModelInfo {
  id: string;
  /** True when the response marks it free (openrouter ':free' slug or zero pricing). Unknown otherwise. */
  free: boolean;
  /** Parameter count in billions parsed from the name (e.g. 'gpt-oss-20b' -> 20), if present. */
  sizeB?: number;
  /** Context window in tokens, when the response includes it. */
  contextLength?: number;
}

export interface ModelsRequest {
  url: string;
  init: RequestInit;
}

/**
 * Builds GET {baseUrl}/models with the saved key.
 * OpenAI-compatible providers use `Authorization: Bearer`. Anthropic uses `x-api-key` on /v1/models.
 * Local Ollama needs no key.
 */
export function buildModelsRequest(provider: Pick<ProviderConfig, 'name' | 'kind' | 'baseUrl' | 'apiKey'>): ModelsRequest {
  if (!isValidBaseUrl(provider.baseUrl)) {
    throw new Error(`Invalid base URL for ${provider.name}: ${provider.baseUrl}`);
  }
  const base = normalizeBaseUrl(provider.baseUrl);
  if (provider.kind === 'anthropic') {
    const origin = base.replace(/\/v1$/, '');
    return {
      url: `${origin}/v1/models`,
      init: {
        method: 'GET',
        headers: {
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      },
    };
  }
  const headers: Record<string, string> = {};
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
  return { url: `${base}/models`, init: { method: 'GET', headers } };
}

/**
 * Hint shown when a provider rejects the key on /models or chat. agentrouter.org returns
 * "401 Unauthorized: unauthorized client detected" for a valid key, which we read as a
 * client allowlist (the endpoint refuses clients it has not approved), not a bad key.
 */
export const AGENTROUTER_DISCORD = 'https://discord.gg/HgekCyHJqB';

export function isAgentRouterUrl(baseUrl: string): boolean {
  try {
    const host = new URL(normalizeBaseUrl(baseUrl)).hostname;
    return host === 'agentrouter.org' || host.endsWith('.agentrouter.org');
  } catch {
    return false;
  }
}

/** Returns a hint string for auth failures on agentrouter, or '' when no hint applies. */
export function agentRouterHint(baseUrl: string, status: number): string {
  if (status !== 401 && status !== 403) return '';
  if (!isAgentRouterUrl(baseUrl)) return '';
  return `AgentRouter returned ${status}. A valid key can still be blocked if the endpoint only accepts approved clients, so this is probably not a wrong key. Ask in their Discord support: ${AGENTROUTER_DISCORD}`;
}

/** Ids that are not chat models, so they never go in an auto-filled fallback chain. */
const NON_CHAT = /(embed|embedding|whisper|tts|speech|audio|transcri|guard|moderation|rerank|image|vision-preview|dall|stable-diffusion|imagen|veo|rerank|safety)/i;

/** Parses a /models JSON body (OpenAI shape: { data: [...] }, or a bare array) into ModelInfo[]. */
export function parseModelsResponse(body: unknown): ModelInfo[] {
  const rows: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? ((body as { data: unknown[] }).data)
      : [];
  const out: ModelInfo[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const rawId = typeof r.id === 'string' ? r.id : typeof r.name === 'string' ? r.name : '';
    // Gemini's OpenAI-compat list prefixes ids with "models/"; chat calls take the bare name.
    const id = rawId.replace(/^models\//, '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      free: isFreeFlagged(r),
      sizeB: parseSizeB(id),
      contextLength: readContext(r),
    });
  }
  return out;
}

/** openrouter: ':free' slug suffix, or pricing that is zero for both prompt and completion. */
function isFreeFlagged(r: Record<string, unknown>): boolean {
  const id = typeof r.id === 'string' ? r.id : '';
  if (id.endsWith(':free')) return true;
  const pricing = r.pricing as Record<string, unknown> | undefined;
  if (pricing && typeof pricing === 'object') {
    const p = Number(pricing.prompt);
    const c = Number(pricing.completion);
    if (Number.isFinite(p) && Number.isFinite(c) && p === 0 && c === 0) return true;
  }
  return r.free === true || r.is_free === true;
}

function readContext(r: Record<string, unknown>): number | undefined {
  for (const key of ['context_length', 'context_window', 'max_context_length', 'max_model_len']) {
    const n = Number(r[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Parameter count in billions from a model name: 'gpt-oss-20b' -> 20, 'qwen3.8-27b' -> 27,
 * 'llama-3.1-8b-instant' -> 8, 'gemma4:31b' -> 31. MoE names like 'mixtral-8x7b' -> 56.
 * Returns undefined when the name carries no size (e.g. 'gemini-2.5-flash', 'openrouter/free').
 */
export function parseSizeB(id: string): number | undefined {
  const lower = id.toLowerCase();
  const moe = /(?:^|[^a-z0-9.])(\d+)x(\d+(?:\.\d+)?)b(?![a-z0-9])/.exec(lower);
  if (moe) return Number(moe[1]) * Number(moe[2]);
  // A size is a number followed by 'b' that is not the start of a word (so not 'bf16', 'b2b').
  const m = /(?:^|[^a-z0-9.])(\d+(?:\.\d+)?)b(?![a-z])/.exec(lower);
  return m ? Number(m[1]) : undefined;
}

/**
 * Efficiency score: lower is more efficient (tried first in an auto-filled cheap fallback chain).
 *
 * Heuristic, in priority order:
 *  1. Parameter size in billions, from the name. Smaller models are cheaper and faster.
 *     Names with no size get a neutral 30B, so an unknown-size model is not assumed tiny.
 *  2. Speed hint in the name: 'instant', 'flash', 'lite', 'mini', 'nano', 'turbo', 'small' or
 *     'tiny' halve the effective size (documented fast/small variants of a family).
 *     Not a measured throughput; the response does not report speed.
 *  3. Context length is only a tie-breaker: a longer window at equal size ranks first (more room
 *     for the same request before a fallback is needed).
 *
 * Free models are always sorted ahead of paid ones by sortByEfficiency, before this score applies.
 */
export function efficiencyScore(model: ModelInfo): number {
  const size = model.sizeB ?? 30;
  const fast = /(instant|flash|lite|mini|nano|turbo|small|tiny)/i.test(model.id);
  return fast ? size * 0.5 : size;
}

/** Sorts most efficient first: free before paid, then efficiencyScore, then larger context. */
export function sortByEfficiency(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    if (a.free !== b.free) return a.free ? -1 : 1;
    const diff = efficiencyScore(a) - efficiencyScore(b);
    if (diff !== 0) return diff;
    return (b.contextLength ?? 0) - (a.contextLength ?? 0);
  });
}

/**
 * The list the one-tap "auto-fill fallback chain" uses: chat models only (no embed, tts, guard,
 * image ids), free-marked ones when the provider flags any, otherwise every chat model. Sorted
 * most efficient first. The primary model is excluded so it is never retried as a fallback.
 */
export function autoFillFallbackChain(models: ModelInfo[], primary: string): string[] {
  const chat = models.filter((m) => !NON_CHAT.test(m.id) && m.id !== primary);
  const anyFree = chat.some((m) => m.free);
  const pool = anyFree ? chat.filter((m) => m.free) : chat;
  return sortByEfficiency(pool).map((m) => m.id);
}
