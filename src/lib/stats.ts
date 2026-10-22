/** Rough token estimate (about 4 characters per token) for providers that do not report usage. */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/** Generation throughput. Returns undefined when it cannot be computed honestly. */
export function computeTokensPerSecond(tokens: number, durationMs: number): number | undefined {
  if (!Number.isFinite(tokens) || !Number.isFinite(durationMs)) return undefined;
  if (tokens <= 0 || durationMs <= 0) return undefined;
  return tokens / (durationMs / 1000);
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatRate(tps: number | undefined): string {
  return tps === undefined ? '-' : `${tps.toFixed(1)} tok/s`;
}
