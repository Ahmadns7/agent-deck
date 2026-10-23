import { describe, expect, it } from 'vitest';
import { buildUserContent, classifyFile, contentText } from './attachments';
import type { Attachment } from './types';

describe('classifyFile', () => {
  it('classifies images, text-ish files, and others', () => {
    expect(classifyFile('a.png', 'image/png')).toBe('image');
    expect(classifyFile('notes.md', '')).toBe('text');
    expect(classifyFile('data.JSON', '')).toBe('text');
    expect(classifyFile('report.pdf', 'application/pdf')).toBe('unsupported');
  });
});

describe('buildUserContent', () => {
  const image: Attachment = { id: '1', name: 'p.png', size: 10, kind: 'image', mime: 'image/png', dataUrl: 'data:image/png;base64,AAA' };
  const text: Attachment = { id: '2', name: 'a.ts', size: 5, kind: 'text', mime: '', text: 'const x = 1;' };
  const bad: Attachment = { id: '3', name: 'b.pdf', size: 5, kind: 'unsupported', mime: 'application/pdf', reason: 'nope' };

  it('returns plain text when there are no usable attachments', () => {
    expect(buildUserContent('hi', [])).toBe('hi');
    expect(buildUserContent('hi', [bad])).toBe('hi');
  });

  it('builds OpenAI-compatible parts: text file, user text, then image_url', () => {
    const parts = buildUserContent('what is this', [image, text, bad]);
    expect(parts).toEqual([
      { type: 'text', text: 'File: a.ts\n```\nconst x = 1;\n```' },
      { type: 'text', text: 'what is this' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    ]);
  });

  it('keeps an image-only message as parts without a text part', () => {
    expect(buildUserContent('', [image])).toEqual([{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }]);
  });

  it('flattens content to plain text for display and copy', () => {
    expect(contentText('plain')).toBe('plain');
    expect(contentText([{ type: 'text', text: 'a' }, { type: 'image_url', image_url: { url: 'x' } }])).toBe('a\n[image]');
  });
});
