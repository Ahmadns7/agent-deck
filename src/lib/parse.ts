import type { ProviderKind } from './types';
import type { SSEEvent } from './sse';

export interface StreamPiece {
  delta?: string;
  usage?: { prompt?: number; completion?: number };
  done?: boolean;
}

/**
 * Maps one SSE event from a provider into a normalized piece.
 * Returns null for events that carry nothing we use (pings, role headers, etc.).
 * Throws when the provider reports an error inside the stream.
 */
export function parseStreamEvent(kind: ProviderKind, event: SSEEvent): StreamPiece | null {
  if (event.data === '[DONE]') return { done: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try {
    json = JSON.parse(event.data);
  } catch {
    return null;
  }

  if (kind === 'openai') {
    if (json?.error) throw new Error(json.error.message ?? 'Provider error');
    const piece: StreamPiece = {};
    const content = json?.choices?.[0]?.delta?.content;
    if (typeof content === 'string' && content.length > 0) piece.delta = content;
    if (json?.usage) {
      piece.usage = {
        prompt: json.usage.prompt_tokens,
        completion: json.usage.completion_tokens,
      };
    }
    return piece.delta !== undefined || piece.usage ? piece : null;
  }

  // Anthropic Messages API stream
  switch (json?.type) {
    case 'error':
      throw new Error(json.error?.message ?? 'Provider error');
    case 'message_start':
      return { usage: { prompt: json.message?.usage?.input_tokens } };
    case 'content_block_delta':
      if (json.delta?.type === 'text_delta' && typeof json.delta.text === 'string') {
        return { delta: json.delta.text };
      }
      return null;
    case 'message_delta':
      return { usage: { completion: json.usage?.output_tokens } };
    case 'message_stop':
      return { done: true };
    default:
      return null;
  }
}
