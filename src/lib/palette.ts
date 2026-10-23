export type PaletteGroup = 'Chats' | 'Messages' | 'Skills' | 'Settings' | 'Actions' | 'Prompts';

export interface PaletteItem {
  id: string;
  label: string;
  group: PaletteGroup;
  /** Extra words that also match (for example a skill's description). */
  keywords?: string;
  /** Short hint shown on the right (for example a shortcut or a snippet). */
  hint?: string;
}

/**
 * Subsequence fuzzy match. Returns -1 when the query letters do not appear in order.
 * Higher is better: exact substrings, consecutive letters and word starts score more.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;
  const direct = t.indexOf(q);
  if (direct !== -1) return 1000 - direct + (direct === 0 ? 500 : 0);
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    const atWordStart = found === 0 || /[\s\-_/.:@]/.test(t[found - 1]);
    streak = found === ti && ti > 0 ? streak + 1 : 0;
    score += 10 + streak * 5 + (atWordStart ? 8 : 0) - Math.min(found - ti, 10);
    ti = found + 1;
  }
  return score;
}

/** Ranks items against the query. Empty query returns the first items in their given order. */
export function searchPalette(items: PaletteItem[], query: string, limit = 40): PaletteItem[] {
  const q = query.trim();
  if (q.length === 0) return items.slice(0, limit);
  const ranked: { item: PaletteItem; score: number }[] = [];
  for (const item of items) {
    const label = fuzzyScore(q, item.label);
    const extra = item.keywords ? fuzzyScore(q, item.keywords) - 5 : -1;
    const best = Math.max(label, extra);
    if (best >= 0) ranked.push({ item, score: best });
  }
  ranked.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return ranked.slice(0, limit).map((r) => r.item);
}

export interface Shortcut {
  keys: string;
  action: string;
}

/** The keyboard shortcuts the app handles. Shown in the help overlay. */
export const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl/Cmd + K', action: 'Open the command palette' },
  { keys: 'Ctrl/Cmd + N', action: 'Start a new chat' },
  { keys: 'Ctrl/Cmd + /', action: 'Show this shortcut help' },
  { keys: 'Enter', action: 'Send the message' },
  { keys: 'Shift + Enter', action: 'New line in the composer' },
  { keys: 'Esc', action: 'Close the open panel or palette' },
];
