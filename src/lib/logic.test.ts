import { describe, expect, it } from 'vitest';
import { parseMarkdown, parseInline, highlight, markdownToPlain } from './markdown';
import { estimateCost, findPrice, formatCost, parsePriceInput, DEFAULT_PRICING } from './pricing';
import { fuzzyScore, searchPalette, type PaletteItem } from './palette';
import { extractVariables, fillVariables, promptCommand, filterPrompts } from './prompts';
import { cleanStreamText, STOP_TOKENS } from './cleanup';
import { addVariant, switchVariant, activeIndex, variantCount } from './variants';
import { autoTitle } from './title';
import { sortConversations, parseTags, allTags } from './conversationList';
import { searchMessages } from './search';
import { wrapLines } from './exportImage';
import { finalTranscript } from './voice';
import type { Conversation, StoredMessage } from './types';

describe('markdown parser', () => {
  it('parses headings, paragraphs, lists, quotes and rules', () => {
    const blocks = parseMarkdown('# Title\n\nhello\nworld\n\n- a\n- b\n\n1. one\n\n> quoted\n\n---');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'hr']);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Title' });
    expect(blocks[2]).toEqual({ type: 'list', ordered: false, items: ['a', 'b'] });
    expect(blocks[3]).toEqual({ type: 'list', ordered: true, items: ['one'] });
  });

  it('keeps a streaming unclosed code fence open to the end', () => {
    const blocks = parseMarkdown('intro\n```ts\nconst a = 1;');
    expect(blocks[1]).toEqual({ type: 'code', lang: 'ts', code: 'const a = 1;', closed: false });
  });

  it('closes a finished code fence and keeps the body exact', () => {
    const blocks = parseMarkdown('```python\nprint(1)\n```');
    expect(blocks).toEqual([{ type: 'code', lang: 'python', code: 'print(1)', closed: true }]);
  });

  it('parses inline code, bold, italic and only http links', () => {
    const spans = parseInline('use `x` and **bold** and *it* and [site](https://a.dev) [bad](javascript:alert(1))');
    expect(spans).toContainEqual({ type: 'code', text: 'x' });
    expect(spans).toContainEqual({ type: 'bold', text: 'bold' });
    expect(spans).toContainEqual({ type: 'italic', text: 'it' });
    expect(spans).toContainEqual({ type: 'link', text: 'site', href: 'https://a.dev' });
    expect(spans.some((s) => s.type === 'link' && s.href.startsWith('javascript'))).toBe(false);
  });
});

describe('syntax highlighting', () => {
  it('keeps every character (copy-safe) and tags keywords and strings', () => {
    const code = 'const s = "hi"; // note';
    const tokens = highlight(code, 'ts');
    expect(tokens.map((t) => t.text).join('')).toBe(code);
    expect(tokens).toContainEqual({ kind: 'keyword', text: 'const' });
    expect(tokens).toContainEqual({ kind: 'string', text: '"hi"' });
    expect(tokens.some((t) => t.kind === 'comment')).toBe(true);
  });

  it('returns plain text for unknown languages', () => {
    expect(highlight('x = 1', 'cobol')).toEqual([{ kind: 'plain', text: 'x = 1' }]);
  });

  it('markdownToPlain omits code and strips markers', () => {
    expect(markdownToPlain('**hi** there\n```js\nx\n```')).toContain('code block omitted.');
  });
});

describe('pricing', () => {
  it('calculates cost from prompt and completion tokens per million', () => {
    const price = { model: 'm', inputPerMillion: 1, outputPerMillion: 2 };
    expect(estimateCost({ promptTokens: 1_000_000, completionTokens: 500_000 }, price)).toBeCloseTo(2);
  });

  it('returns undefined when there is no price', () => {
    expect(estimateCost({ completionTokens: 10 }, undefined)).toBeUndefined();
  });

  it('matches models case-insensitively and parses edited input', () => {
    expect(findPrice(DEFAULT_PRICING, 'GPT-4O-MINI')?.model).toBe('gpt-4o-mini');
    expect(parsePriceInput('0.5')).toBe(0.5);
    expect(parsePriceInput('-1')).toBeUndefined();
    expect(parsePriceInput('abc')).toBeUndefined();
    expect(formatCost(undefined)).toBe('-');
  });
});

