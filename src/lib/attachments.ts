import type { Attachment, ChatMessage, ContentPart } from './types';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_BYTES = 200 * 1024;

const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'html', 'css', 'js', 'jsx',
  'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'sh', 'sql', 'log', 'toml', 'ini', 'env.example',
];

/** Lowercased extension without the dot, or '' when the name has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Images go as image_url parts, text-ish files go as text, everything else is unsupported. */
export function classifyFile(name: string, mime: string): 'image' | 'text' | 'unsupported' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXTENSIONS.includes(extensionOf(name))) return 'text';
  return 'unsupported';
}

/** Turns a user-visible text into the content sent to the provider, with attachments folded in. */
export function buildUserContent(text: string, attachments: Attachment[]): string | ContentPart[] {
  const usable = attachments.filter((a) => a.kind !== 'unsupported');
  if (usable.length === 0) return text;

  const parts: ContentPart[] = [];
  for (const a of usable) {
    if (a.kind === 'text' && a.text !== undefined) {
      parts.push({ type: 'text', text: `File: ${a.name}\n\`\`\`\n${a.text}\n\`\`\`` });
    }
  }
  if (text.length > 0) parts.push({ type: 'text', text });
  for (const a of usable) {
    if (a.kind === 'image' && a.dataUrl) parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
  }
  return parts;
}

/** Plain text of a message content, with images replaced by a placeholder. */
export function contentText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map((p) => (p.type === 'text' ? p.text : '[image]')).join('\n');
}

/** Reads a browser File into an Attachment, applying the size limits. */
export async function readAttachment(file: File, id: string): Promise<Attachment> {
  const kind = classifyFile(file.name, file.type);
  const base = { id, name: file.name, size: file.size, mime: file.type };
  if (kind === 'unsupported') {
    return { ...base, kind, reason: 'This file type is not supported yet. Attach images or text files.' };
  }
  if (kind === 'image') {
    if (file.size > MAX_IMAGE_BYTES) return { ...base, kind, reason: 'Image is over 5 MB.' };
    const dataUrl = await readAsDataUrl(file);
    return { ...base, kind, dataUrl };
  }
  if (file.size > MAX_TEXT_BYTES) return { ...base, kind: 'unsupported', reason: 'Text file is over 200 KB.' };
  const text = await file.text();
  return { ...base, kind, text };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}
