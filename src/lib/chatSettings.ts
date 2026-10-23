/** Font size choices for the whole app. Applied as the root font size, so rem-based classes scale with it. */
export const FONT_SIZES = { small: 14, medium: 16, large: 18 } as const;

export type FontSize = keyof typeof FONT_SIZES;

export function normalizeFontSize(value: unknown): FontSize {
  return value === 'small' || value === 'large' ? value : 'medium';
}

/** Temperature is 0 to 2 for OpenAI-compatible APIs. Returns undefined for values that cannot be used. */
export function clampTemperature(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(2, Math.max(0, Math.round(value * 100) / 100));
}

/** Max output tokens must be a positive whole number. */
export function clampMaxTokens(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 1) return undefined;
  return Math.min(200_000, Math.floor(value));
}
