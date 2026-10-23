import { buildChatRequest } from './providers';
import { agentRouterHint } from './models';
import { parseStreamEvent } from './parse';
import { createSSEParser } from './sse';
import { computeTokensPerSecond, estimateTokens } from './stats';
import type { ChatMessage, ProviderConfig, ResponseStats } from './types';

export interface StreamOptions {
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export interface StreamResult {
  text: string;
  stats: ResponseStats;
}

/** Pulls a readable message out of an error response body. */
export function extractErrorMessage(body: string): string {
  try {
    const json = JSON.parse(body);
    const message = json?.error?.message ?? json?.error ?? json?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  } catch {
    // not JSON, fall through
  }
  return body.slice(0, 300) || 'no details returned';
}

/**
 * Streams a chat completion from the configured provider.
 * The API key is only attached to the request sent to the provider's own base URL.
 */
export async function streamChat(
  provider: ProviderConfig,
  messages: ChatMessage[],
  opts: StreamOptions,
): Promise<StreamResult> {
  const { url, init } = buildChatRequest(provider, messages);
  const start = performance.now();

  const res = await fetch(url, { ...init, signal: opts.signal });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const hint = agentRouterHint(provider.baseUrl, res.status);
    throw new Error(`${res.status} ${res.statusText}: ${extractErrorMessage(body)}${hint ? ` ${hint}` : ''}`);
  }
  if (!res.body) throw new Error('Provider response has no body to stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let ttftMs: number | undefined;
  let promptTokens: number | undefined;
  let reportedCompletion: number | undefined;

  const parser = createSSEParser((event) => {
    const piece = parseStreamEvent(provider.kind, event);
    if (!piece) return;
    if (piece.delta) {
      if (ttftMs === undefined) ttftMs = performance.now() - start;
      text += piece.delta;
      opts.onDelta(piece.delta);
    }
    if (piece.usage?.prompt !== undefined) promptTokens = piece.usage.prompt;
    if (piece.usage?.completion !== undefined) reportedCompletion = piece.usage.completion;
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.flush();

  const totalMs = performance.now() - start;
  const completionTokens = reportedCompletion ?? estimateTokens(text);
  const generationMs = totalMs - (ttftMs ?? 0);

  return {
    text,
    stats: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens !== undefined ? promptTokens + completionTokens : undefined,
      ttftMs,
      totalMs,
      tokensPerSecond: computeTokensPerSecond(completionTokens, generationMs),
      estimated: reportedCompletion === undefined,
    },
  };
}