describe('palette search', () => {
  const items: PaletteItem[] = [
    { id: 'a', label: 'New chat', group: 'Actions' },
    { id: 'b', label: 'Settings: appearance', group: 'Settings' },
    { id: 'c', label: 'Skill: code review', group: 'Skills', keywords: 'review pull requests' },
  ];

  it('prefers contiguous and word-start matches', () => {
    expect(fuzzyScore('nc', 'New chat')).toBeGreaterThanOrEqual(0);
    expect(fuzzyScore('zz', 'New chat')).toBe(-1);
  });

  it('finds items by label or keywords', () => {
    expect(searchPalette(items, 'app')[0].id).toBe('b');
    expect(searchPalette(items, 'pull')[0].id).toBe('c');
    expect(searchPalette(items, 'nope')).toEqual([]);
  });
});

describe('prompt library', () => {
  it('extracts variables in order without duplicates', () => {
    expect(extractVariables('Hi {{name}}, about {{ topic }} {{name}}')).toEqual(['name', 'topic']);
  });

  it('fills known variables and leaves unknown ones', () => {
    expect(fillVariables('Hi {{name}} {{x}}', { name: 'Ada' })).toBe('Hi Ada {{x}}');
  });

  it('recognises /prompt commands', () => {
    expect(promptCommand('/prompt summarize')).toEqual({ query: 'summarize' });
    expect(promptCommand('/prompt')).toEqual({ query: '' });
    expect(promptCommand('hello /prompt')).toBeNull();
  });

  it('filters prompts by name or body', () => {
    const list = [
      { id: '1', name: 'Code review', body: 'review this diff' },
      { id: '2', name: 'Recipe', body: 'make dinner' },
    ];
    expect(filterPrompts(list, 'diff')[0].id).toBe('1');
  });
});

describe('stream cleanup', () => {
  it('drops everything from the first stop token', () => {
    expect(cleanStreamText('answer' + STOP_TOKENS[0] + ' junk')).toBe('answer');
  });

  it('holds back a partial stop token while streaming', () => {
    expect(cleanStreamText('answer \u003c|end_')).toBe('answer ');
    expect(cleanStreamText('answer \u003c|end_', true)).toBe('answer \u003c|end_');
  });
});

describe('reply variants', () => {
  const base: StoredMessage = { id: 'm1', role: 'assistant', content: 'first' };

  it('adds a variant and keeps the old reply', () => {
    const next = addVariant(base);
    expect(variantCount(next)).toBe(2);
    expect(next.variants?.[0].content).toBe('first');
    expect(next.content).toBe('');
    expect(activeIndex(next)).toBe(1);
  });

  it('swipes between variants', () => {
    const two = addVariant(base);
    const back = switchVariant({ ...two, content: 'second' }, 0);
    expect(back.content).toBe('first');
    expect(switchVariant(back, 0)).toBe(back);
  });
});

describe('auto title', () => {
  it('strips greetings and filler and caps length', () => {
    expect(autoTitle('hey, can you help me write a haiku about rain?')).toBe('Write a haiku about rain');
    expect(autoTitle('```code only```')).toBeNull();
  });
});

describe('conversation list', () => {
  const conv = (id: string, updatedAt: number, extra: Partial<Conversation> = {}): Conversation => ({
    id,
    title: id,
    providerId: 'p',
    createdAt: updatedAt,
    updatedAt,
    messages: [],
    ...extra,
  });

  it('puts pinned then favorite first, then sorts', () => {
    const list = [conv('a', 1), conv('b', 3, { pinned: true }), conv('c', 2, { favorite: true })];
    expect(sortConversations(list, 'recent').map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(sortConversations(list, 'oldest').map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('parses and dedupes tags, and lists all tags', () => {
    expect(parseTags(' Work, work, Side Project ')).toEqual(['work', 'side-project']);
    expect(allTags([conv('a', 1, { tags: ['z', 'a'] }), conv('b', 1, { tags: ['a'] })])).toEqual(['a', 'z']);
  });
});

describe('message search and export helpers', () => {
  it('finds matches across conversations case-insensitively', () => {
    const convs: Conversation[] = [
      {
        id: 'c1',
        title: 'T',
        providerId: 'p',
        createdAt: 1,
        updatedAt: 5,
        messages: [{ id: 'm', role: 'user', content: 'Explain Kubernetes pods' }],
      },
    ];
    const hits = searchMessages(convs, 'kubernetes');
    expect(hits).toHaveLength(1);
    expect(hits[0].snippet).toContain('Kubernetes');
  });

  it('wraps long lines at word boundaries', () => {
    expect(wrapLines('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc']);
  });
});

describe('voice transcript', () => {
  it('joins only final results', () => {
    const results = [
      { 0: { transcript: 'hello ' }, isFinal: true },
      { 0: { transcript: 'wor' }, isFinal: false },
    ];
    expect(finalTranscript({ resultIndex: 0, results })).toBe('hello');
  });
});
