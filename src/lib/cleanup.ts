/** End-of-turn tokens that some hosted and local models leak into their text. Written as escapes so the source stays readable. */
export const STOP_TOKENS: string[] = [
  '\u003c|end_of_text|\u003e',
  '\u003cend_of_turn\u003e',
  '\u003c/s\u003e',
  '[PROMPT_INJECTION]',
];

/**
 * Cleans the raw streamed text. Everything from the first stop token on is dropped,
 * because the model stopped there. While still streaming (final = false), a partial
 * stop token at the very end is held back so it never flashes on screen.
 * Pass the full raw text each time, not only the new piece.
 */
export function cleanStreamText(raw: string, final = false): string {
  let cut = raw.length;
  for (const token of STOP_TOKENS) {
    const at = raw.indexOf(token);
    if (at !== -1 && at < cut) cut = at;
  }
  let out = raw.slice(0, cut);
  if (cut === raw.length && !final) {
    for (const token of STOP_TOKENS) {
      for (let len = token.length - 1; len >= 2; len--) {
        if (out.endsWith(token.slice(0, len))) {
          out = out.slice(0, out.length - len);
          break;
        }
      }
    }
  }
  return out;
}
