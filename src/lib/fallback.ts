/** Models tried after the primary model when the provider rejects a request for size or rate. */
export const DEFAULT_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'llama-3.1-8b-instant'];

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
  const failures: AttemptFailure[] = [];
  let last = models[0] ?? '';
  for (const model of models) {
    last = model;
    try {
      const value = await attempt(model);
      return { ok: true, model, value, failures };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ model, message });
      if (isAborted() || !isRetryableLimitError(message)) break;
    }
  }
  return { ok: false, model: last, failures };
}
