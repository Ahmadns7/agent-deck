import { useState, type ReactNode } from 'react';
import { highlight, parseInline, parseMarkdown, type CodeToken, type Inline } from '../lib/markdown';

const TOKEN_CLASS: Record<CodeToken['kind'], string> = {
  plain: '',
  keyword: 'text-indigo-300',
  string: 'text-emerald-300',
  number: 'text-amber-300',
  comment: 'text-slate-500 italic',
};

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied code' : 'Copy code block'}
      className="min-h-8 rounded px-2 text-[11px] text-slate-300 hover:bg-white/10"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

function renderInline(parts: Inline[]): ReactNode[] {
  return parts.map((p, i) => {
    switch (p.type) {
      case 'code':
        return <code key={i} className="rounded bg-slate-200/70 px-1 font-mono text-[0.85em] dark:bg-slate-800">{p.text}</code>;
      case 'bold':
        return <strong key={i}>{p.text}</strong>;
      case 'italic':
        return <em key={i}>{p.text}</em>;
      case 'link':
        // Only http(s) links are rendered as anchors. Anything else stays plain text.
        return /^https?:\/\//i.test(p.href)
          ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">{p.text}</a>
          : <span key={i}>{p.text}</span>;
      default:
        return <span key={i}>{p.text}</span>;
    }
  });
}

/**
 * Renders model output as React nodes. Never uses innerHTML, so model text cannot inject markup.
 * Partial (streaming) input renders too: an open code fence runs to the end.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const cls = b.level <= 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
            return <p key={i} className={cls}>{renderInline(parseInline(b.text))}</p>;
          }
          case 'paragraph':
            return <p key={i}>{renderInline(parseInline(b.text))}</p>;
          case 'quote':
            return <blockquote key={i} className="border-l-2 border-slate-400 pl-3 text-slate-600 dark:text-slate-400">{renderInline(parseInline(b.text))}</blockquote>;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
                {b.items.map((item, j) => <li key={j}>{renderInline(parseInline(item))}</li>)}
              </Tag>
            );
          }
          case 'hr':
            return <hr key={i} className="border-slate-300 dark:border-slate-700" />;
          case 'code': {
            const tokens = highlight(b.code, b.lang);
            return (
              <div key={i} className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
                <div className="flex items-center justify-between bg-slate-800 px-3 py-1 text-[11px] text-slate-400">
                  <span className="font-mono">{b.lang || 'text'}</span>
                  <CopyBlock text={b.code} />
                </div>
                <pre className="overflow-x-auto bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code className="font-mono whitespace-pre">{tokens.map((t, j) => (
                  <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>
                ))}</code></pre>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
