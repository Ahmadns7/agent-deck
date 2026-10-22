import type { Conversation, StoredMessage } from './types';

const MAX_TITLE = 48;

/** Short sidebar title derived from the first user message. */
export function titleFrom(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length === 0) return 'New chat';
  return oneLine.length > MAX_TITLE ? `${oneLine.slice(0, MAX_TITLE - 1)}…` : oneLine;
}

export function updateConversation(
  list: Conversation[],
  id: string,
  change: (conv: Conversation) => Conversation,
): Conversation[] {
  return list.map((c) => (c.id === id ? change(c) : c));
}

export function updateMessage(
  list: Conversation[],
  convId: string,
  messageId: string,
  change: (msg: StoredMessage) => StoredMessage,
): Conversation[] {
  return updateConversation(list, convId, (c) => ({
    ...c,
    messages: c.messages.map((m) => (m.id === messageId ? change(m) : m)),
  }));
}

/** Most recent assistant message that has stats, if any. */
export function lastStatsMessage(conv: Conversation | undefined): StoredMessage | undefined {
  if (!conv) return undefined;
  for (let i = conv.messages.length - 1; i >= 0; i--) {
    const m = conv.messages[i];
    if (m.role === 'assistant' && m.stats) return m;
  }
  return undefined;
}
