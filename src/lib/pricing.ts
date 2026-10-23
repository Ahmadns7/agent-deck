export interface PriceEntry {
  /** Model id exactly as sent to the provider (matched case-insensitively). */
  model: string;
  /** USD per one million prompt tokens. */
  inputPerMillion: number;
  /** USD per one million completion tokens. */
  outputPerMillion: number;
}

/**
 * Starting prices. These were NOT checked against current provider pricing pages.
 * They are estimates only. Edit them in Studio > Pricing to match what you actually pay.
 */
export const DEFAULT_PRICING: PriceEntry[] = [
  { model: 'gpt-4o-mini', inputPerMillion: 0.15, outputPerMillion: 0.6 },
  { model: 'claude-3-5-haiku-latest', inputPerMillion: 0.8, outputPerMillion: 4 },
  { model: 'gemini-2.0-flash', inputPerMillion: 0.1, outputPerMillion: 0.4 },
  { model: 'llama-3.3-70b-versatile', inputPerMillion: 0.59, outputPerMillion: 0.79 },
  { model: 'openai/gpt-oss-120b', inputPerMillion: 0.15, outputPerMillion: 0.75 },
  { model: 'openai/gpt-oss-20b', inputPerMillion: 0.1, outputPerMillion: 0.5 },
  { model: 'deepseek-chat', inputPerMillion: 0.27, outputPerMillion: 1.1 },
  { model: 'mistral-small-latest', inputPerMillion: 0.1, outputPerMillion: 0.3 },
];

/** Finds the price for a model, or undefined when none is set. */
export function findPrice(table: PriceEntry[], model: string | undefined): PriceEntry | undefined {
  const wanted = (model ?? '').trim().toLowerCase();
  if (!wanted) return undefined;
  return table.find((entry) => entry.model.trim().toLowerCase() === wanted);
}

/** Estimated USD cost of one response. Returns undefined when the model has no price. */
export function estimateCost(
  usage: { promptTokens?: number; completionTokens: number },
  price: PriceEntry | undefined,
): number | undefined {
  if (!price) return undefined;
  const prompt = usage.promptTokens ?? 0;
  const cost = (prompt * price.inputPerMillion + usage.completionTokens * price.outputPerMillion) / 1_000_000;
  return Number.isFinite(cost) ? cost : undefined;
}

export function formatCost(usd: number | undefined): string {
  if (usd === undefined) return '-';
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

/** Parses a price typed in the editor. Blank or invalid input returns undefined. */
export function parsePriceInput(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
