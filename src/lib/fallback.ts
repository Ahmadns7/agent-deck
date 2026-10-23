/** Models tried after the primary model when the provider rejects a request for size or rate. */
// llama-3.1-8b-instant was retired on Groq (Aug 16, 2026); qwen3.8-27b is the alternative (listed in the docs model table as preview; not API-verified).
export const DEFAULT_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];

/**
 * Fallback list used when the provider has none saved. Only Groq gets defaults, because
 * those model ids are not valid on other providers.
 */
export function defaultFallbackFor(provider: { baseUrl: string }): string[] {
  return /(^|\/\/)api\.groq\.com(\/|$)/.test(provider.baseUrl.trim()) ? DEFAULT_FALLBACK_MODELS : [];
}

/** The fallback list that will actually be used for a provider. */
export function effectiveFallbacks(provider: { baseUrl: string; fallbackModels?: string[] }): string[] {
  return provider.fallbackModels ?? defaultFallbackFor(provider);
}

/** Splits a comma-separated model list, trimming blanks and dropping duplicates (order kept). */
export function parseFallbackModels(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(',');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const model = raw.trim();
    if (model.length > 0 && !seen.has(model)) {
      seen.add(model);
      out.push(model);
    }
  }
  return out;
}

/**
 * True when an error from the provider means "try a different model": rate limit (429),
 * payload too large (413), or the matching message text.
 * Accepts the Error message string produced by streamChat ("413 Payload Too Large: ...").
 */
export function isRetryableLimitError(message: string): boolean {
  const text = message.toLowerCase();
  if (/(^|[^0-9])(429|413)([^0-9]|$)/.test(text)) return true;
  return text.includes('rate limit') || text.includes('rate_limit') || text.includes('too large') || text.includes('tokens per minute');
}

/**
 * The ordered list of models to attempt: the primary first, then fallbacks,
 * with duplicates removed so the primary is never retried.
 */
export function modelAttemptOrder(primary: string, fallbacks: string[]): string[] {
  return parseFallbackModels([primary, ...fallbacks]);
}

export interface AttemptFailure {
  model: string;
  message: string;
}

export interface FallbackOutcome<T> {
  ok: boolean;
  /** The model that produced the successful result, or the last model tried. */
  model: string;
  value?: T;
  failures: AttemptFailure[];
}

/**
 * Tries each model in order. Moves on only for rate/size errors; any other error stops
 * immediately and is returned as the final failure. Aborts are never retried.
 */
export async function runWithFallback<T>(
  models: string[],
  attempt: (model: string) => Promise<T>,
  isAborted: () => boolean = () => false,
): Promise<FallbackOutcome<T>> {
  return runWithFallbackChain(models, attempt, isAborted, (model) => model).then((outcome) => ({
    ok: outcome.ok,
    model: outcome.label,
    value: outcome.value,
    failures: outcome.failures.map((f) => ({ model: f.label, message: f.message })),
  }));
}

export interface ChainFailure {
  label: string;
  message: string;
}

export interface ChainOutcome<A, T> {
  ok: boolean;
  /** The attempt that succeeded, or the last one tried. */
  item?: A;
  label: string;
  value?: T;
  failures: ChainFailure[];
}

/**
 * Generic version of runWithFallback: tries each attempt in order and moves on only for
 * rate/size errors. Used for same-provider model fallbacks and cross-provider fallbacks.
 */
export async function runWithFallbackChain<A, T>(
  items: A[],
  attempt: (item: A) => Promise<T>,
  isAborted: () => boolean = () => false,
  label: (item: A) => string,
): Promise<ChainOutcome<A, T>> {
  const failures: ChainFailure[] = [];
  let lastItem: A | undefined;
  for (const item of items) {
    lastItem = item;
    try {
      const value = await attempt(item);
      return { ok: true, item, label: label(item), value, failures };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ label: label(item), message });
      if (isAborted() || !isRetryableLimitError(message)) break;
    }
  }
  return { ok: false, item: lastItem, label: lastItem === undefined ? '' : label(lastItem), failures };
}

/** Minimal provider shape needed to decide whether a configured provider can be called. */
export interface ReadyCheck {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  kind: string;
}

/**
 * Resolves the cross-provider chain to concrete provider + model attempts. Skips the
 * current provider, unknown providers, and providers with no key (unless local Ollama).
 */
export function resolveCrossProviderAttempts<P extends ReadyCheck>(
  refs: { providerId: string; model: string }[],
  providers: P[],
  currentId: string,
): { provider: P; model: string }[] {
  const out: { provider: P; model: string }[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const model = ref.model.trim();
    const provider = providers.find((p) => p.id === ref.providerId);
    if (!provider || !model || provider.id === currentId || !isProviderUsable(provider)) continue;
    const key = `${provider.id}|${model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ provider, model });
  }
  return out;
}

/** True when a provider has a key, or is a local endpoint that needs none. */
export function isProviderUsable(provider: { apiKey: string; baseUrl: string; kind: string }): boolean {
  return Boolean(provider.apiKey) || (provider.kind === 'openai' && provider.baseUrl.includes('localhost'));
}
