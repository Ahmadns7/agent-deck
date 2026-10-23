/** Splits text into lines no longer than maxChars, breaking at spaces where possible. */
export function wrapLines(text: string, maxChars: number): string[] {
  const width = Math.max(10, Math.floor(maxChars));
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      let w = word;
      while (w.length > width) {
        if (line) {
          out.push(line);
          line = '';
        }
        out.push(w.slice(0, width));
        w = w.slice(width);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (candidate.length > width) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}
