/** Inline pieces of a markdown paragraph. Rendered as React nodes, never as raw HTML. */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; href: string };

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; lang: string; code: string; closed: boolean }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'hr' };

const FENCE_OPEN = /^```\s*([\w+#.-]*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^(\*\*\*|---|___)\s*$/;
const QUOTE = /^>\s?(.*)$/;
const LIST = /^\s*([-*+]|\d+[.)])\s+(.*)$/;

/**
 * Block-level markdown parser. Tolerant of partial input: an unclosed code fence
 * runs to the end of the text, so a streaming reply renders while it is still open.
 */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      let closed = false;
      while (i < lines.length) {
        if (FENCE_CLOSE.test(lines[i])) {
          closed = true;
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', lang: fence[1].toLowerCase(), code: body.join('\n'), closed });
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }
    if (HR.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(QUOTE.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ type: 'quote', text: quoted.join('\n') });
      continue;
    }
    if (LIST.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && LIST.test(lines[i])) {
        items.push(LIST.exec(lines[i])![2]);
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE_OPEN.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !LIST.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }
  return blocks;
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

/** Inline spans for one paragraph. Only http(s) links become links. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const re = new RegExp(INLINE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('`')) out.push({ type: 'code', text: raw.slice(1, -1) });
    else if (raw.startsWith('**')) out.push({ type: 'bold', text: raw.slice(2, -2) });
    else if (raw.startsWith('*')) out.push({ type: 'italic', text: raw.slice(1, -1) });
    else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(raw);
      if (link) out.push({ type: 'link', text: link[1], href: link[2] });
      else out.push({ type: 'text', text: raw });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

export type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment';
export interface CodeToken {
  kind: TokenKind;
  text: string;
}

type Family = 'js' | 'py' | 'sh' | 'json' | 'plain';

const KEYWORDS: Record<Exclude<Family, 'plain'>, Set<string>> = {
  js: new Set(
    'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of null undefined true false this super yield interface type enum implements public private protected readonly as satisfies'.split(' '),
  ),
  py: new Set(
    'def class return if elif else for while import from as with try except finally raise pass break continue lambda yield None True False and or not in is async await global nonlocal assert del'.split(' '),
  ),
  sh: new Set('if then else elif fi for while do done case esac function return export local echo cd in'.split(' ')),
  json: new Set(['true', 'false', 'null']),
};

/** Language family used for highlighting. Unknown languages are shown as plain text. */
export function langFamily(lang: string): Family {
  const l = lang.toLowerCase();
  if (['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx'].includes(l)) return 'js';
  if (['py', 'python'].includes(l)) return 'py';
  if (['sh', 'bash', 'shell', 'zsh'].includes(l)) return 'sh';
  if (l === 'json') return 'json';
  return 'plain';
}

type RuleKind = TokenKind | 'word';
interface Rule {
  kind: RuleKind;
  re: RegExp;
}

const RULES: Record<Exclude<Family, 'plain'>, Rule[]> = {
  js: [
    { kind: 'comment', re: /\/\*[\s\S]*?(?:\*\/|$)/y },
    { kind: 'comment', re: /\/\/[^\n]*/y },
    { kind: 'string', re: /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?/y },
    { kind: 'number', re: /\d[\d_]*(?:\.\d+)?/y },
    { kind: 'word', re: /[A-Za-z_$][\w$]*/y },
  ],
  py: [
    { kind: 'comment', re: /#[^\n]*/y },
    { kind: 'string', re: /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y },
    { kind: 'number', re: /\d[\d_]*(?:\.\d+)?/y },
    { kind: 'word', re: /[A-Za-z_]\w*/y },
  ],
  sh: [
    { kind: 'comment', re: /#[^\n]*/y },
    { kind: 'string', re: /"(?:\\.|[^"\\\n])*"?|'[^'\n]*'?/y },
    { kind: 'number', re: /\d+/y },
    { kind: 'word', re: /[A-Za-z_]\w*/y },
  ],
  json: [
    { kind: 'string', re: /"(?:\\.|[^"\\\n])*"?/y },
    { kind: 'number', re: /-?\d[\d.eE+-]*/y },
    { kind: 'word', re: /[A-Za-z]+/y },
  ],
};

/**
 * Small regex tokenizer for common languages. The concatenated token text always equals
 * the input, so a copied code block never loses characters.
 */
export function highlight(code: string, lang: string): CodeToken[] {
  const family = langFamily(lang);
  if (family === 'plain') return [{ kind: 'plain', text: code }];
  const rules = RULES[family];
  const keywords = KEYWORDS[family];
  const out: CodeToken[] = [];
  const push = (kind: TokenKind, text: string) => {
    const last = out[out.length - 1];
    if (kind === 'plain' && last && last.kind === 'plain') last.text += text;
    else out.push({ kind, text });
  };
  let pos = 0;
  while (pos < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = pos;
      const m = rule.re.exec(code);
      if (m && m[0].length > 0) {
        const text = m[0];
        if (rule.kind === 'word') push(keywords.has(text) ? 'keyword' : 'plain', text);
        else push(rule.kind, text);
        pos += text.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      push('plain', code[pos]);
      pos++;
    }
  }
  return out;
}

/** Plain-text version of markdown, for speech. Code blocks are replaced by a short note. */
export function markdownToPlain(src: string): string {
  return parseMarkdown(src)
    .map((b) => {
      switch (b.type) {
        case 'code':
          return 'code block omitted.';
        case 'list':
          return b.items.join('. ');
        case 'hr':
          return '';
        default:
          return b.text;
      }
    })
    .join('\n')
    .replace(/[*`#>_]/g, '')
    .trim();
}
