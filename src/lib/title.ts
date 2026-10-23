const FILLER = /^(hi|hey|hello|yo|ok|okay|please|pls|can you|could you|would you|i need|i want|i'd like|help me|tell me)\b[\s,!.:-]*/i;

/**
 * Local title from the first exchange, with no extra model call. Strips greetings and
 * filler, takes the first sentence, and keeps it to six words. Returns null when nothing is left.
 */
export function autoTitle(userText: string): string | null {
  let s = userText.replace(/```[\s\S]*?```/g, ' ').replace(/[*`#>_[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const next = s.replace(FILLER, '');
    if (next === s) break;
    s = next;
  }
  const first = s.split(/[.?!\n]/)[0]?.trim() ?? '';
  if (first.length === 0) return null;
  const words = first.split(' ').slice(0, 6).join(' ');
  const cased = words.charAt(0).toUpperCase() + words.slice(1);
  return cased.length > 48 ? `${cased.slice(0, 47)}…` : cased;
}
