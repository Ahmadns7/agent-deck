import type { Conversation } from './types';

export type SortOrder = 'recent' | 'oldest' | 'title' | 'created';

export const SORT_LABELS: Record<SortOrder, string> = {
  recent: 'Recently updated',
  oldest: 'Least recently updated',
  title: 'Title A to Z',
  created: 'Newest created',
};

/** Pinned chats first, then favorites, then the chosen order. Returns a new array. */
export function sortConversations(list: Conversation[], order: SortOrder): Conversation[] {
  const byOrder = (a: Conversation, b: Conversation): number => {
    switch (order) {
      case 'oldest':
        return a.updatedAt - b.updatedAt;
      case 'title':
        return a.title.localeCompare(b.title);
      case 'created':
        return b.createdAt - a.createdAt;
      default:
        return b.updatedAt - a.updatedAt;
    }
  };
  const rank = (c: Conversation) => (c.pinned ? 2 : 0) + (c.favorite ? 1 : 0);
  return [...list].sort((a, b) => rank(b) - rank(a) || byOrder(a, b));
}

/** Every tag used across conversations, sorted. */
export function allTags(list: Conversation[]): string[] {
  const set = new Set<string>();
  for (const c of list) for (const t of c.tags ?? []) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Parses a comma-separated tag field into clean, unique tags (max 12, 24 chars each). */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 12);
}
