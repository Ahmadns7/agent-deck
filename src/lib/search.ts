import type { Conversation } from './types';
import { contentText } from './attachments';

export interface MessageHit {
  convId: string;
  messageId: string;
  title: string;
  role: 'user' | 'assistant';
  snippet: string;
  updatedAt: number;
}

/** Case-insensitive search across every message of every conversation. Most recently updated first. */
export function searchMessages(conversations: Conversation[], query: string, limit = 50): MessageHit[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const hits: MessageHit[] = [];
  const ordered = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const conv of ordered) {
    for (const msg of conv.messages) {
      const text = contentText(msg.content);
      const at = text.toLowerCase().indexOf(q);
      if (at === -1) continue;
      const start = Math.max(0, at - 40);
      const end = Math.min(text.length, at + q.length + 60);
      const snippet = `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
      hits.push({ convId: conv.id, messageId: msg.id, title: conv.title, role: msg.role, snippet, updatedAt: conv.updatedAt });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
